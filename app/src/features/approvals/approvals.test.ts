import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '@/app/api'
import { store } from '@/app/store'
import { authApi } from '@/features/auth/authApi'
import { logout } from '@/features/auth/authSlice'
import { getDb, resetDb } from '@/mocks/db'
import { EXCHANGE_TIMING, advanceExchange } from '@/mocks/exchange'
import { exchangeApi } from '../exchange/exchangeApi'
import { ordersViewApi, type OrderView } from '../orders/ordersViewApi'
import { approvalsApi, type QueueRow } from './approvalsApi'

type Result<T> = { data?: T; error?: { code: string; message: string } }
const call = <T = void>(thunk: unknown) => (store.dispatch as (a: unknown) => Promise<Result<T>>)(thunk)
const login = (id: string) => store.dispatch(authApi.endpoints.demoLogin.initiate(id))
const as = async (id: string) => {
  store.dispatch(logout())
  store.dispatch(api.util.resetApiState())
  await login(id)
}
const queue = () =>
  call<QueueRow[]>(approvalsApi.endpoints.getApprovalQueue.initiate(undefined, { forceRefetch: true }))
const order = (id: string) => call<OrderView>(ordersViewApi.endpoints.getOrder.initiate(id, { forceRefetch: true }))
const approve = (id: string, changes = {}, comment?: string) =>
  call<{ number: string }>(approvalsApi.endpoints.approveOrder.initiate({ id, changes, comment }))
const later = (ms: number) => advanceExchange(getDb(), Date.now() + ms)

/** Заказ на одобрении, который не создавала Ирина Воронова (u-app1) и который ей виден. */
const foreignPending = () =>
  getDb().orders.find((o) => o.status === 'pending' && o.createdById !== 'u-app1' && o.clientId === 'cl-1')!

beforeEach(() => {
  resetDb()
  store.dispatch(logout())
  store.dispatch(api.util.resetApiState())
})

describe('очередь одобрения', () => {
  it('одобряющий видит ожидающие заказы, но не созданные им самим', async () => {
    await as('u-app1')
    const own = getDb().orders.find((o) => o.status === 'pending' && o.createdById === 'u-app1')!
    const rows = (await queue()).data!
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.status === 'pending')).toBe(true)
    expect(rows.some((r) => r.id === own.id)).toBe(false)
    // самые давние сверху
    expect(rows.map((r) => r.createdAt)).toEqual([...rows.map((r) => r.createdAt)].sort())
  })

  it('без права «одобрять» очередь пуста; клиент тоже ничего не видит', async () => {
    await as('u-mgr1')
    expect((await queue()).data).toEqual([])
    await as('c-1a')
    expect((await queue()).data).toEqual([])
  })

  it('счётчик совпадает с длиной очереди', async () => {
    await as('u-app1')
    const n = await call<number>(approvalsApi.endpoints.getApprovalCount.initiate(undefined, { forceRefetch: true }))
    expect(n.data).toBe((await queue()).data!.length)
  })
})

