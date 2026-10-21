import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '@/app/api'
import { store } from '@/app/store'
import { authApi } from '@/features/auth/authApi'
import { logout } from '@/features/auth/authSlice'
import { getDb, resetDb } from '@/mocks/db'
import { analyzeImport, applyImport, type ImportInput } from '@/mocks/clientsImport'
import { clientsApi, type ClientsList, type ClientsQuery } from './clientsApi'

type Result<T> = { data?: T; error?: { code: string; message: string } }
const call = <T = void>(thunk: unknown) => (store.dispatch as (a: unknown) => Promise<Result<T>>)(thunk)
const as = async (id: string) => {
  store.dispatch(logout())
  store.dispatch(api.util.resetApiState())
  await store.dispatch(authApi.endpoints.demoLogin.initiate(id))
}
const baseQuery: ClientsQuery = {
  q: '',
  regionId: '',
  groupId: '',
  status: 'all',
  page: 1,
  pageSize: 50,
  sortBy: 'name',
  sortDir: 'asc',
}
const list = (patch: Partial<ClientsQuery> = {}) =>
  call<ClientsList>(clientsApi.endpoints.listClients.initiate({ ...baseQuery, ...patch }, { forceRefetch: true }))

const requisites = {
  code: 'NEW-001',
  name: 'ООО «Новый партнёр»',
  email: 'info@new-partner.ru',
  inn: '5012345678',
  kpp: '501201001',
  legalAddress: 'г. Липецк, ул. Мира, д. 1',
  phone: '+7 900 111-22-33',
  regionIds: ['rg-west'],
  active: true,
}

beforeEach(() => {
  resetDb()
  store.dispatch(logout())
  store.dispatch(api.util.resetApiState())
})

describe('список клиентов', () => {
  it('администратор видит всех, руководитель региона — своих, менеджер без права — ничего', async () => {
    await as('u-admin')
    expect((await list()).data!.total).toBe(10)
    await as('u-head')
    const head = (await list()).data!
    expect(head.total).toBeGreaterThan(0)
    expect(head.total).toBeLessThan(10)
    await as('u-mgr1')
    expect((await list()).error?.code).toBe('forbidden')
    await as('c-1a')
    expect((await list()).error?.code).toBe('forbidden')
  })

  it('поиск, статус, регион и группа', async () => {
    await as('u-admin')
    expect((await list({ q: 'Агрохим' })).data!.rows.map((r) => r.name)).toEqual(['ООО «Агрохим»'])
    expect((await list({ q: getDb().clients[3].inn })).data!.total).toBe(1)
    expect((await list({ status: 'inactive' })).data!.rows.every((r) => !r.active)).toBe(true)
    expect((await list({ groupId: 'cg-south' })).data!.total).toBe(3)
    expect((await list({ groupId: 'none' })).data!.rows.every((r) => !r.groupName)).toBe(true)
    expect((await list({ regionId: 'rg-far' })).data!.rows.map((r) => r.regionNames)).toEqual([['Дальний Восток']])
  })
})

describe('реквизиты и условия', () => {
  it('создание клиента, проверка ИНН/КПП/кода и уникальности', async () => {
    await as('u-head')
    const bad = await call(clientsApi.endpoints.createClient.initiate({ ...requisites, inn: '123' }))
    expect(bad.error?.code).toBe('validation')
    const dup = await call(clientsApi.endpoints.createClient.initiate({ ...requisites, code: getDb().clients[0].code }))
    expect(dup.error?.message).toMatch(/кодом 1С/)
    const ok = await call<{ id: string }>(clientsApi.endpoints.createClient.initiate(requisites))
    expect(ok.data!.id).toBeTruthy()
    // создавший видит клиента, хотя регион «Запад» вне его зоны
    expect((await list({ q: 'Новый партнёр' })).data!.total).toBe(1)
    const sameInn = await call(clientsApi.endpoints.createClient.initiate({ ...requisites, code: 'NEW-002' }))
    expect(sameInn.error?.message).toMatch(/ИНН и КПП/)
  })

  it('условия: оплата по умолчанию должна быть среди выбранных', async () => {
    await as('u-admin')
    const c = getDb().clients[1]
    const conditions = {
      paymentTermIds: ['pt-30'],
      defaultPaymentTermId: 'pt-prepay',
      businessTypeIds: ['bt-regular'],
      deliveryTermIds: ['dt-pickup'],
      canChooseDelivery: false,
      availability: c.availability,
    }
    expect((await call(clientsApi.endpoints.updateConditions.initiate({ id: c.id, conditions }))).error?.code).toBe(
      'validation',
    )
    await call(
      clientsApi.endpoints.updateConditions.initiate({
        id: c.id,
        conditions: { ...conditions, defaultPaymentTermId: 'pt-30', vatRate: 10 },
      }),
    )
    expect(getDb().clients[1]).toMatchObject({ paymentTermIds: ['pt-30'], deliveryTermIds: ['dt-pickup'], vatRate: 10 })
  })

  it('отключённый клиент: его пользователи не входят', async () => {
    await as('u-admin')
    await call(clientsApi.endpoints.setClientsActive.initiate({ ids: ['cl-1'], active: false }))
    store.dispatch(logout())
    const r = await store.dispatch(authApi.endpoints.demoLogin.initiate('c-1a'))
    expect('error' in r).toBe(true)
  })
})

