import { MockError } from './mock'
import type { Db } from './seed'
import type { Id, Order, Permission, User } from '@/shared/types/domain'

export const sessionUserId = (api: { getState: () => unknown }): string | null =>
  (api.getState() as { auth: { userId: string | null } }).auth.userId

export function currentUser(db: Db, api: { getState: () => unknown }): User {
  const id = sessionUserId(api)
  const user = db.users.find((u) => u.id === id)
  if (!user || user.status !== 'active') throw new MockError('session', 'Сессия завершена. Войдите снова.')
  return user
}

export const subordinateIds = (db: Db, managerId: Id, seen = new Set<Id>()): Set<Id> => {
  db.users
    .filter((u) => u.managerId === managerId && !seen.has(u.id))
    .forEach((u) => {
      seen.add(u.id)
      subordinateIds(db, u.id, seen)
    })
  return seen
}

/**
 * Клиенты, доступные пользователю: свой клиент / все (админ) /
 * назначенные клиенты, регионы, клиенты подчинённых, приложения где пользователь ответственный.
 * Заказ виден при совпадении любого правила (фич-лист 4.5–4.8).
 */
export function accessibleClientIds(db: Db, user: User): Set<Id> {
  const role = db.roles.find((r) => r.id === user.roleId)
  if (user.kind === 'client') return new Set(user.clientId ? [user.clientId] : [])
  if (role?.fullAccess) return new Set(db.clients.map((c) => c.id))
  const people = [
    user,
    ...[...subordinateIds(db, user.id)].map((id) => db.users.find((u) => u.id === id)!).filter(Boolean),
  ]
  const ids = new Set<Id>()
  for (const p of people) {
    p.scope?.clientIds.forEach((id) => ids.add(id))
    const regions = p.scope?.regionIds ?? []
    db.clients.filter((c) => c.regionIds.some((r) => regions.includes(r))).forEach((c) => ids.add(c.id))
  }
  db.applications.filter((a) => a.responsibleIds.includes(user.id)).forEach((a) => ids.add(a.clientId))
  return ids
}

export function hasPermission(db: Db, user: User, perm: Permission): boolean {
  const role = db.roles.find((r) => r.id === user.roleId)
  return !!role && (role.fullAccess === true || role.permissions.includes(perm))
}

export const isFullAccess = (db: Db, user: User) => db.roles.find((r) => r.id === user.roleId)?.fullAccess === true

/** Почему заказ или клиент виден сотруднику. Правила складываются по «или» (фич-лист 4.5–4.8). */
export type ReasonKind = 'admin' | 'creator' | 'application' | 'client' | 'region' | 'own'

export interface VisibilityReason {
  kind: ReasonKind
  /** Чьё назначение сработало: сам сотрудник или его подчинённый. */
  viaUserId?: Id
  detail: string
}

export interface OrderVisibility {
  reasons: VisibilityReason[]
  /** Совпало по клиенту или региону, но тип бизнеса заказа не открыт сотруднику. */
  blockedByBusinessType: boolean
}

const nameOf = (db: Db, id: Id) => {
  const u = db.users.find((x) => x.id === id)
  return u ? `${u.lastName} ${u.firstName}` : '—'
}

/** Сам сотрудник и все его подчинённые по цепочке — чьи назначения учитываются. */
export function zonePeople(db: Db, user: User): User[] {
  return [user, ...[...subordinateIds(db, user.id)].map((id) => db.users.find((u) => u.id === id)!).filter(Boolean)]
}

const via = (db: Db, user: User, p: User) =>
  p.id === user.id ? 'назначен сотруднику' : `назначен подчинённому: ${nameOf(db, p.id)}`