describe('решение по заказу', () => {
  it('создатель не может одобрить или отклонить свой заказ', async () => {
    await as('u-app1')
    const own = getDb().orders.find((o) => o.status === 'pending' && o.createdById === 'u-app1')!
    expect((await order(own.id)).data!.can).toMatchObject({ approve: false })
    expect((await order(own.id)).data!.can.approveBlocked).toBeTruthy()
    expect((await approve(own.id)).error?.code).toBe('selfApprove')
    const rej = await call(approvalsApi.endpoints.rejectOrder.initiate({ id: own.id, comment: 'Не подходит' }))
    expect(rej.error?.code).toBe('selfApprove')
  })

  it('правило можно выключить в настройках', async () => {
    getDb().settings.separateCreateApprove = false
    await as('u-app1')
    const own = getDb().orders.find((o) => o.status === 'pending' && o.createdById === 'u-app1')!
    expect((await approve(own.id)).data?.number).toBe(own.number)
  })

  it('сотрудник, изменивший шапку, тоже не одобряет этот заказ', async () => {
    const o = foreignPending()
    await as('u-admin')
    const other = getDb().consignees.find((c) => c.clientId === o.clientId && c.id !== o.consigneeId)!
    await call(
      ordersViewApi.endpoints.updateOrderHeader.initiate({
        id: o.id,
        consigneeId: other.id,
        regionId: o.regionId,
        deliveryTermId: o.deliveryTermId,
        applicationId: o.applicationId,
      }),
    )
    expect((await order(o.id)).data!.can.approveBlocked).toBeTruthy()
    expect((await approve(o.id)).error?.code).toBe('selfApprove')
  })

  it('одобрение с корректировкой: количество вверх/вниз (не кратно), удаление, история, передача в 1С', async () => {
    const o = foreignPending()
    expect(o.items.length).toBeGreaterThanOrEqual(2)
    const [first, second] = o.items
    await as('u-app1')
    const r = await approve(o.id, { [first.id]: first.qty + 7, [second.id]: 0 }, 'Согласовано')
    expect(r.error).toBeUndefined()

    const v = (await order(o.id)).data!
    expect(v.order.status).toBe('sent')
    expect(v.items.find((i) => i.id === first.id)!.qty).toBe(first.qty + 7)
    expect(v.items.some((i) => i.id === second.id)).toBe(false)
    const actions = v.history.map((h) => h.action)
    expect(actions).toEqual(expect.arrayContaining(['Скорректированы позиции', 'Заказ одобрен', 'Заказ передан в 1С']))
    expect(v.history.find((h) => h.action === 'Заказ одобрен')).toMatchObject({ details: 'Согласовано' })
    expect(v.history.find((h) => h.action === 'Заказ одобрен')!.userName).toContain('Воронова')
    expect(v.exchange?.status).toBe('sent')
    // уже не в очереди
    expect((await queue()).data!.some((x) => x.id === o.id)).toBe(false)
  })

  it('нельзя убрать все позиции, добавить новую или указать дробное количество', async () => {
    const o = foreignPending()
    await as('u-app1')
    const all = Object.fromEntries(o.items.map((i) => [i.id, 0]))
    expect((await approve(o.id, all)).error?.code).toBe('validation')
    expect((await approve(o.id, { 'oi-new': 5 })).error?.code).toBe('validation')
    expect((await approve(o.id, { [o.items[0].id]: 2.5 })).error?.code).toBe('validation')
    expect((await order(o.id)).data!.order.status).toBe('pending')
  })

  it('отклонение требует комментарий, фиксирует автора и убирает заказ из очереди', async () => {
    const o = foreignPending()
    await as('u-app1')
    const no = await call(approvalsApi.endpoints.rejectOrder.initiate({ id: o.id, comment: '  ' }))
    expect(no.error?.code).toBe('validation')
    await call(approvalsApi.endpoints.rejectOrder.initiate({ id: o.id, comment: 'Объём не совпадает с приложением' }))
    const v = (await order(o.id)).data!
    expect(v.order.status).toBe('rejected')
    expect(v.history[0]).toMatchObject({ action: 'Заказ отклонён', details: 'Объём не совпадает с приложением' })
    expect(v.history[0].userName).toContain('Воронова')
    expect((await approve(o.id)).error?.code).toBe('forbidden')
  })
})

