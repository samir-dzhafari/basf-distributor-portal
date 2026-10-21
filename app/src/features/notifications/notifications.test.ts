import dayjs from 'dayjs'
import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '@/app/api'
import { store } from '@/app/store'
import { authApi } from '@/features/auth/authApi'
import { logout } from '@/features/auth/authSlice'
import { getDb, resetDb } from '@/mocks/db'
import { EXCHANGE_TIMING, advanceExchange } from '@/mocks/exchange'
import { renderEmail, SAMPLE_EMAIL_DATA } from '@/shared/lib/emailTemplates'
import { NOTIFICATION_TYPES } from '@/shared/types/domain'
import { approvalsApi } from '../approvals/approvalsApi'
import { auditApi, type AuditQuery, type AuditResult } from '../audit/auditApi'
import { clientsApi } from '../clients/clientsApi'
import { ordersApi } from '../orders/ordersApi'
import { emptyWizard, type WizardData } from '../orders/wizard/validate'
import { ordersViewApi } from '../orders/ordersViewApi'
import { rolesApi } from '../roles/rolesApi'
import { settingsApi, type SettingsView } from '../settings/settingsApi'
import { notificationsApi, type NotificationsResult, type Subscriptions } from './notificationsApi'

type Result<T> = { data?: T; error?: { code: string; message: string } }
const call = <T = void>(thunk: unknown) => (store.dispatch as (a: unknown) => Promise<Result<T>>)(thunk)
const as = async (id: string) => {
  store.dispatch(logout())
  store.dispatch(api.util.resetApiState())
  await store.dispatch(authApi.endpoints.demoLogin.initiate(id))
}

/** Ответственный по приложению заказа — он может его одобрить. */
const approverOf = (orderId: string) => {
  const db = getDb()
  const o = db.orders.find((x) => x.id === orderId)!
  return db.applications.find((a) => a.id === o.applicationId)!.responsibleIds[0]
}

async function submitAsClient(): Promise<string> {
  await as('c-1a')
  const ctx = (
    await call<{
      businessTypes: { id: string }[]
      consignees: { id: string }[]
      paymentTerms: { id: string }[]
      deliveryTerms: { id: string }[]
      applications: { id: string; regionId: string; businessTypeId: string }[]
    }>(ordersApi.endpoints.getOrderContext.initiate('cl-1'))
  ).data!
  const app = ctx.applications[0]
  const products = (
    await call<{ products: { id: string; multiple: number }[] }>(
      ordersApi.endpoints.getOrderProducts.initiate({ clientId: 'cl-1', businessTypeId: app.businessTypeId }),
    )
  ).data!.products
  const d: WizardData = {
    ...emptyWizard(),
    clientId: 'cl-1',
    consigneeId: ctx.consignees[0].id,
    regionId: app.regionId,
    businessTypeId: app.businessTypeId,
    paymentTermId: ctx.paymentTerms[0].id,
    deliveryTermId: ctx.deliveryTerms[0].id,
    desiredDate: dayjs().add(5, 'day').format('YYYY-MM-DD'),
    applicationId: app.id,
    qty: { [products[0].id]: products[0].multiple * 2 },
  }
  return (await call<{ id: string }>(ordersApi.endpoints.submitOrder.initiate(d))).data!.id
}

beforeEach(() => {
  resetDb()
  store.dispatch(logout())
  store.dispatch(api.util.resetApiState())
})

describe('шаблоны писем', () => {
  it('для каждого события есть шаблон; значения экранируются', () => {
    const base = {
      number: 'P-1',
      clientName: 'ООО «Тест»',
      applicationNumber: 'A-1',
      total: '1 ₽',
      status: 'На одобрении',
      link: '#/orders/1',
      senderEmail: 'x@y.ru',
    }
    for (const t of NOTIFICATION_TYPES) {
      const r = renderEmail(t, { ...base, ...SAMPLE_EMAIL_DATA[t] })
      expect(r.subject).toContain('P-1')
      expect(r.html).toContain('Открыть заказ')
      expect(r.text).toContain('#/orders/1')
    }
    const evil = renderEmail('order.rejected', {
      ...base,
      clientName: '<img src=x onerror=alert(1)>',
      details: '"><script>x</script>',
    })
    expect(evil.html).not.toContain('<script>')
    expect(evil.html).not.toContain('<img src=x')
    expect(evil.html).toContain('&lt;script&gt;')
  })
})

