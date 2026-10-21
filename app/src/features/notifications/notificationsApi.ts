import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { accessibleClientIds, currentUser, hasPermission } from '@/mocks/access'
import { audit } from '@/mocks/audit'
import type { Db } from '@/mocks/seed'
import { NOTIFICATION_META } from '@/shared/lib/notificationMeta'
import {
  NOTIFICATION_TYPES,
  type EmailMessage,
  type Id,
  type Notification,
  type NotificationType,
  type User,
} from '@/shared/types/domain'

export interface NotificationsQuery {
  unreadOnly: boolean
  page: number
  pageSize: number
}

export interface NotificationsResult {
  rows: (Notification & { severity: 'info' | 'success' | 'warning' | 'error'; orderNumber: string })[]
  total: number
  unread: number
}

export interface Subscriptions {
  notifyEmail: boolean
  mutedTypes: NotificationType[]
}

export interface EmailsQuery {
  q: string
  kind: string
  page: number
  pageSize: number
}

export type EmailRow = Omit<EmailMessage, 'html'> & { hasHtml: boolean }

const fail = (message: string): never => {
  throw new MockError('validation', message)
}

const subsOf = (u: User): Subscriptions => ({ notifyEmail: u.notifyEmail, mutedTypes: u.mutedTypes ?? [] })

function applySubs(u: User, s: Subscriptions) {
  const valid = s.mutedTypes.filter((t) => (NOTIFICATION_TYPES as readonly string[]).includes(t))
  u.notifyEmail = !!s.notifyEmail
  u.mutedTypes = [...new Set(valid)]
}

/** Администратор настраивает подписки пользователей клиента (фич-лист 13.4). */
function clientUser(db: Db, manager: User, userId: Id): User {
  if (!hasPermission(db, manager, 'clients.manage')) throw new MockError('forbidden', 'Недостаточно прав')
  const u = db.users.find((x) => x.id === userId && x.kind === 'client')
  if (!u || !u.clientId || !accessibleClientIds(db, manager).has(u.clientId))
    throw new MockError('notFound', 'Пользователь не найден')
  return u
}

