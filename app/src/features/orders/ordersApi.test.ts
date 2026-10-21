import dayjs from 'dayjs'
import { beforeEach, describe, expect, it } from 'vitest'
import { store } from '@/app/store'
import { authApi } from '@/features/auth/authApi'
import { logout } from '@/features/auth/authSlice'
import { getDb, resetDb } from '@/mocks/db'
import { ordersApi } from './ordersApi'
import { emptyWizard, type WizardData } from './wizard/validate'

const login = (userId: string) => store.dispatch(authApi.endpoints.demoLogin.initiate(userId))
const call = <T>(thunk: unknown) => (store.dispatch as (a: unknown) => Promise<T>)(thunk)

async function validOrder(): Promise<WizardData> {
  const ctx = (
    await call<{ data: import('./ordersApi').OrderContext }>(ordersApi.endpoints.getOrderContext.initiate('cl-1'))
  ).data
  const bt = ctx.businessTypes.find((b) => b.id === 'bt-regular')!
  const app = ctx.applications.find((a) => a.regionId === 'rg-far' && a.businessTypeId === bt.id)!
  const products = (
    await call<{ data: import('./ordersApi').OrderProducts }>(
      ordersApi.endpoints.getOrderProducts.initiate({ clientId: 'cl-1', businessTypeId: bt.id }),
    )
  ).data.products
  const p = products[0]
  return {
    ...emptyWizard(),
    clientId: 'cl-1',
    consigneeId: ctx.consignees[0].id,
    regionId: 'rg-far',
    businessTypeId: bt.id,
    paymentTermId: ctx.paymentTerms[0].id,
    deliveryTermId: ctx.deliveryTerms[0].id,
    desiredDate: dayjs().add(5, 'day').format('YYYY-MM-DD'),
    applicationId: app.id,
    qty: { [p.id]: p.multiple * 2 },
  }
}

beforeEach(() => {
  resetDb()
  store.dispatch(logout())
  store.dispatch(ordersApi.util.resetApiState())
})

describe('заказ: доступ и отправка', () => {
  it('клиент видит только свою компанию и не получает чужой контекст', async () => {
    await login('c-1a')
    const clients = await call<{ data: { id: string }[] }>(ordersApi.endpoints.getOrderClients.initiate())
    expect(clients.data.map((c) => c.id)).toEqual(['cl-1'])
    const other = await call<{ error?: { code: string } }>(ordersApi.endpoints.getOrderContext.initiate('cl-2'))
    expect(other.error?.code).toBe('forbidden')
  })

  it('менеджер видит клиентов своей зоны ответственности', async () => {
    await login('u-mgr2')
    const clients = await call<{ data: { id: string }[] }>(ordersApi.endpoints.getOrderClients.initiate())
    expect(clients.data.map((c) => c.id).sort()).toEqual(['cl-2', 'cl-4', 'cl-5'])
  })

  it('корректный заказ уходит на одобрение с номером и историей', async () => {
    await login('c-1a')
    const r = await call<{ data: { id: string; number: string } }>(
      ordersApi.endpoints.submitOrder.initiate(await validOrder()),
    )
    const order = getDb().orders.find((o) => o.id === r.data.id)!
    expect(order.status).toBe('pending')
    expect(order.number).toMatch(/^P-\d{6}$/)
    expect(order.history.at(-1)?.action).toMatch(/отправлен на одобрение/)
    expect(order.responsibleId).toBeTruthy()
  })

  it('количество не кратное упаковке отклоняется', async () => {
    await login('c-1a')
    const d = await validOrder()
    const id = Object.keys(d.qty)[0]
    d.qty[id] += 1
    const r = await call<{ error?: { code: string } }>(ordersApi.endpoints.submitOrder.initiate(d))
    expect(r.error?.code).toBe('validation')
  })

  it('черновик сохраняется, продолжается и превращается в заказ', async () => {
    await login('c-1a')
    const d = await validOrder()
    const saved = await call<{ data: { id: string } }>(ordersApi.endpoints.saveDraft.initiate(d))
    const loaded = await call<{ data: WizardData }>(ordersApi.endpoints.getDraft.initiate(saved.data.id))
    expect(loaded.data.qty).toEqual(d.qty)
    const sent = await call<{ data: { id: string } }>(ordersApi.endpoints.submitOrder.initiate(loaded.data))
    expect(sent.data.id).toBe(saved.data.id)
    expect(getDb().orders.find((o) => o.id === sent.data.id)?.status).toBe('pending')
  })
})
