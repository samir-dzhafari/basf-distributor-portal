import dayjs from 'dayjs'
import { notify } from '@/mocks/notify'
import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { newId } from '@/mocks/db'
import type { Db } from '@/mocks/seed'
import { accessibleClientIds, currentUser } from '@/mocks/access'
import { productAvailability } from '@/shared/lib/availability'
import { calcOrder, checkQty } from '@/shared/lib/money'
import type {
  Application,
  BusinessType,
  Client,
  Consignee,
  DeliveryTerm,
  Id,
  Order,
  PaymentTerm,
  Product,
  Region,
  User,
} from '@/shared/types/domain'
import type { WizardData } from './wizard/validate'

/** Всё, что нужно шагам 1–4 для выбранного клиента. */
export interface OrderContext {
  client: Pick<Client, 'id' | 'name' | 'code' | 'canChooseDelivery' | 'defaultPaymentTermId'>
  consignees: Consignee[]
  regions: Region[]
  businessTypes: BusinessType[]
  paymentTerms: PaymentTerm[]
  deliveryTerms: DeliveryTerm[]
  applications: Application[]
}

export interface OrderProduct extends Product {
  vatRate: number
  groupName: string
  lineName: string
}

export interface OrderProducts {
  products: OrderProduct[]
  groups: { id: Id; name: string }[]
  lines: { id: Id; name: string }[]
}

export interface DraftSummary {
  id: Id
  clientName: string
  createdAt: string
  itemsCount: number
  total: number
}

const today = () => dayjs().startOf('day')

function assertClientAccess(db: Db, user: User, clientId: Id): Client {
  const client = db.clients.find((c) => c.id === clientId)
  if (!client || !client.active || !accessibleClientIds(db, user).has(clientId)) {
    throw new MockError('forbidden', 'Этот клиент вам недоступен')
  }
  return client
}

/** Продукты, которые клиент может заказать в рамках типа бизнеса. */
function orderableProducts(db: Db, client: Client, businessTypeId: Id): OrderProduct[] {
  return db.products
    .filter((p) => productAvailability(p, client.availability, [businessTypeId]).orderable)

    .map((p) => {
      const group = db.productGroups.find((g) => g.id === p.groupId)!
      return {
        ...p,
        vatRate: client.vatRate ?? group.vatRate,
        groupName: group.name,
        lineName: db.productLines.find((l) => l.id === p.lineId)!.name,
      }
    })
}

const cityOf = (address: string) => /г\.\s*([^,]+)/.exec(address)?.[1].trim() ?? ''

function toDraftOrder(db: Db, user: User, d: WizardData, existing?: Order): Order {
  const client = d.clientId ? db.clients.find((c) => c.id === d.clientId) : undefined
  const items = Object.entries(d.qty).flatMap(([productId, qty], i) => {
    const p = db.products.find((x) => x.id === productId)
    if (!p || !client) return []
    const vatRate = client.vatRate ?? db.productGroups.find((g) => g.id === p.groupId)!.vatRate
    return [{ id: `oi-${existing?.id ?? 'new'}-${i + 1}`, productId, qty, price: p.price, vatRate }]
  })
  const role = db.roles.find((r) => r.id === user.roleId)
  const commentKey = user.kind === 'client' ? 'client' : role?.fullAccess ? 'admin' : 'manager'
  const consignee = db.consignees.find((c) => c.id === d.consigneeId)
  return {
    id: existing?.id ?? newId('or'),
    number: existing?.number ?? '',
    status: 'draft',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    createdById: existing?.createdById ?? user.id,
    clientId: d.clientId,
    consigneeId: d.consigneeId,
    regionId: d.regionId,
    city: consignee ? cityOf(consignee.address) : '',
    businessTypeId: d.businessTypeId,
    applicationId: d.applicationId,
    paymentTermId: d.paymentTermId,
    deliveryTermId: d.deliveryTermId,
    desiredDate: d.desiredDate,
    comments: { ...(existing?.comments ?? {}), [commentKey]: d.comment || undefined },
    items,
    history: existing?.history ?? [],
    documents: existing?.documents ?? [],
  }
}

