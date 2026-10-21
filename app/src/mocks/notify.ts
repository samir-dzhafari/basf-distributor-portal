import { renderEmail } from '@/shared/lib/emailTemplates'
import { formatMoney } from '@/shared/lib/format'
import { calcOrder } from '@/shared/lib/money'
import { NOTIFICATION_META, NOTIFICATION_TYPES_FOR } from '@/shared/lib/notificationMeta'
import { ORDER_STATUS } from '@/shared/lib/status'
import type { Id, NotificationType, Order, User } from '@/shared/types/domain'
import { hasPermission, orderVisibility } from './access'
import { newId } from './db'
import type { Db } from './seed'

export interface NotifyOptions {
  /** Кто совершил действие — ему самому уведомление не приходит. */
  actorId?: Id
  details?: string
}

type Group = 'appResponsible' | 'visibleApprovers' | 'clientUsers' | 'creator' | 'exchangeWatchers'

/** Кому какие события (фич-лист 13.3). Общая почта клиента получает письма наравне — см. COMMON_EMAIL. */
const AUDIENCE: Record<NotificationType, Group[]> = {
  'order.submitted': ['appResponsible', 'visibleApprovers', 'clientUsers'],
  'order.approved': ['clientUsers', 'creator'],
  'order.rejected': ['clientUsers', 'creator'],
  'order.changed': ['clientUsers', 'creator'],
  'order.cancelled': ['appResponsible', 'clientUsers'],
  'exchange.sent': ['creator', 'appResponsible'],
  'exchange.error': ['exchangeWatchers', 'appResponsible'],
  'exchange.accepted': ['clientUsers', 'creator', 'appResponsible'],
  'exchange.completed': ['clientUsers', 'creator', 'appResponsible'],
  'document.uploaded': ['clientUsers'],
}
/** На общую почту клиента письма идут только о событиях, видимых клиенту. */
const COMMON_EMAIL: NotificationType[] = [
  'order.submitted',
  'order.approved',
  'order.rejected',
  'order.changed',
  'order.cancelled',
  'exchange.accepted',
  'exchange.completed',
  'document.uploaded',
]

const origin = () => (typeof location !== 'undefined' ? location.origin : '')

function recipients(db: Db, type: NotificationType, order: Order, actorId?: Id): User[] {
  const active = (u: User) => u.status === 'active'
  const employees = db.users.filter((u) => u.kind === 'employee' && active(u))
  const app = db.applications.find((a) => a.id === order.applicationId)
  const groups: Record<Group, User[]> = {
    appResponsible: employees.filter((u) => app?.responsibleIds.includes(u.id)),
    visibleApprovers: employees.filter(
      (u) => hasPermission(db, u, 'orders.approve') && orderVisibility(db, u, order).reasons.length > 0,
    ),
    clientUsers: db.users.filter((u) => u.kind === 'client' && u.clientId === order.clientId && active(u)),
    creator: db.users.filter((u) => u.id === order.createdById && active(u)),
    exchangeWatchers: employees.filter((u) => hasPermission(db, u, 'exchange.manage')),
  }
  const seen = new Set<Id>()
  return AUDIENCE[type]
    .flatMap((g) => groups[g])
    .filter(
      (u) => u.id !== actorId && !(u.mutedTypes ?? []).includes(type) && NOTIFICATION_TYPES_FOR[u.kind].includes(type),
    )
    .filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)))
}

/**
 * Рассылает уведомление по событию: в кабинет — всем получателям, на почту — тем, у кого письма включены.
 * Письмо уходит и на общую почту клиента, если это не отключено. Возвращает, сколько получателей.
 */
export function notify(db: Db, type: NotificationType, order: Order, opts: NotifyOptions = {}): number {
  const meta = NOTIFICATION_META[type]
  const client = db.clients.find((c) => c.id === order.clientId)
  const actor = db.users.find((u) => u.id === opts.actorId)
  const at = new Date().toISOString()
  const total = formatMoney(calcOrder(order.items).gross)
  const email = renderEmail(type, {
    number: order.number,
    clientName: client?.name ?? '—',
    applicationNumber: db.applications.find((a) => a.id === order.applicationId)?.number ?? '—',
    total,
    status: ORDER_STATUS[order.status].label,
    link: `${origin()}/#/orders/${order.id}`,
    erpNumber: order.erpNumber,
    details: opts.details,
    actorName: actor ? `${actor.lastName} ${actor.firstName}` : undefined,
    senderEmail: db.settings.senderEmail,
  })
  const send = (to: string) =>
    db.emails.push({
      id: newId('em'),
      to,
      at,
      subject: email.subject,
      body: email.text,
      html: email.html,
      link: `/orders/${order.id}`,
      kind: type,
    })

  const users = recipients(db, type, order, opts.actorId)
  for (const u of users) {
    db.notifications.unshift({
      id: newId('nt'),
      userId: u.id,
      type,
      orderId: order.id,
      title: meta.title(order.number),
      text:
        [client?.name, total].filter(Boolean).join(' · ') + (opts.details ? ` — ${opts.details.split('\n')[0]}` : ''),
      at,
      read: false,
    })
    if (u.notifyEmail) send(u.email)
  }
  if (
    client &&
    client.notifyCommonEmail !== false &&
    COMMON_EMAIL.includes(type) &&
    !users.some((u) => u.email.toLowerCase() === client.email.toLowerCase())
  ) {
    send(client.email)
  }
  db.notifications.length = Math.min(db.notifications.length, 1000)
  db.emails.length = Math.min(db.emails.length, 500)
  return users.length
}