/** Все основания, по которым пользователь видит заказ. Пустой список — не видит. */
export function orderVisibility(db: Db, user: User, order: Order): OrderVisibility {
  const reasons: VisibilityReason[] = []
  let blockedByBusinessType = false
  if (order.status === 'draft') {
    if (order.createdById === user.id)
      reasons.push({ kind: 'creator', detail: 'Это ваш черновик — он виден только автору' })
    return { reasons, blockedByBusinessType }
  }
  if (user.kind === 'client') {
    if (user.clientId && order.clientId === user.clientId) reasons.push({ kind: 'own', detail: 'Заказ вашей компании' })
    return { reasons, blockedByBusinessType }
  }
  if (isFullAccess(db, user)) reasons.push({ kind: 'admin', detail: 'Администратор видит все заказы' })
  if (order.createdById === user.id) reasons.push({ kind: 'creator', detail: 'Сотрудник сам создал этот заказ' })
  const app = db.applications.find((a) => a.id === order.applicationId)
  if (app?.responsibleIds.includes(user.id)) {
    reasons.push({ kind: 'application', detail: `Ответственный по приложению ${app.number}` })
  }
  const client = db.clients.find((c) => c.id === order.clientId)
  const region = db.regions.find((r) => r.id === order.regionId)
  for (const p of zonePeople(db, user)) {
    const s = p.scope
    if (!s) continue
    const byClient = s.clientIds.includes(order.clientId)
    const byRegion = s.regionIds.includes(order.regionId)
    if (!byClient && !byRegion) continue
    if (s.businessTypeIds.length && !s.businessTypeIds.includes(order.businessTypeId)) {
      blockedByBusinessType = true
      continue
    }
    const viaUserId = p.id
    if (byClient) reasons.push({ kind: 'client', viaUserId, detail: `Клиент ${client?.name} ${via(db, user, p)}` })
    if (byRegion) reasons.push({ kind: 'region', viaUserId, detail: `Регион «${region?.name}» ${via(db, user, p)}` })
  }
  return { reasons, blockedByBusinessType }
}

/** Виден ли заказ пользователю. Черновик виден только автору, клиент видит заказы своей компании. */
export const canSeeOrder = (db: Db, user: User, order: Order): boolean =>
  orderVisibility(db, user, order).reasons.length > 0

/** Почему клиент попадает в зону сотрудника (для страницы «Что видит сотрудник»). */
export function clientVisibility(db: Db, user: User, clientId: Id): VisibilityReason[] {
  const client = db.clients.find((c) => c.id === clientId)
  if (!client) return []
  const reasons: VisibilityReason[] = []
  if (isFullAccess(db, user)) return [{ kind: 'admin', detail: 'Администратор видит всех клиентов' }]
  for (const p of zonePeople(db, user)) {
    const s = p.scope
    if (!s) continue
    if (s.clientIds.includes(clientId))
      reasons.push({ kind: 'client', viaUserId: p.id, detail: `Клиент ${via(db, user, p)}` })
    const shared = client.regionIds.filter((r) => s.regionIds.includes(r))
    if (shared.length) {
      const names = shared.map((r) => db.regions.find((x) => x.id === r)?.name).join(', ')
      reasons.push({ kind: 'region', viaUserId: p.id, detail: `Регион «${names}» ${via(db, user, p)}` })
    }
  }
  const apps = db.applications.filter((a) => a.clientId === clientId && a.responsibleIds.includes(user.id))
  if (apps.length)
    reasons.push({
      kind: 'application',
      detail: `Ответственный по приложениям: ${apps.map((a) => a.number).join(', ')}`,
    })
  return reasons
}

/** Что именно мешает увидеть заказ: для ответа на вопрос «почему я его не вижу». */
export function whyNotVisible(db: Db, user: User, order: Order): string[] {
  const v = orderVisibility(db, user, order)
  if (v.reasons.length) return []
  if (order.status === 'draft') return ['Черновик виден только автору']
  if (user.kind === 'client') return ['Заказ другой компании']
  const client = db.clients.find((c) => c.id === order.clientId)
  const region = db.regions.find((r) => r.id === order.regionId)
  const bt = db.businessTypes.find((b) => b.id === order.businessTypeId)
  const app = db.applications.find((a) => a.id === order.applicationId)
  const out: string[] = []
  if (v.blockedByBusinessType) {
    out.push(
      `Клиент или регион назначены, но тип бизнеса «${bt?.name}» не открыт сотруднику (ограничение по типам бизнеса)`,
    )
  } else {
    out.push(`Клиент ${client?.name} не назначен ни сотруднику, ни его подчинённым`)
    out.push(`Регион «${region?.name}» не входит в зону ответственности сотрудника и его подчинённых`)
  }
  out.push(`Сотрудник не указан ответственным по приложению ${app?.number ?? ''}`.trim())
  out.push('Заказ создан не этим сотрудником')
  return out
}
