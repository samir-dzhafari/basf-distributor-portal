import dayjs from 'dayjs'
import { notify } from '@/mocks/notify'
import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { newId } from '@/mocks/db'
import { SYSTEM_USER, cancelExchange } from '@/mocks/exchange'
import type { Db } from '@/mocks/seed'
import { canSeeOrder, currentUser, hasPermission } from '@/mocks/access'
import { calcOrder } from '@/shared/lib/money'
import { fullName } from '@/shared/lib/format'
import {
  DOCUMENT_TYPES,
  type Id,
  type Order,
  type OrderDocument,
  type OrderHistoryEntry,
  type OrderItem,
  type OrderStatus,
  type User,
} from '@/shared/types/domain'
import type { OrderFilters, OrderQuery } from './list/orderFilters'

export const MAX_DOCUMENT_BYTES = 1_048_576
/** Отменить можно, пока заказ не ушёл в 1С (фич-лист 11.7). */
export const CANCELLABLE: OrderStatus[] = ['pending', 'error']
/** Шапку можно править до одобрения (фич-лист 11.5). */
export const EDITABLE: OrderStatus[] = ['pending']

export interface OrderRow {
  id: Id
  /** Пустой у черновика. */
  number: string
  erpNumber?: string
  status: OrderStatus
  createdAt: string
  clientId: Id
  clientName: string
  regionName: string
  city: string
  applicationNumber: string
  creatorName: string
  responsibleName?: string
  itemsCount: number
  /** Сумма с НДС. */
  total: number
}

export interface OrderListResult {
  rows: OrderRow[]
  total: number
  /** Количество заказов по статусам при текущих фильтрах, кроме фильтра по статусу. */
  counts: Partial<Record<OrderStatus, number>>
  countsTotal: number
}

export interface OrderFilterOptions {
  clients: { id: Id; name: string }[]
  regions: { id: Id; name: string }[]
  businessTypes: { id: Id; name: string }[]
  creators: { id: Id; name: string }[]
}

export type CommentKey = 'client' | 'manager' | 'admin'

export interface OrderView {
  order: Omit<Order, 'documents' | 'history' | 'items'>
  names: {
    client: string
    consignee: string
    consigneeAddress: string
    region: string
    businessType: string
    application: string
    payment: string
    delivery: string
    creator: string
    responsible?: string
  }
  items: (OrderItem & { code: string; name: string; unit: string; packSize: number })[]
  totals: ReturnType<typeof calcOrder>
  history: (OrderHistoryEntry & { userName: string })[]
  documents: (Omit<OrderDocument, 'dataUrl'> & { uploaderName: string })[]
  /** Состояние обмена с 1С (если заказ уже передавался). */
  exchange?: { status: string; attempts: number; lastError?: string }
  can: {
    edit: boolean
    cancel: boolean
    upload: boolean
    resume: boolean
    /** Можно ли одобрить/отклонить этот заказ. */
    approve: boolean
    /** Почему нельзя одобрить, хотя право есть (разделение полномочий). */
    approveBlocked?: string
    /** Можно ли повторить передачу в 1С. */
    retry: boolean
    /** Какое поле комментария пользователь может править. */
    comment: CommentKey | null
  }
}

export interface ExportData {
  orders: OrderRow[]
  items: {
    number: string
    code: string
    name: string
    qty: number
    unit: string
    price: number
    vatRate: number
    net: number
    gross: number
  }[]
}

// ---------------------------------------------------------------------------------------------

const orderTotal = (o: Order) => calcOrder(o.items).gross
const nameOf = (list: { id: Id; name: string }[], id: Id) => list.find((x) => x.id === id)?.name ?? '—'
export const userName = (db: Db, id?: Id) =>
  id === SYSTEM_USER ? 'Система (1С)' : id ? fullName(db.users.find((u) => u.id === id)) : '—'

const commentKeyOf = (db: Db, user: User): CommentKey =>
  user.kind === 'client' ? 'client' : db.roles.find((r) => r.id === user.roleId)?.fullAccess ? 'admin' : 'manager'