function toWizard(db: Db, user: User, o: Order): WizardData {
  const key =
    user.kind === 'client' ? 'client' : db.roles.find((r) => r.id === user.roleId)?.fullAccess ? 'admin' : 'manager'
  return {
    draftId: o.id,
    clientId: o.clientId,
    consigneeId: o.consigneeId,
    regionId: o.regionId,
    businessTypeId: o.businessTypeId,
    paymentTermId: o.paymentTermId,
    deliveryTermId: o.deliveryTermId,
    desiredDate: o.desiredDate,
    applicationId: o.applicationId,
    qty: Object.fromEntries(o.items.map((i) => [i.productId, i.qty])),
    comment: o.comments[key] ?? '',
  }
}

function ownDraft(db: Db, user: User, id: Id): Order {
  const o = db.orders.find((x) => x.id === id)
  if (!o || o.status !== 'draft' || o.createdById !== user.id) throw new MockError('notFound', 'Черновик не найден')
  return o
}

function nextNumber(db: Db) {
  const max = db.orders.reduce((m, o) => Math.max(m, Number(/(\d+)$/.exec(o.number)?.[1] ?? 0)), 0)
  return `P-${String(max + 1).padStart(6, '0')}`
}

export const ordersApi = api.injectEndpoints({
  endpoints: (b) => ({
    /** Клиенты, за которых пользователь может оформить заказ (для клиента — только его компания). */
    getOrderClients: b.query<Pick<Client, 'id' | 'name' | 'code'>[], void>({
      queryFn: (_a, qa) =>
        mock((db) => {
          const user = currentUser(db, qa)
          const ids = accessibleClientIds(db, user)
          return db.clients
            .filter((c) => c.active && ids.has(c.id))
            .map(({ id, name, code }) => ({ id, name, code }))
            .sort((a, b2) => a.name.localeCompare(b2.name, 'ru'))
        }),
      providesTags: ['Client'],
    }),

    getOrderContext: b.query<OrderContext, Id>({
      queryFn: (clientId, qa) =>
        mock((db) => {
          const client = assertClientAccess(db, currentUser(db, qa), clientId)
          const t = today()
          const businessTypes = db.businessTypes.filter(
            (bt) => client.businessTypeIds.includes(bt.id) && (!bt.validTo || !dayjs(bt.validTo).isBefore(t)),
          )
          return {
            client: {
              id: client.id,
              name: client.name,
              code: client.code,
              canChooseDelivery: client.canChooseDelivery,
              defaultPaymentTermId: client.defaultPaymentTermId,
            },
            consignees: db.consignees.filter((c) => c.clientId === clientId),
            regions: db.regions.filter((r) => client.regionIds.includes(r.id)),
            businessTypes,
            paymentTerms: db.paymentTerms.filter((p) => client.paymentTermIds.includes(p.id)),
            deliveryTerms: db.deliveryTerms.filter((d) => client.deliveryTermIds.includes(d.id)),
            applications: db.applications.filter(
              (a) => a.clientId === clientId && a.active && !dayjs(a.validTo).isBefore(t),
            ),
          }
        }),
    }),

    getOrderProducts: b.query<OrderProducts, { clientId: Id; businessTypeId: Id }>({
      queryFn: ({ clientId, businessTypeId }, qa) =>
        mock((db) => {
          const client = assertClientAccess(db, currentUser(db, qa), clientId)
          const products = orderableProducts(db, client, businessTypeId).sort((a, b2) =>
            a.name.localeCompare(b2.name, 'ru'),
          )
          const uniq = <T extends { id: Id }>(arr: T[]) => [...new Map(arr.map((x) => [x.id, x])).values()]
          return {
            products,
            groups: uniq(products.map((p) => ({ id: p.groupId, name: p.groupName }))),
            lines: uniq(products.map((p) => ({ id: p.lineId, name: p.lineName }))),
          }
        }),
    }),

    listMyDrafts: b.query<DraftSummary[], void>({
      queryFn: (_a, qa) =>
        mock((db) => {
          const user = currentUser(db, qa)
          return db.orders
            .filter((o) => o.status === 'draft' && o.createdById === user.id)
            .sort((a, b2) => b2.createdAt.localeCompare(a.createdAt))
            .map((o) => ({
              id: o.id,
              clientName: db.clients.find((c) => c.id === o.clientId)?.name ?? 'Клиент не выбран',
              createdAt: o.createdAt,
              itemsCount: o.items.length,
              total: calcOrder(o.items).gross,
            }))
        }),
      providesTags: ['Order'],
    }),

    getDraft: b.query<WizardData, Id>({
      queryFn: (id, qa) =>
        mock((db) => {
          const user = currentUser(db, qa)
          return toWizard(db, user, ownDraft(db, user, id))
        }),
      providesTags: (_r, _e, id) => [{ type: 'Order', id }],
    }),

    saveDraft: b.mutation<{ id: Id }, WizardData>({
      queryFn: (d, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            if (d.clientId) assertClientAccess(db, user, d.clientId)
            if (d.draftId) {
              const existing = ownDraft(db, user, d.draftId)
              Object.assign(existing, toDraftOrder(db, user, d, existing))
              return { id: existing.id }
            }
            const order = toDraftOrder(db, user, d)
            db.orders.unshift(order)
            return { id: order.id }
          },
          { write: true },
        ),
      invalidatesTags: ['Order'],
    }),

    deleteDraft: b.mutation<void, Id>({
      queryFn: (id, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            ownDraft(db, user, id)
            db.orders = db.orders.filter((o) => o.id !== id)
          },
          { write: true },
        ),
      invalidatesTags: ['Order'],
    }),

    submitOrder: b.mutation<{ id: Id; number: string }, WizardData>({
      queryFn: (d, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            const client = assertClientAccess(db, user, d.clientId)
            const fail: (m: string) => never = (m) => {
              throw new MockError('validation', m)
            }
            if (!db.consignees.some((c) => c.id === d.consigneeId && c.clientId === client.id))
              fail('Выберите грузополучателя клиента')
            if (!client.regionIds.includes(d.regionId)) fail('Регион не подходит этому клиенту')
            if (!client.businessTypeIds.includes(d.businessTypeId)) fail('Тип бизнеса не подходит этому клиенту')
            if (!client.paymentTermIds.includes(d.paymentTermId)) fail('Условие оплаты недоступно этому клиенту')
            if (!client.deliveryTermIds.includes(d.deliveryTermId)) fail('Условие поставки недоступно этому клиенту')
            if (!d.desiredDate || dayjs(d.desiredDate).isBefore(today().add(1, 'day')))
              fail('Желаемая дата поставки — не раньше завтрашнего дня')
            const app = db.applications.find((a) => a.id === d.applicationId)
            if (
              !app ||
              app.clientId !== client.id ||
              app.regionId !== d.regionId ||
              app.businessTypeId !== d.businessTypeId
            ) {
              fail('Приложение не подходит под выбранные регион и тип бизнеса')
            }
            const available = new Map(orderableProducts(db, client, d.businessTypeId).map((p) => [p.id, p]))
            const ids = Object.keys(d.qty)
            if (!ids.length) fail('Добавьте в заказ хотя бы один продукт')
            for (const id of ids) {
              const p = available.get(id)
              if (!p) fail('В заказе есть продукт, который недоступен этому клиенту')
              else if (!checkQty(d.qty[id], p.minQty, p.multiple).ok) fail(`Проверьте количество: ${p.name}`)
            }

            const draft = toDraftOrder(db, user, d, d.draftId ? ownDraft(db, user, d.draftId) : undefined)
            const now = new Date().toISOString()
            const order: Order = {
              ...draft,
              number: nextNumber(db),
              status: 'pending',
              createdAt: now,
              responsibleId: app.responsibleIds[0],
              history: [
                ...draft.history,
                { id: newId('h'), at: now, userId: user.id, action: 'Заказ создан и отправлен на одобрение' },
              ],
            }
            const idx = db.orders.findIndex((o) => o.id === order.id)
            if (idx >= 0) db.orders[idx] = order
            else db.orders.unshift(order)
            notify(db, 'order.submitted', order, { actorId: user.id })
            return { id: order.id, number: order.number }
          },
          { write: true },
        ),
      invalidatesTags: ['Order'],
    }),
  }),
})

export const {
  useGetOrderClientsQuery,
  useGetOrderContextQuery,
  useGetOrderProductsQuery,
  useListMyDraftsQuery,
  useGetDraftQuery,
  useSaveDraftMutation,
  useDeleteDraftMutation,
  useSubmitOrderMutation,
} = ordersApi