describe('рассылка по событиям', () => {
  it('новый заказ: ответственные и одобряющие, коллега клиента и общая почта; автору — нет', async () => {
    const id = await submitAsClient()
    const db = getDb()
    const order = db.orders.find((o) => o.id === id)!
    const app = db.applications.find((a) => a.id === order.applicationId)!
    const got = db.notifications.filter((n) => n.orderId === id && n.type === 'order.submitted')
    const who = got.map((n) => n.userId)
    expect(who).toContain('c-1b') // коллега
    expect(who).not.toContain('c-1a') // автор
    expect(app.responsibleIds.every((r) => who.includes(r))).toBe(true)
    expect(got.every((n) => !n.read && n.title.includes(order.number))).toBe(true)
    const mails = db.emails.filter((e) => e.kind === 'order.submitted')
    expect(mails.map((m) => m.to)).toContain(db.clients.find((c) => c.id === 'cl-1')!.email) // общая почта
    expect(mails[0].html).toContain(order.number)
    expect(new Set(who).size).toBe(who.length) // без дублей
  })

  it('подписки: отключённый тип и выключенная почта уважаются, общую почту можно выключить', async () => {
    const db = getDb()
    db.users.find((u) => u.id === 'c-1b')!.mutedTypes = ['order.submitted']
    db.users.find((u) => u.id === 'u-app1')!.notifyEmail = false
    db.clients.find((c) => c.id === 'cl-1')!.notifyCommonEmail = false
    const id = await submitAsClient()
    const got = db.notifications.filter((n) => n.orderId === id && n.type === 'order.submitted').map((n) => n.userId)
    expect(got).not.toContain('c-1b')
    expect(got).toContain('u-app1') // в кабинет приходит
    const mails = db.emails.filter((e) => e.kind === 'order.submitted').map((e) => e.to)
    expect(mails).not.toContain('p.ivanov@agrokomplekt.ru')
    expect(mails).not.toContain('i.voronova@basf-demo.ru') // почта выключена
    expect(mails).not.toContain(db.clients.find((c) => c.id === 'cl-1')!.email)
  })

  it('одобрение и корректировка уведомляют клиента; передача, приём и выполнение — по цепочке', async () => {
    const id = await submitAsClient()
    const db = getDb()
    const order = db.orders.find((o) => o.id === id)!
    await as(approverOf(id))
    const item = order.items[0]
    await call(
      approvalsApi.endpoints.approveOrder.initiate({ id, changes: { [item.id]: item.qty + 3 }, comment: 'Ок' }),
    )
    const types = db.notifications.filter((n) => n.orderId === id).map((n) => `${n.type}:${n.userId}`)
    expect(types).toEqual(expect.arrayContaining(['order.approved:c-1a', 'order.approved:c-1b', 'order.changed:c-1a']))
    expect(types.some((t) => t.startsWith(`order.approved:${approverOf(id)}`))).toBe(false) // автор решения
    expect(types.some((t) => t === 'exchange.sent:c-1a')).toBe(false) // клиенту «передан в 1С» не нужен

    advanceExchange(db, Date.now() + EXCHANGE_TIMING.toAccepted + 500)
    expect(
      db.notifications.some((n) => n.orderId === id && n.type === 'exchange.accepted' && n.userId === 'c-1a'),
    ).toBe(true)
    expect(db.emails.some((e) => e.kind === 'exchange.accepted' && e.html?.includes(order.erpNumber!))).toBe(true)
    advanceExchange(db, Date.now() + EXCHANGE_TIMING.toAccepted + EXCHANGE_TIMING.toCompleted + 1000)
    expect(db.notifications.some((n) => n.orderId === id && n.type === 'exchange.completed')).toBe(true)
  })

  it('ошибка передачи в 1С уходит администратору, отклонение и отмена — своим получателям', async () => {
    const db = getDb()
    db.exchange.mode = 'down'
    const id = await submitAsClient()
    await as(approverOf(id))
    await call(approvalsApi.endpoints.approveOrder.initiate({ id, changes: {} }))
    advanceExchange(db, Date.now() + EXCHANGE_TIMING.toError + 500)
    expect(
      db.notifications.some((n) => n.orderId === id && n.type === 'exchange.error' && n.userId === 'u-admin'),
    ).toBe(true)
    expect(db.emails.some((e) => e.kind === 'exchange.error' && e.html?.includes('Нет ответа'))).toBe(true)

    const id2 = await submitAsClient()
    await as(approverOf(id2))
    await call(approvalsApi.endpoints.rejectOrder.initiate({ id: id2, comment: 'Не подходит объём' }))
    expect(
      db.notifications.filter((n) => n.orderId === id2 && n.type === 'order.rejected').map((n) => n.userId),
    ).toEqual(expect.arrayContaining(['c-1a', 'c-1b']))

    const id3 = await submitAsClient()
    await call(ordersViewApi.endpoints.cancelOrder.initiate({ id: id3, comment: 'Передумали' }))
    expect(db.notifications.some((n) => n.orderId === id3 && n.type === 'order.cancelled' && n.userId === 'c-1b')).toBe(
      true,
    )
  })
})

