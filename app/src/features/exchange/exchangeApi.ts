import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { currentUser, hasPermission } from '@/mocks/access'
import { retryExchange } from '@/mocks/exchange'
import type { Db } from '@/mocks/seed'
import type { ExchangeJob, ExchangeLogEntry, ExchangeMode, Id, OrderStatus, User } from '@/shared/types/domain'

export interface ExchangeRow {
  job: ExchangeJob
  orderNumber: string
  clientName: string
  total: number
}

export interface ExchangeOverview {
  mode: ExchangeMode
  rows: ExchangeRow[]
  log: ExchangeLogEntry[]
  counts: Record<'error' | 'sent' | 'accepted' | 'completed', number>
}

const guard = (db: Db, user: User) => {
  if (!hasPermission(db, user, 'exchange.manage'))
    throw new MockError('forbidden', 'Раздел «Обмен с 1С» вам недоступен')
}

export const exchangeApi = api.injectEndpoints({
  endpoints: (b) => ({
    getExchange: b.query<ExchangeOverview, void>({
      queryFn: (_a, qa) =>
        mock((db) => {
          guard(db, currentUser(db, qa))
          const rows = db.exchange.jobs
            .filter((j) => j.status !== 'cancelled')
            .map((job) => {
              const o = db.orders.find((x) => x.id === job.orderId)!
              return {
                job,
                orderNumber: o.number,
                clientName: db.clients.find((c) => c.id === o.clientId)?.name ?? '—',
                total: o.items.reduce((s, i) => s + i.qty * i.price * (1 + i.vatRate / 100), 0),
              }
            })
            .sort((a, b2) => b2.job.updatedAt.localeCompare(a.job.updatedAt))
          const count = (s: OrderStatus) => rows.filter((r) => r.job.status === s).length
          return {
            mode: db.exchange.mode,
            rows,
            log: db.exchange.log.slice(0, 40),
            counts: {
              error: count('error'),
              sent: count('sent'),
              accepted: count('accepted'),
              completed: count('completed'),
            },
          }
        }),
      providesTags: [{ type: 'Order', id: 'EXCHANGE' }],
    }),

    setExchangeMode: b.mutation<void, ExchangeMode>({
      queryFn: (mode, qa) =>
        mock(
          (db) => {
            guard(db, currentUser(db, qa))
            db.exchange.mode = mode
          },
          { write: true },
        ),
      invalidatesTags: [{ type: 'Order', id: 'EXCHANGE' }],
    }),

    /** Повторная передача: одного заказа или всех, где была ошибка. */
    retryExchange: b.mutation<{ retried: number }, { orderId?: Id }>({
      queryFn: ({ orderId }, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            guard(db, user)
            const jobs = db.exchange.jobs.filter((j) => j.status === 'error' && (!orderId || j.orderId === orderId))
            if (!jobs.length) throw new MockError('validation', 'Нет заказов с ошибкой передачи')
            return { retried: jobs.filter((j) => retryExchange(db, j, user.id)).length }
          },
          { write: true },
        ),
      invalidatesTags: ['Order'],
    }),
  }),
})

export const { useGetExchangeQuery, useSetExchangeModeMutation, useRetryExchangeMutation } = exchangeApi