export const notificationsApi = api.injectEndpoints({
  endpoints: (b) => ({
    listNotifications: b.query<NotificationsResult, NotificationsQuery>({
      queryFn: (q, qa) =>
        mock((db) => {
          const user = currentUser(db, qa)
          const mine = db.notifications.filter((n) => n.userId === user.id)
          const list = mine.filter((n) => !q.unreadOnly || !n.read)
          const start = (q.page - 1) * q.pageSize
          return {
            rows: list.slice(start, start + q.pageSize).map((n) => ({
              ...n,
              severity: NOTIFICATION_META[n.type].severity,
              orderNumber: db.orders.find((o) => o.id === n.orderId)?.number ?? '',
            })),
            total: list.length,
            unread: mine.filter((n) => !n.read).length,
          }
        }),
      providesTags: [{ type: 'Notification', id: 'LIST' }],
    }),

    getUnreadCount: b.query<number, void>({
      queryFn: (_a, qa) =>
        mock((db) => db.notifications.filter((n) => n.userId === currentUser(db, qa).id && !n.read).length),
      providesTags: [{ type: 'Notification', id: 'LIST' }],
    }),

    markNotificationsRead: b.mutation<void, { ids?: Id[]; all?: boolean }>({
      queryFn: ({ ids, all }, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            db.notifications.forEach((n) => {
              if (n.userId === user.id && (all || ids?.includes(n.id))) n.read = true
            })
          },
          { write: true },
        ),
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),

    getMySubscriptions: b.query<Subscriptions, void>({
      queryFn: (_a, qa) => mock((db) => subsOf(currentUser(db, qa))),
      providesTags: [{ type: 'Notification', id: 'SUBS' }],
    }),

    setMySubscriptions: b.mutation<void, Subscriptions>({
      queryFn: (s, qa) => mock((db) => applySubs(currentUser(db, qa), s), { write: true }),
      invalidatesTags: [{ type: 'Notification', id: 'SUBS' }, 'Me'],
    }),

    getUserSubscriptions: b.query<Subscriptions, Id>({
      queryFn: (userId, qa) => mock((db) => subsOf(clientUser(db, currentUser(db, qa), userId))),
      providesTags: (_r, _e, id) => [{ type: 'Notification', id: `SUBS-${id}` }],
    }),

    setUserSubscriptions: b.mutation<void, Subscriptions & { userId: Id }>({
      queryFn: ({ userId, ...s }, qa) =>
        mock(
          (db) => {
            const manager = currentUser(db, qa)
            const u = clientUser(db, manager, userId)
            applySubs(u, s)
            audit(db, manager, {
              entity: 'client',
              entityId: u.clientId,
              entityName: db.clients.find((c) => c.id === u.clientId)?.name ?? '',
              action: 'Изменены уведомления пользователя',
              summary: `${u.email}: почта ${u.notifyEmail ? 'включена' : 'выключена'}, отключено типов: ${(u.mutedTypes ?? []).length}`,
            })
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, a) => [{ type: 'Notification', id: `SUBS-${a.userId}` }],
    }),

    /** Общий адрес клиента получает письма о заказах наравне с пользователями (или нет). */
    setCommonEmail: b.mutation<void, { clientId: Id; enabled: boolean }>({
      queryFn: ({ clientId, enabled }, qa) =>
        mock(
          (db) => {
            const manager = currentUser(db, qa)
            if (!hasPermission(db, manager, 'clients.manage')) throw new MockError('forbidden', 'Недостаточно прав')
            const c = db.clients.find((x) => x.id === clientId)
            if (!c || !accessibleClientIds(db, manager).has(clientId))
              throw new MockError('notFound', 'Клиент не найден')
            c.notifyCommonEmail = enabled
            audit(db, manager, {
              entity: 'client',
              entityId: c.id,
              entityName: c.name,
              action: 'Изменены уведомления',
              summary: `Письма на общую почту ${c.email}: ${enabled ? 'включены' : 'выключены'}`,
            })
          },
          { write: true },
        ),
      invalidatesTags: ['Client'],
    }),

    // ---------- Администратор: отправленные письма ----------
    listEmails: b.query<{ rows: EmailRow[]; total: number; kinds: string[] }, EmailsQuery>({
      queryFn: (q, qa) =>
        mock((db) => {
          if (!hasPermission(db, currentUser(db, qa), 'settings.manage')) fail('Журнал писем вам недоступен')
          const s = q.q.trim().toLowerCase()
          const list = db.emails
            .filter((e) => !q.kind || e.kind === q.kind)
            .filter((e) => !s || e.to.toLowerCase().includes(s) || e.subject.toLowerCase().includes(s))
            .sort((a, b2) => b2.at.localeCompare(a.at))
          const start = (q.page - 1) * q.pageSize
          return {
            rows: list.slice(start, start + q.pageSize).map(({ html, ...e }) => ({ ...e, hasHtml: !!html })),
            total: list.length,
            kinds: [...new Set(db.emails.map((e) => e.kind).filter((k): k is string => !!k))],
          }
        }),
      providesTags: [{ type: 'Email', id: 'LIST' }],
    }),

    getEmail: b.query<EmailMessage & { from: string }, Id>({
      queryFn: (id, qa) =>
        mock((db) => {
          if (!hasPermission(db, currentUser(db, qa), 'settings.manage')) fail('Журнал писем вам недоступен')
          const e = db.emails.find((x) => x.id === id)
          if (!e) throw new MockError('notFound', 'Письмо не найдено')
          return { ...e, from: db.settings.senderEmail }
        }),
    }),
  }),
})

export const {
  useListNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationsReadMutation,
  useGetMySubscriptionsQuery,
  useSetMySubscriptionsMutation,
  useGetUserSubscriptionsQuery,
  useSetUserSubscriptionsMutation,
  useSetCommonEmailMutation,
  useListEmailsQuery,
  useGetEmailQuery,
} = notificationsApi