function visibleOrders(db: Db, user: User) {
  return db.orders.filter((o) => canSeeOrder(db, user, o))
}

export function toRow(db: Db, o: Order): OrderRow {
  return {
    id: o.id,
    number: o.number,
    erpNumber: o.erpNumber,
    status: o.status,
    createdAt: o.createdAt,
    clientId: o.clientId,
    clientName: db.clients.find((c) => c.id === o.clientId)?.name ?? '—',
    regionName: nameOf(db.regions, o.regionId),
    city: o.city,
    applicationNumber: db.applications.find((a) => a.id === o.applicationId)?.number ?? '—',
    creatorName: userName(db, o.createdById),
    responsibleName: o.responsibleId ? userName(db, o.responsibleId) : undefined,
    itemsCount: o.items.length,
    total: orderTotal(o),
  }
}

function matches(row: OrderRow, o: Order, f: OrderFilters, withStatus: boolean): boolean {
  if (withStatus && f.statuses.length && !f.statuses.includes(o.status)) return false
  if (f.clientId && o.clientId !== f.clientId) return false
  if (f.regionId && o.regionId !== f.regionId) return false
  if (f.businessTypeId && o.businessTypeId !== f.businessTypeId) return false
  if (f.creatorId && o.createdById !== f.creatorId) return false
  if (f.from && dayjs(o.createdAt).isBefore(dayjs(f.from).startOf('day'))) return false
  if (f.to && dayjs(o.createdAt).isAfter(dayjs(f.to).endOf('day'))) return false
  const q = f.q.trim().toLowerCase()
  if (q) {
    const hay = [row.number, row.erpNumber ?? '', row.applicationNumber, row.clientName].join(' ').toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

function filtered(db: Db, user: User, f: OrderFilters, withStatus = true) {
  return visibleOrders(db, user)
    .map((o) => ({ o, row: toRow(db, o) }))
    .filter(({ o, row }) => matches(row, o, f, withStatus))
}

const SORTERS: Record<OrderQuery['sortBy'], (a: OrderRow, b: OrderRow) => number> = {
  createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
  number: (a, b) => (a.number || '~').localeCompare(b.number || '~'),
  total: (a, b) => a.total - b.total,
  status: (a, b) => a.status.localeCompare(b.status),
}

/** Создал или изменил заказ — значит, одобрить его должен другой сотрудник (фич-лист 4.4). */
export const touchedBy = (o: Order, userId: Id) =>
  o.createdById === userId || o.history.some((h) => h.userId === userId && h.action === 'Изменена шапка заказа')

export const SELF_APPROVE_MESSAGE = 'Вы создали или изменили этот заказ — его должен одобрить другой сотрудник.'

export function viewPermissions(db: Db, user: User, o: Order): OrderView['can'] {
  const employee = user.kind === 'employee'
  const notDraft = o.status !== 'draft'
  const canApproveByRole = employee && hasPermission(db, user, 'orders.approve') && o.status === 'pending'
  const blocked = canApproveByRole && db.settings.separateCreateApprove && touchedBy(o, user.id)
  return {
    approve: canApproveByRole && !blocked,
    approveBlocked: blocked ? SELF_APPROVE_MESSAGE : undefined,
    retry: employee && hasPermission(db, user, 'exchange.manage') && o.status === 'error',
    edit: employee && hasPermission(db, user, 'orders.edit') && EDITABLE.includes(o.status),
    cancel: hasPermission(db, user, 'orders.cancel') && CANCELLABLE.includes(o.status),
    upload: employee && hasPermission(db, user, 'documents.upload') && notDraft && o.status !== 'cancelled',
    resume: o.status === 'draft' && o.createdById === user.id,
    comment:
      employee && hasPermission(db, user, 'orders.edit') && notDraft && o.status !== 'cancelled'
        ? commentKeyOf(db, user)
        : null,
  }
}

export function accessibleOrder(db: Db, user: User, id: Id): Order {
  const o = db.orders.find((x) => x.id === id)
  if (!o || !canSeeOrder(db, user, o)) throw new MockError('notFound', 'Заказ не найден или недоступен вам')
  return o
}

export const log = (o: Order, user: User, action: string, details?: string) =>
  o.history.push({ id: newId('h'), at: new Date().toISOString(), userId: user.id, action, details })

export const tags = (id: Id) => [
  { type: 'Order' as const, id },
  { type: 'Order' as const, id: 'LIST' },
]

// ---------------------------------------------------------------------------------------------

export interface HeaderPatch {
  id: Id
  consigneeId: Id
  regionId: Id
  deliveryTermId: Id
  applicationId: Id
}

export const ordersViewApi = api.injectEndpoints({
  endpoints: (b) => ({
    listOrders: b.query<OrderListResult, OrderQuery>({
      queryFn: (q, qa) =>
        mock((db) => {
          const user = currentUser(db, qa)
          const base = filtered(db, user, q, false)
          const counts: OrderListResult['counts'] = {}
          base.forEach(({ o }) => (counts[o.status] = (counts[o.status] ?? 0) + 1))
          const list = base.filter(({ o }) => !q.statuses.length || q.statuses.includes(o.status)).map((x) => x.row)
          const sign = q.sortDir === 'asc' ? 1 : -1
          list.sort((a, b2) => sign * SORTERS[q.sortBy](a, b2) || b2.createdAt.localeCompare(a.createdAt))
          const start = (q.page - 1) * q.pageSize
          return { rows: list.slice(start, start + q.pageSize), total: list.length, counts, countsTotal: base.length }
        }),
      providesTags: [{ type: 'Order', id: 'LIST' }],
    }),

    getOrderFilterOptions: b.query<OrderFilterOptions, void>({
      queryFn: (_a, qa) =>
        mock((db) => {
          const user = currentUser(db, qa)
          const orders = visibleOrders(db, user)
          const uniq = (ids: Id[]) => [...new Set(ids)]
          const sort = <T extends { name: string }>(l: T[]) => l.sort((a, b2) => a.name.localeCompare(b2.name, 'ru'))
          return {
            clients: sort(uniq(orders.map((o) => o.clientId)).map((id) => ({ id, name: nameOf(db.clients, id) }))),
            regions: sort(uniq(orders.map((o) => o.regionId)).map((id) => ({ id, name: nameOf(db.regions, id) }))),
            businessTypes: sort(
              uniq(orders.map((o) => o.businessTypeId)).map((id) => ({ id, name: nameOf(db.businessTypes, id) })),
            ),
            creators: sort(uniq(orders.map((o) => o.createdById)).map((id) => ({ id, name: userName(db, id) }))),
          }
        }),
      providesTags: [{ type: 'Order', id: 'LIST' }],
    }),

    getOrder: b.query<OrderView, Id>({
      queryFn: (id, qa) =>
        mock((db) => {
          const user = currentUser(db, qa)
          const o = accessibleOrder(db, user, id)
          const consignee = db.consignees.find((c) => c.id === o.consigneeId)
          const { documents, history, items, ...head } = o
          return {
            order: head,
            names: {
              client: nameOf(db.clients, o.clientId),
              consignee: consignee?.name ?? '—',
              consigneeAddress: consignee?.address ?? '',
              region: nameOf(db.regions, o.regionId),
              businessType: nameOf(db.businessTypes, o.businessTypeId),
              application: db.applications.find((a) => a.id === o.applicationId)?.number ?? '—',
              payment: nameOf(db.paymentTerms, o.paymentTermId),
              delivery: nameOf(db.deliveryTerms, o.deliveryTermId),
              creator: userName(db, o.createdById),
              responsible: o.responsibleId ? userName(db, o.responsibleId) : undefined,
            },
            items: items.map((i) => {
              const p = db.products.find((x) => x.id === i.productId)
              return {
                ...i,
                code: p?.code ?? '',
                name: p?.name ?? '—',
                unit: p?.unit ?? '',
                packSize: p?.packSize ?? 0,
              }
            }),
            totals: calcOrder(items),
            history: [...history]
              .sort((a, b2) => b2.at.localeCompare(a.at))
              .map((h) => ({ ...h, userName: userName(db, h.userId) })),
            documents: documents.map(({ dataUrl: _d, ...d }) => ({ ...d, uploaderName: userName(db, d.uploadedById) })),
            exchange: ((j) => j && { status: j.status, attempts: j.attempts, lastError: j.lastError })(
              db.exchange.jobs.find((x) => x.orderId === o.id),
            ),
            can: viewPermissions(db, user, o),
          }
        }),
      providesTags: (_r, _e, id) => [{ type: 'Order', id }],
    }),

    exportOrders: b.mutation<ExportData, OrderFilters>({
      queryFn: (f, qa) =>
        mock((db) => {
          const user = currentUser(db, qa)
          if (!hasPermission(db, user, 'orders.export')) throw new MockError('forbidden', 'Выгрузка вам недоступна')
          const found = filtered(db, user, f).filter(({ o }) => o.status !== 'draft')
          found.sort((a, b2) => b2.o.createdAt.localeCompare(a.o.createdAt))
          return {
            orders: found.map((x) => x.row),
            items: found.flatMap(({ o }) =>
              o.items.map((i) => {
                const p = db.products.find((x) => x.id === i.productId)
                const t = calcOrder([i])
                return {
                  number: o.number,
                  code: p?.code ?? '',
                  name: p?.name ?? '—',
                  qty: i.qty,
                  unit: p?.unit ?? '',
                  price: i.price,
                  vatRate: i.vatRate,
                  net: t.net,
                  gross: t.gross,
                }
              }),
            ),
          }
        }),
    }),

    updateOrderHeader: b.mutation<void, HeaderPatch>({
      queryFn: (p, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            const o = accessibleOrder(db, user, p.id)
            if (!viewPermissions(db, user, o).edit)
              throw new MockError('forbidden', 'Этот заказ уже нельзя редактировать')
            const client = db.clients.find((c) => c.id === o.clientId)!
            const consignee = db.consignees.find((c) => c.id === p.consigneeId && c.clientId === o.clientId)
            if (!consignee) throw new MockError('validation', 'Выберите грузополучателя этого клиента')
            if (!client.regionIds.includes(p.regionId))
              throw new MockError('validation', 'Регион не подходит этому клиенту')
            if (!client.deliveryTermIds.includes(p.deliveryTermId))
              throw new MockError('validation', 'Условие поставки недоступно клиенту')
            const app = db.applications.find((a) => a.id === p.applicationId)
            if (
              !app ||
              app.clientId !== o.clientId ||
              app.regionId !== p.regionId ||
              app.businessTypeId !== o.businessTypeId
            ) {
              throw new MockError('validation', 'Приложение не подходит под выбранные регион и тип бизнеса')
            }

            const changes: string[] = []
            const diff = (label: string, from: string, to: string) =>
              from !== to && changes.push(`${label}: ${from} → ${to}`)
            diff('Грузополучатель', nameOf(db.consignees, o.consigneeId), consignee.name)
            diff('Регион', nameOf(db.regions, o.regionId), nameOf(db.regions, p.regionId))
            diff(
              'Условия поставки',
              nameOf(db.deliveryTerms, o.deliveryTermId),
              nameOf(db.deliveryTerms, p.deliveryTermId),
            )
            diff('Приложение', db.applications.find((a) => a.id === o.applicationId)?.number ?? '—', app.number)
            if (!changes.length) return

            Object.assign(o, {
              consigneeId: p.consigneeId,
              regionId: p.regionId,
              deliveryTermId: p.deliveryTermId,
              applicationId: p.applicationId,
              city: /г\.\s*([^,]+)/.exec(consignee.address)?.[1].trim() ?? o.city,
              responsibleId: app.responsibleIds.includes(o.responsibleId ?? '')
                ? o.responsibleId
                : app.responsibleIds[0],
            })
            log(o, user, 'Изменена шапка заказа', changes.join('; '))
            notify(db, 'order.changed', o, { actorId: user.id, details: changes.join('\n') })
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, p) => tags(p.id),
    }),

    cancelOrder: b.mutation<void, { id: Id; comment: string }>({
      queryFn: ({ id, comment }, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            const o = accessibleOrder(db, user, id)
            if (!viewPermissions(db, user, o).cancel) {
              throw new MockError('forbidden', 'Заказ уже передан в 1С — отмена выполняется в учётной системе')
            }
            const reason = comment.trim()
            if (reason.length < 3) throw new MockError('validation', 'Укажите причину отмены')
            o.status = 'cancelled'
            cancelExchange(db, o.id)
            log(o, user, 'Заказ отменён', reason)
            notify(db, 'order.cancelled', o, { actorId: user.id, details: reason })
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, a) => tags(a.id),
    }),

    saveOrderComment: b.mutation<void, { id: Id; text: string }>({
      queryFn: ({ id, text }, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            const o = accessibleOrder(db, user, id)
            const key = viewPermissions(db, user, o).comment
            if (!key) throw new MockError('forbidden', 'Комментарий нельзя изменить')
            const value = text.trim()
            o.comments = { ...o.comments, [key]: value || undefined }
            log(o, user, value ? 'Изменён комментарий' : 'Комментарий удалён', value || undefined)
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, a) => tags(a.id),
    }),

    addOrderDocument: b.mutation<void, { id: Id; type: string; fileName: string; size: number; dataUrl: string }>({
      queryFn: ({ id, type, fileName, size, dataUrl }, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            const o = accessibleOrder(db, user, id)
            if (!viewPermissions(db, user, o).upload) throw new MockError('forbidden', 'Загрузка документов недоступна')
            if (!(DOCUMENT_TYPES as readonly string[]).includes(type))
              throw new MockError('validation', 'Выберите тип документа')
            if (size > MAX_DOCUMENT_BYTES)
              throw new MockError('validation', 'Файл больше 1 МБ — в демо-версии это ограничение')
            o.documents.push({
              id: newId('d'),
              type,
              fileName,
              size,
              dataUrl,
              uploadedAt: new Date().toISOString(),
              uploadedById: user.id,
            })
            log(o, user, 'Загружен документ', `${type}: ${fileName}`)
            notify(db, 'document.uploaded', o, { actorId: user.id, details: `: ${fileName}` })
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, a) => tags(a.id),
    }),

    removeOrderDocument: b.mutation<void, { id: Id; docId: Id }>({
      queryFn: ({ id, docId }, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            const o = accessibleOrder(db, user, id)
            if (!viewPermissions(db, user, o).upload) throw new MockError('forbidden', 'Удаление документов недоступно')
            const doc = o.documents.find((d) => d.id === docId)
            if (!doc) throw new MockError('notFound', 'Документ не найден')
            o.documents = o.documents.filter((d) => d.id !== docId)
            log(o, user, 'Удалён документ', `${doc.type}: ${doc.fileName}`)
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, a) => tags(a.id),
    }),

    /** Содержимое документа для скачивания (проверяется доступ к заказу). */
    getOrderDocument: b.mutation<{ fileName: string; dataUrl?: string; type: string }, { id: Id; docId: Id }>({
      queryFn: ({ id, docId }, qa) =>
        mock((db) => {
          const o = accessibleOrder(db, currentUser(db, qa), id)
          const doc = o.documents.find((d) => d.id === docId)
          if (!doc) throw new MockError('notFound', 'Документ не найден')
          return { fileName: doc.fileName, dataUrl: doc.dataUrl, type: doc.type }
        }),
    }),
  }),
})

export const {
  useListOrdersQuery,
  useGetOrderFilterOptionsQuery,
  useGetOrderQuery,
  useExportOrdersMutation,
  useUpdateOrderHeaderMutation,
  useCancelOrderMutation,
  useSaveOrderCommentMutation,
  useAddOrderDocumentMutation,
  useRemoveOrderDocumentMutation,
  useGetOrderDocumentMutation,
} = ordersViewApi