describe('эмуляция 1С', () => {
  const approveOne = async () => {
    const o = foreignPending()
    await as('u-app1')
    await approve(o.id)
    return o
  }

  it('передан → принят (номер в 1С) → выполнен', async () => {
    const o = await approveOne()
    later(EXCHANGE_TIMING.toAccepted - 500)
    expect((await order(o.id)).data!.order.status).toBe('sent')
    later(EXCHANGE_TIMING.toAccepted + 500)
    const accepted = (await order(o.id)).data!
    expect(accepted.order.status).toBe('accepted')
    expect(accepted.order.erpNumber).toMatch(/^\d{10}$/)
    expect(accepted.history[0].details).toContain(accepted.order.erpNumber!)
    later(EXCHANGE_TIMING.toAccepted + EXCHANGE_TIMING.toCompleted + 1000)
    expect((await order(o.id)).data!.order.status).toBe('completed')
  })

  it('если 1С не отвечает — ошибка; повтор при исправной 1С проходит; повторять может только администратор', async () => {
    getDb().exchange.mode = 'down'
    const o = await approveOne()
    later(EXCHANGE_TIMING.toError + 500)
    const failed = (await order(o.id)).data!
    expect(failed.order.status).toBe('error')
    expect(failed.exchange?.lastError).toMatch(/Нет ответа/)
    expect(failed.can.retry).toBe(false)

    const forbidden = await call(exchangeApi.endpoints.retryExchange.initiate({ orderId: o.id }))
    expect(forbidden.error?.code).toBe('forbidden')

    await as('u-admin')
    expect((await order(o.id)).data!.can.retry).toBe(true)
    await call(exchangeApi.endpoints.setExchangeMode.initiate('ok'))
    const r = await call<{ retried: number }>(exchangeApi.endpoints.retryExchange.initiate({ orderId: o.id }))
    expect(r.data!.retried).toBe(1)
    expect((await order(o.id)).data!.order.status).toBe('sent')
    later(EXCHANGE_TIMING.toAccepted + 500)
    const done = (await order(o.id)).data!
    expect(done.order.status).toBe('accepted')
    expect(done.exchange?.attempts).toBe(2)
    expect(done.history.some((h) => h.action === 'Повторная передача в 1С')).toBe(true)
  })

  it('режим «отклоняет» даёт ошибку с причиной от 1С; обзор показывает счётчики и журнал', async () => {
    getDb().exchange.mode = 'reject'
    const o = await approveOne()
    later(EXCHANGE_TIMING.toError + 500)
    await as('u-admin')
    const ov = (
      await call<import('../exchange/exchangeApi').ExchangeOverview>(
        exchangeApi.endpoints.getExchange.initiate(undefined, { forceRefetch: true }),
      )
    ).data!
    const row = ov.rows.find((x) => x.job.orderId === o.id)!
    expect(row.job.status).toBe('error')
    expect(row.job.lastError).toMatch(/отклонён 1С/)
    expect(ov.counts.error).toBeGreaterThanOrEqual(2) // и заказ из демо-данных с ошибкой
    expect(ov.log.some((l) => l.level === 'error' && l.message.includes(o.number))).toBe(true)
  })

  it('экран обмена недоступен без права', async () => {
    await as('u-app1')
    const r = await call(exchangeApi.endpoints.getExchange.initiate(undefined, { forceRefetch: true }))
    expect(r.error?.code).toBe('forbidden')
  })

  it('ответы API не замораживают мок-БД (иначе следующая передача падает)', async () => {
    await as('u-admin')
    await call(exchangeApi.endpoints.getExchange.initiate(undefined, { forceRefetch: true }))
    const job = getDb().exchange.jobs.find((j) => j.status === 'error')!
    expect(Object.isFrozen(job)).toBe(false)
    expect(() => advanceExchange(getDb(), Date.now() + 60_000)).not.toThrow()
    const r = await call<{ retried: number }>(exchangeApi.endpoints.retryExchange.initiate({}))
    expect(r.error).toBeUndefined()
  })

  it('повторить все ошибки', async () => {
    await as('u-admin')
    const before = getDb().exchange.jobs.filter((j) => j.status === 'error').length
    expect(before).toBeGreaterThan(0)
    const r = await call<{ retried: number }>(exchangeApi.endpoints.retryExchange.initiate({}))
    expect(r.data!.retried).toBe(before)
    expect(getDb().exchange.jobs.filter((j) => j.status === 'error')).toHaveLength(0)
  })
})