describe('центр уведомлений и подписки (API)', () => {
  it('список, счётчик, отметка прочитанным, только непрочитанные', async () => {
    await submitAsClient()
    await as('c-1b')
    const list = (
      await call<NotificationsResult>(
        notificationsApi.endpoints.listNotifications.initiate(
          { unreadOnly: false, page: 1, pageSize: 50 },
          { forceRefetch: true },
        ),
      )
    ).data!
    expect(list.unread).toBeGreaterThan(0)
    expect(list.rows.every((n) => n.userId === 'c-1b')).toBe(true)
    const count = (
      await call<number>(notificationsApi.endpoints.getUnreadCount.initiate(undefined, { forceRefetch: true }))
    ).data!
    expect(count).toBe(list.unread)
    await call(notificationsApi.endpoints.markNotificationsRead.initiate({ ids: [list.rows[0].id] }))
    expect(
      (await call<number>(notificationsApi.endpoints.getUnreadCount.initiate(undefined, { forceRefetch: true }))).data,
    ).toBe(count - 1)
    await call(notificationsApi.endpoints.markNotificationsRead.initiate({ all: true }))
    const unread = (
      await call<NotificationsResult>(
        notificationsApi.endpoints.listNotifications.initiate(
          { unreadOnly: true, page: 1, pageSize: 50 },
          { forceRefetch: true },
        ),
      )
    ).data!
    expect(unread.total).toBe(0)
  })

  it('пользователь настраивает свои подписки; администратор — подписки пользователей клиента', async () => {
    await as('c-1a')
    await call(
      notificationsApi.endpoints.setMySubscriptions.initiate({
        notifyEmail: false,
        mutedTypes: ['order.approved', 'bogus' as never],
      }),
    )
    expect(
      (
        await call<Subscriptions>(
          notificationsApi.endpoints.getMySubscriptions.initiate(undefined, { forceRefetch: true }),
        )
      ).data,
    ).toEqual({ notifyEmail: false, mutedTypes: ['order.approved'] })
    // клиент не управляет чужими подписками
    expect(
      (
        await call(
          notificationsApi.endpoints.setUserSubscriptions.initiate({
            userId: 'c-1b',
            notifyEmail: false,
            mutedTypes: [],
          }),
        )
      ).error?.code,
    ).toBe('forbidden')
    await as('u-admin')
    await call(
      notificationsApi.endpoints.setUserSubscriptions.initiate({
        userId: 'c-1b',
        notifyEmail: true,
        mutedTypes: ['document.uploaded'],
      }),
    )
    expect(getDb().users.find((u) => u.id === 'c-1b')!.mutedTypes).toEqual(['document.uploaded'])
    await call(notificationsApi.endpoints.setCommonEmail.initiate({ clientId: 'cl-1', enabled: false }))
    expect(getDb().clients.find((c) => c.id === 'cl-1')!.notifyCommonEmail).toBe(false)
  })

  it('журнал писем доступен только администратору', async () => {
    await submitAsClient()
    await as('u-mgr1')
    expect(
      (
        await call(
          notificationsApi.endpoints.listEmails.initiate(
            { q: '', kind: '', page: 1, pageSize: 20 },
            { forceRefetch: true },
          ),
        )
      ).error?.code,
    ).toBe('validation')
    await as('u-admin')
    const r = (
      await call<{ rows: { id: string; hasHtml: boolean }[]; total: number }>(
        notificationsApi.endpoints.listEmails.initiate(
          { q: '', kind: 'order.submitted', page: 1, pageSize: 20 },
          { forceRefetch: true },
        ),
      )
    ).data!
    expect(r.total).toBeGreaterThan(0)
    expect(r.rows[0].hasHtml).toBe(true)
    const mail = (
      await call<{ html?: string; from: string }>(
        notificationsApi.endpoints.getEmail.initiate(r.rows[0].id, { forceRefetch: true }),
      )
    ).data!
    expect(mail.html).toContain('<table')
    expect(mail.from).toBe('noreply@basf-demo.ru')
  })
})