describe('пользователи и грузополучатели', () => {
  it('новый пользователь получает приглашение; почта уникальна; есть лимит', async () => {
    await as('u-admin')
    const add = (email: string) =>
      call<{ inviteLink: string }>(
        clientsApi.endpoints.addClientUser.initiate({
          clientId: 'cl-3',
          email,
          firstName: 'Анна',
          lastName: 'Тестова',
          phone: '',
        }),
      )
    const first = await add('anna@agroliga.ru')
    expect(first.data!.inviteLink).toMatch(/^\/activate\//)
    expect(getDb().users.find((u) => u.email === 'anna@agroliga.ru')).toMatchObject({
      status: 'invited',
      clientId: 'cl-3',
      roleId: 'role-client',
    })
    expect(getDb().emails.at(-1)?.to).toBe('anna@agroliga.ru')
    expect((await add('ANNA@agroliga.ru')).error?.message).toMatch(/уникальной/)
    getDb().settings.clientUserLimit = 2
    expect((await add('b@agroliga.ru')).error?.message).toMatch(/лимит/)
  })

  it('заблокированный пользователь не входит, разблокировка возвращает доступ', async () => {
    await as('u-admin')
    await call(clientsApi.endpoints.setClientUserBlocked.initiate({ userId: 'c-1b', blocked: true }))
    expect(getDb().users.find((u) => u.id === 'c-1b')!.status).toBe('blocked')
    await call(clientsApi.endpoints.setClientUserBlocked.initiate({ userId: 'c-1b', blocked: false }))
    expect(getDb().users.find((u) => u.id === 'c-1b')!.status).toBe('active')
  })

  it('повторное приглашение — только тем, кто ещё не активировался', async () => {
    await as('u-admin')
    expect((await call(clientsApi.endpoints.resendInvite.initiate({ userId: 'c-1a' }))).error?.code).toBe('validation')
    expect(
      (await call<{ inviteLink: string }>(clientsApi.endpoints.resendInvite.initiate({ userId: 'c-10' }))).data!
        .inviteLink,
    ).toBeTruthy()
  })

  it('грузополучателя из заказов удалить нельзя, остальных — можно', async () => {
    await as('u-admin')
    const used = getDb().orders.find((o) => o.clientId === 'cl-1')!.consigneeId
    expect(
      (await call(clientsApi.endpoints.deleteConsignee.initiate({ clientId: 'cl-1', id: used }))).error?.message,
    ).toMatch(/в заказах/)
    await call(
      clientsApi.endpoints.saveConsignee.initiate({ clientId: 'cl-3', code: 'X1', name: 'Склад', address: 'г. Тула' }),
    )
    const created = getDb().consignees.find((c) => c.code === 'X1')!
    expect(
      (
        await call(
          clientsApi.endpoints.saveConsignee.initiate({ clientId: 'cl-3', code: 'X1', name: 'Дубль', address: 'a' }),
        )
      ).error?.code,
    ).toBe('validation')
    await call(clientsApi.endpoints.deleteConsignee.initiate({ clientId: 'cl-3', id: created.id }))
    expect(getDb().consignees.some((c) => c.id === created.id)).toBe(false)
  })
})

describe('группы клиентов', () => {
  it('создание группы с участниками и массовое применение шаблона', async () => {
    await as('u-admin')
    const template = {
      paymentTermIds: ['pt-60'],
      defaultPaymentTermId: 'pt-60',
      businessTypeIds: ['bt-szr'],
      deliveryTermIds: ['dt-pickup'],
      canChooseDelivery: true,
      vatRate: 10,
      availability: { closedGroupIds: ['pg-herb'], closedLineIds: [], closedProductIds: [], openedProductIds: [] },
    }
    const g = await call<{ id: string }>(
      clientsApi.endpoints.saveClientGroup.initiate({
        name: 'Особые',
        description: '',
        template,
        memberIds: ['cl-3', 'cl-6'],
      }),
    )
    expect(
      getDb()
        .clients.filter((c) => c.groupId === g.data!.id)
        .map((c) => c.id),
    ).toEqual(['cl-3', 'cl-6'])
    expect(
      (await call(clientsApi.endpoints.applyGroupTemplate.initiate({ groupId: g.data!.id, sections: [] }))).error?.code,
    ).toBe('validation')

    const r = await call<{ applied: number }>(
      clientsApi.endpoints.applyGroupTemplate.initiate({
        groupId: g.data!.id,
        sections: ['payment', 'vat', 'assortment'],
      }),
    )
    expect(r.data!.applied).toBe(2)
    const c3 = getDb().clients.find((c) => c.id === 'cl-3')!
    expect(c3.paymentTermIds).toEqual(['pt-60'])
    expect(c3.vatRate).toBe(10)
    expect(c3.availability.closedGroupIds).toEqual(['pg-herb'])
    expect(c3.businessTypeIds).toEqual(['bt-regular']) // раздел не выбран — не тронут
    expect(c3.availability).not.toBe(template.availability) // копия, не ссылка
  })

  it('удаление группы снимает привязку у клиентов', async () => {
    await as('u-admin')
    await call(clientsApi.endpoints.deleteClientGroup.initiate('cg-south'))
    expect(getDb().clients.some((c) => c.groupId === 'cg-south')).toBe(false)
  })
})

describe('импорт из Excel', () => {
  const input = (): ImportInput => ({
    clients: [
      {
        'Код 1С': 'IMP-1',
        Наименование: 'ООО «Импорт»',
        Email: 'imp@mail.ru',
        ИНН: '7700000001',
        КПП: '770001001',
        'Юридический адрес': 'г. Москва',
        Телефон: '',
        Регионы: 'Юг, Север',
        Активен: 'Да',
      },
      {
        'Код 1С': 'IMP-1',
        Наименование: 'Дубль',
        Email: 'x@mail.ru',
        ИНН: '7700000002',
        КПП: '770001001',
        'Юридический адрес': 'г. Москва',
        Телефон: '',
        Регионы: 'Юг',
        Активен: '',
      },
      {
        'Код 1С': 'IMP-3',
        Наименование: 'Без региона',
        Email: 'плохой',
        ИНН: '12',
        КПП: '',
        'Юридический адрес': '',
        Телефон: '',
        Регионы: 'Марс',
        Активен: 'Нет',
      },
      {
        'Код 1С': getDb().clients[0].code,
        Наименование: 'Переименованный',
        Email: 'a@a.ru',
        ИНН: getDb().clients[0].inn,
        КПП: getDb().clients[0].kpp,
        'Юридический адрес': 'г. Хабаровск',
        Телефон: '',
        Регионы: 'Дальний Восток',
        Активен: 'Да',
      },
    ],
    users: [
      { Email: 'u1@imp.ru', Имя: 'Иван', Фамилия: 'Петров', Телефон: '', 'Код клиента': 'IMP-1' },
      { Email: 'p.ivanov@agrokomplekt.ru', Имя: 'Пётр', Фамилия: 'Иванов', Телефон: '', 'Код клиента': 'IMP-1' },
      { Email: 'u3@imp.ru', Имя: 'Анна', Фамилия: 'Сидорова', Телефон: '', 'Код клиента': 'NOPE' },
    ],
    consignees: [
      { Код: 'G1', Наименование: 'Склад 1', Адрес: 'г. Москва', 'Код клиента': 'IMP-1' },
      { Код: '', Наименование: '', Адрес: '', 'Код клиента': 'IMP-1' },
    ],
  })

  it('проверка находит ошибки по строкам и ничего не меняет', () => {
    const db = getDb()
    const before = db.clients.length
    const { preview } = analyzeImport(db, input())
    expect(db.clients.length).toBe(before)
    expect(preview.counts).toMatchObject({ new: 3, update: 1, error: 5 })
    const msgs = preview.issues.map((i) => `${i.sheet}:${i.row}:${i.message}`)
    expect(msgs).toContain('clients:3:Код IMP-1 повторяется в файле')
    expect(msgs.some((m) => m.startsWith('clients:4:') && m.includes('Неизвестный регион «Марс»'))).toBe(true)
    expect(msgs).toContain('users:3:Пользователь с таким Email уже есть в системе')
    expect(msgs).toContain('users:4:Клиент с кодом «NOPE» не найден')
    expect(preview.lines.clients.map((l) => l.action)).toEqual(['new', 'error', 'error', 'update'])
  })

  it('применение создаёт и обновляет только корректные строки, пользователи получают приглашения', () => {
    const db = getDb()
    const emails = db.emails.length
    const r = applyImport(db, input())
    expect(r).toMatchObject({ new: 3, update: 1, error: 5, invites: 1 })
    const imp = db.clients.find((c) => c.code === 'IMP-1')!
    expect(imp.regionIds).toEqual(['rg-south', 'rg-north'])
    expect(db.users.find((u) => u.email === 'u1@imp.ru')).toMatchObject({ status: 'invited', clientId: imp.id })
    expect(db.emails.length).toBe(emails + 1)
    expect(db.consignees.filter((c) => c.clientId === imp.id)).toHaveLength(1)
    expect(db.clients.find((c) => c.id === 'cl-1')!.legalAddress).toBe('г. Хабаровск')
    expect(db.clients.some((c) => c.code === 'IMP-3')).toBe(false)
  })

  it('через API: предпросмотр и применение доступны только с правом', async () => {
    await as('u-mgr1')
    expect((await call(clientsApi.endpoints.previewClientImport.initiate(input()))).error?.code).toBe('forbidden')
    await as('u-admin')
    const p = await call<{ counts: { new: number } }>(clientsApi.endpoints.previewClientImport.initiate(input()))
    expect(p.data!.counts.new).toBe(3)
  })
})
