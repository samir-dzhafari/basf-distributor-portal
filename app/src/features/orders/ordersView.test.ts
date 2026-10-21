import { beforeEach, describe, expect, it } from 'vitest'
import { store } from '@/app/store'
import { authApi } from '@/features/auth/authApi'
import { logout } from '@/features/auth/authSlice'
import { getDb, resetDb } from '@/mocks/db'
import { api } from '@/app/api'
import { defaultQuery } from './list/orderFilters'
import { ordersViewApi, type OrderListResult, type OrderView } from './ordersViewApi'

type Result<T> = { data?: T; error?: { code: string; message: string } }
const call = <T>(thunk: unknown) => (store.dispatch as (a: unknown) => Promise<Result<T>>)(thunk)
const login = (id: string) => store.dispatch(authApi.endpoints.demoLogin.initiate(id))
const list = (patch = {}) =>
  call<OrderListResult>(
    ordersViewApi.endpoints.listOrders.initiate({ ...defaultQuery(), pageSize: 50, ...patch }, { forceRefetch: true }),
  )
const get = (id: string) => call<OrderView>(ordersViewApi.endpoints.getOrder.initiate(id, { forceRefetch: true }))
const mut = <T = void>(thunk: unknown) => call<T>(thunk)

beforeEach(() => {
  resetDb()
  store.dispatch(logout())
  store.dispatch(api.util.resetApiState())
})

describe('видимость заказов', () => {
  it('клиент видит только заказы своей компании', async () => {
    await login('c-1a')
    const r = await list()
    expect(r.data!.rows.length).toBeGreaterThan(0)
    expect(new Set(r.data!.rows.map((o) => o.clientId))).toEqual(new Set(['cl-1']))
  })

  it('черновики видны только автору', async () => {
    const draft = getDb().orders.find(
      (o) => (o.status === 'draft' && o.createdById === 'c-1a') || (o.status === 'draft' && o.createdById === 'c-1b'),
    )!
    await login(draft.createdById)
    expect((await list()).data!.rows.some((o) => o.id === draft.id)).toBe(true)
    store.dispatch(logout())
    await login('u-admin')
    expect((await list()).data!.rows.some((o) => o.id === draft.id)).toBe(false)
    expect((await get(draft.id)).error?.code).toBe('notFound')
  })

  it('менеджер не видит заказы чужого региона, а ответственный по приложению — видит', async () => {
    const foreign = getDb().orders.find((o) => o.regionId === 'rg-far' && o.status !== 'draft')!
    await login('u-mgr2')
    expect((await list()).data!.rows.some((o) => o.id === foreign.id)).toBe(false)
    const app = getDb().applications.find((a) => a.id === foreign.applicationId)!
    app.responsibleIds.push('u-mgr2')
    expect((await get(foreign.id)).data?.order.id).toBe(foreign.id)
  })

  it('фильтры по статусу и поиск, счётчики не зависят от фильтра статуса', async () => {
    await login('u-admin')
    const all = (await list()).data!
    const pending = (await list({ statuses: ['pending'] })).data!
    expect(pending.rows.every((o) => o.status === 'pending')).toBe(true)
    expect(pending.counts).toEqual(all.counts)
    const byNumber = (await list({ q: all.rows[0].number })).data!
    expect(byNumber.rows[0].id).toBe(all.rows[0].id)
  })
})