describe('журнал действий и настройки', () => {
  const log = (patch: Partial<AuditQuery> = {}) =>
    call<AuditResult>(
      auditApi.endpoints.listAudit.initiate(
        { q: '', entity: '', userId: '', from: '', to: '', page: 1, pageSize: 100, ...patch },
        { forceRefetch: true },
      ),
    )

  it('действия записываются: кто, что, с какими изменениями', async () => {
    await as('u-admin')
    const c = getDb().clients[0]
    const oldPhone = c.phone
    await call(
      clientsApi.endpoints.updateRequisites.initiate({
        id: c.id,
        code: c.code,
        name: c.name,
        email: c.email,
        inn: c.inn,
        kpp: c.kpp,
        legalAddress: c.legalAddress,
        phone: '+7 900 000-00-01',
        regionIds: c.regionIds,
        active: c.active,
      }),
    )
    await call(
      rolesApi.endpoints.saveRole.initiate({
        id: 'role-viewer',
        name: 'Просмотр',
        type: 'employee',
        description: 'Только просмотр заказов',
        permissions: ['orders.export', 'orders.create'],
        active: true,
      } as never),
    )
    const all = (await log()).data!
    const reqs = all.rows.find((r) => r.entity === 'client' && r.action === 'Изменён')!
    expect(reqs.userName).toContain('Соколова')
    expect(reqs.changes).toEqual([{ field: 'Телефон', from: oldPhone, to: '+7 900 000-00-01' }])
    const role = all.rows.find((r) => r.entity === 'role')!
    expect(role.changes).toEqual([{ field: 'Добавлены разрешения', to: 'Создавать заказы' }])
    expect((await log({ entity: 'role' })).data!.rows.every((r) => r.entity === 'role')).toBe(true)
    expect((await log({ q: 'телефон' })).data!.rows.length).toBeGreaterThan(0)
    expect((await log({ userId: 'u-mgr1' })).data!.total).toBe(0)
  })

  it('журнал виден только с правом просмотра', async () => {
    await as('u-head')
    expect((await log()).error?.code).toBe('forbidden')
  })

  it('настройки: проверка значений, запись изменений в журнал, предупреждение о превышении лимита', async () => {
    await as('u-head')
    expect(
      (await call(settingsApi.endpoints.getSettings.initiate(undefined, { forceRefetch: true }))).error?.code,
    ).toBe('forbidden')
    await as('u-admin')
    const cur = (
      await call<SettingsView>(settingsApi.endpoints.getSettings.initiate(undefined, { forceRefetch: true }))
    ).data!.settings
    const upd = (patch: object) =>
      call<SettingsView>(settingsApi.endpoints.updateSettings.initiate({ ...cur, ...patch }))
    expect((await upd({ clientUserLimit: 0 })).error?.code).toBe('validation')
    expect((await upd({ sessionHours: 100 })).error?.code).toBe('validation')
    expect((await upd({ senderEmail: 'плохая' })).error?.code).toBe('validation')
    const ok = (await upd({ clientUserLimit: 1, separateCreateApprove: false, senderEmail: 'orders@basf-demo.ru' }))
      .data!
    expect(ok.clientsOverLimit).toBeGreaterThan(0) // у Агро Комплекта 2 пользователя
    const entry = (await log({ entity: 'settings' })).data!.rows[0]
    expect(entry.changes.map((c) => c.field)).toEqual(
      expect.arrayContaining([
        'Лимит пользователей на клиента',
        'Разделение полномочий: создал ≠ одобрил',
        'Адрес отправителя писем',
      ]),
    )
    expect(getDb().settings.separateCreateApprove).toBe(false)
  })
})
