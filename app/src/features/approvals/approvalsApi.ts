import dayjs from 'dayjs'
import { notify } from '@/mocks/notify'
import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { currentUser, canSeeOrder, hasPermission } from '@/mocks/access'
import { enqueueExchange } from '@/mocks/exchange'
import type { Db } from '@/mocks/seed'
import {
  SELF_APPROVE_MESSAGE,
  accessibleOrder,
  log,
  toRow,
  touchedBy,
  viewPermissions,
  type OrderRow,
} from '../orders/ordersViewApi'
import type { Id, User } from '@/shared/types/domain'

export interface QueueRow extends OrderRow {
  /** Сколько часов заказ ждёт решения. */
  waitingHours: number
}

/** Заказы, ожидающие решения именно этого сотрудника: видимые ему, на одобрении, не созданные и не изменённые им. */
function queueFor(db: Db, user: User) {
  if (user.kind !== 'employee' || !hasPermission(db, user, 'orders.approve')) return []
  return db.orders
    .filter((o) => o.status === 'pending' && canSeeOrder(db, user, o))
    .filter((o) => !(db.settings.separateCreateApprove && touchedBy(o, user.id)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export interface ApprovalDecision {
  id: Id
  /** itemId → новое количество; 0 — убрать позицию. Добавлять позиции нельзя. */
  changes: Record<Id, number>
  comment?: string
}

export const approvalsApi = api.injectEndpoints({
  endpoints: (b) => ({
    getApprovalQueue: b.query<QueueRow[], void>({
      queryFn: (_a, qa) =>
        mock((db) =>
          queueFor(db, currentUser(db, qa)).map((o) => ({
            ...toRow(db, o),
            waitingHours: dayjs().diff(dayjs(o.createdAt), 'hour'),
          })),
        ),
      providesTags: [{ type: 'Order', id: 'LIST' }],
    }),

    /** Счётчик в меню. */
    getApprovalCount: b.query<number, void>({
      queryFn: (_a, qa) => mock((db) => queueFor(db, currentUser(db, qa)).length),
      providesTags: [{ type: 'Order', id: 'LIST' }],
    }),

    approveOrder: b.mutation<{ number: string }, ApprovalDecision>({
      queryFn: ({ id, changes, comment }, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            const o = accessibleOrder(db, user, id)
            const can = viewPermissions(db, user, o)
            if (can.approveBlocked) throw new MockError('selfApprove', SELF_APPROVE_MESSAGE)
            if (!can.approve) throw new MockError('forbidden', 'Этот заказ уже нельзя одобрить')

            const notes: string[] = []
            const next = o.items.flatMap((item) => {
              const qty = changes[item.id]
              if (qty === undefined || qty === item.qty) return [item]
              if (!Number.isInteger(qty) || qty < 0)
                throw new MockError('validation', 'Количество должно быть целым числом')
              const name = db.products.find((p) => p.id === item.productId)
              const unit = name?.unit ?? ''
              if (qty === 0) {
                notes.push(`${name?.name}: позиция удалена (было ${item.qty} ${unit})`)
                return []
              }
              notes.push(`${name?.name}: ${item.qty} → ${qty} ${unit}`)
              return [{ ...item, qty }]
            })
            const unknown = Object.keys(changes).filter((k) => !o.items.some((i) => i.id === k))
            if (unknown.length) throw new MockError('validation', 'Добавлять новые позиции при одобрении нельзя')
            if (!next.length)
              throw new MockError('validation', 'В заказе должна остаться хотя бы одна позиция — иначе отклоните заказ')

            if (notes.length) {
              o.items = next
              log(o, user, 'Скорректированы позиции', notes.join('; '))
            }
            o.responsibleId = user.id
            log(o, user, 'Заказ одобрен', comment?.trim() || undefined)
            enqueueExchange(db, o)
            if (notes.length) notify(db, 'order.changed', o, { actorId: user.id, details: notes.join('\n') })
            notify(db, 'order.approved', o, { actorId: user.id, details: comment?.trim() || undefined })
            return { number: o.number }
          },
          { write: true },
        ),
      invalidatesTags: ['Order'],
    }),

    rejectOrder: b.mutation<{ number: string }, { id: Id; comment: string }>({
      queryFn: ({ id, comment }, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            const o = accessibleOrder(db, user, id)
            const can = viewPermissions(db, user, o)
            if (can.approveBlocked) throw new MockError('selfApprove', SELF_APPROVE_MESSAGE)
            if (!can.approve) throw new MockError('forbidden', 'Этот заказ уже нельзя отклонить')
            const reason = comment.trim()
            if (reason.length < 3) throw new MockError('validation', 'Укажите причину отклонения')
            o.status = 'rejected'
            o.responsibleId = user.id
            log(o, user, 'Заказ отклонён', reason)
            notify(db, 'order.rejected', o, { actorId: user.id, details: reason })
            return { number: o.number }
          },
          { write: true },
        ),
      invalidatesTags: ['Order'],
    }),
  }),
})

export const { useGetApprovalQueueQuery, useGetApprovalCountQuery, useApproveOrderMutation, useRejectOrderMutation } =
  approvalsApi