describe('действия с заказом', () => {
  const pendingOrder = () => getDb().orders.find((o) => o.status === 'pending' && o.clientId === 'cl-1')!

  it('отмена требует причину и пишется в историю', async () => {
    await login('c-1a')
    const o = pendingOrder()
    const noReason = await mut(ordersViewApi.endpoints.cancelOrder.initiate({ id: o.id, comment: '  ' }))
    expect(noReason.error?.code).toBe('validation')
    await mut(ordersViewApi.endpoints.cancelOrder.initiate({ id: o.id, comment: 'Ошибся количеством' }))
    const v = (await get(o.id)).data!
    expect(v.order.status).toBe('cancelled')
    expect(v.history[0]).toMatchObject({ action: 'Заказ отменён', details: 'Ошибся количеством' })
  })

  it('заказ, переданный в 1С, отменить нельзя', async () => {
    await login('u-admin')
    const sent = getDb().orders.find((o) => o.status === 'accepted')!
    const r = await mut(ordersViewApi.endpoints.cancelOrder.initiate({ id: sent.id, comment: 'Просто так' }))
    expect(r.error?.code).toBe('forbidden')
  })

  it('клиент не может править шапку, сотрудник — может, с записью в историю', async () => {
    const o = pendingOrder()
    const other = getDb().consignees.find((c) => c.clientId === 'cl-1' && c.id !== o.consigneeId)!
    const patch = {
      id: o.id,
      consigneeId: other.id,
      regionId: o.regionId,
      deliveryTermId: o.deliveryTermId,
      applicationId: o.applicationId,
    }

    await login('c-1a')
    expect((await get(o.id)).data!.can.edit).toBe(false)
    expect((await mut(ordersViewApi.endpoints.updateOrderHeader.initiate(patch))).error?.code).toBe('forbidden')

    store.dispatch(logout())
    await login('u-admin')
    await mut(ordersViewApi.endpoints.updateOrderHeader.initiate(patch))
    const v = (await get(o.id)).data!
    expect(v.order.consigneeId).toBe(other.id)
    expect(v.history[0].action).toBe('Изменена шапка заказа')
    expect(v.history[0].details).toContain('Грузополучатель')
  })

  it('приложение не подходящее под регион отклоняется', async () => {
    await login('u-admin')
    const o = pendingOrder()
    const wrong = getDb().applications.find((a) => a.clientId !== o.clientId)!
    const r = await mut(
      ordersViewApi.endpoints.updateOrderHeader.initiate({
        id: o.id,
        consigneeId: o.consigneeId,
        regionId: o.regionId,
        deliveryTermId: o.deliveryTermId,
        applicationId: wrong.id,
      }),
    )
    expect(r.error?.code).toBe('validation')
  })

  it('комментарий сотрудника редактируется, клиент — нет; документы: загрузка и скачивание', async () => {
    const o = pendingOrder()
    await login('c-1a')
    expect((await get(o.id)).data!.can.comment).toBeNull()

    store.dispatch(logout())
    await login('u-admin')
    expect((await get(o.id)).data!.can.comment).toBe('admin')
    await mut(ordersViewApi.endpoints.saveOrderComment.initiate({ id: o.id, text: 'Проверено' }))
    expect((await get(o.id)).data!.order.comments.admin).toBe('Проверено')

    await mut(
      ordersViewApi.endpoints.addOrderDocument.initiate({
        id: o.id,
        type: 'УПД',
        fileName: 'upd.pdf',
        size: 10,
        dataUrl: 'data:application/pdf;base64,AAA=',
      }),
    )
    const withDoc = (await get(o.id)).data!
    expect(withDoc.documents).toHaveLength(1)
    expect('dataUrl' in withDoc.documents[0]).toBe(false)
    const file = await mut<{ dataUrl?: string }>(
      ordersViewApi.endpoints.getOrderDocument.initiate({ id: o.id, docId: withDoc.documents[0].id }),
    )
    expect(file.data?.dataUrl).toContain('base64')

    const tooBig = await mut(
      ordersViewApi.endpoints.addOrderDocument.initiate({
        id: o.id,
        type: 'УПД',
        fileName: 'big.pdf',
        size: 2_000_000,
        dataUrl: 'x',
      }),
    )
    expect(tooBig.error?.code).toBe('validation')
  })

  it('выгрузка содержит позиции видимых заказов и недоступна без права', async () => {
    await login('c-1a')
    const mine = await mut<{ orders: { id: string }[]; items: { number: string }[] }>(
      ordersViewApi.endpoints.exportOrders.initiate(defaultQuery()),
    )
    expect(mine.data!.orders.length).toBeGreaterThan(0)
    expect(mine.data!.items.length).toBeGreaterThanOrEqual(mine.data!.orders.length)
    expect(mine.data!.orders.every((o) => getDb().orders.find((x) => x.id === o.id)!.clientId === 'cl-1')).toBe(true)

    store.dispatch(logout())
    getDb().roles.find((r) => r.id === 'role-client')!.permissions = []
    await login('c-1a')
    expect((await mut(ordersViewApi.endpoints.exportOrders.initiate(defaultQuery()))).error?.code).toBe('forbidden')
  })
})
