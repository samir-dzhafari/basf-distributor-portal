import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { newId } from '@/mocks/db'
import {
  clientVisibility,
  currentUser,
  hasPermission,
  isFullAccess,
  orderVisibility,
  subordinateIds,
  whyNotVisible,
  type VisibilityReason,
} from '@/mocks/access'
import { inviteLinkFor, sendInvite } from '@/mocks/invites'
import type { Db } from '@/mocks/seed'
import { audit, diff, type AuditInput } from '@/mocks/audit'
import { fullName } from '@/shared/lib/format'
import { isEmail, isPhone } from '@/shared/lib/requisites'
import type {
  BusinessType,
  Client,
  Id,
  OrderStatus,
  Region,
  Role,
  SafeUser,
  User,
  UserStatus,
} from '@/shared/types/domain'

export type EmployeeStatusFilter = 'all' | UserStatus

export interface EmployeesQuery {
  q: string
  roleId: Id
  regionId: Id
  managerId: Id
  status: EmployeeStatusFilter
  page: number
  pageSize: number
  sortBy: 'name' | 'role'
  sortDir: 'asc' | 'desc'
}

export interface EmployeeRow {
  id: Id
  name: string
  email: string
  roleName: string
  fullAccess: boolean
  regionNames: string[]
  managerName?: string
  clientsCount: number
  subordinatesCount: number
  status: UserStatus
}

export interface EmployeesList {
  rows: EmployeeRow[]
  total: number
  refs: {
    roles: Role[]
    regions: Region[]
    managers: { id: Id; name: string }[]
    clients: { id: Id; name: string }[]
    businessTypes: BusinessType[]
  }
}

export interface EmployeeDetail {
  user: SafeUser
  role: Role
  manager?: { id: Id; name: string }
  /** Подчинённые по цепочке, с глубиной. */
  subordinates: { id: Id; name: string; roleName: string; depth: number; status: UserStatus }[]
  zone: { clientIds: Id[]; regionIds: Id[]; businessTypeIds: Id[] }
  inviteLink?: string
  isSelf: boolean
  /** Что закреплено за сотрудником: пригодится при деактивации. */
  assets: {
    clients: number
    regions: number
    businessTypes: number
    applications: number
    subordinates: number
    pendingOrders: number
  }
  refs: {
    roles: Role[]
    employees: { id: Id; name: string; status: UserStatus }[]
    clients: Pick<Client, 'id' | 'name' | 'code'>[]
    regions: Region[]
    businessTypes: BusinessType[]
  }
}

export interface EmployeeInput {
  id?: Id
  firstName: string
  lastName: string
  email: string
  phone: string
  roleId: Id
  managerId?: Id
}

export interface ZoneInput {
  clientIds: Id[]
  regionIds: Id[]
  businessTypeIds: Id[]
}

export interface VisibilityReport {
  employee: { id: Id; name: string; roleName: string; fullAccess: boolean; status: UserStatus }
  zone: { clients: number; regions: number; businessTypes: number; subordinates: number }
  clients: {
    id: Id
    name: string
    regionNames: string[]
    reasons: VisibilityReason[]
    ordersVisible: number
    ordersTotal: number
  }[]
  orders: {
    id: Id
    number: string
    status: OrderStatus
    clientName: string
    regionName: string
    businessTypeName: string
    reasons: VisibilityReason[]
  }[]
  totals: { clients: number; orders: number; ordersAll: number }
}

export interface OrderExplanation {
  found: boolean
  number?: string
  visible?: boolean
  reasons?: VisibilityReason[]
  missing?: string[]
  summary?: string
}

// ---------------------------------------------------------------------------------------------

const rec = (db: Db, qa: { getState: () => unknown }, input: AuditInput) => audit(db, currentUser(db, qa), input)
const EMP_LABELS = {
  firstName: 'Имя',
  lastName: 'Фамилия',
  email: 'Почта',
  phone: 'Телефон',
  roleId: 'Роль',
  managerId: 'Руководитель',
}

function guard(db: Db, user: User) {
  if (!hasPermission(db, user, 'users.manage')) throw new MockError('forbidden', 'Раздел «Сотрудники» вам недоступен')
}
const fail = (message: string): never => {
  throw new MockError('validation', message)
}
const employeeOf = (db: Db, id: Id): User => {
  const u = db.users.find((x) => x.id === id && x.kind === 'employee')
  if (!u) throw new MockError('notFound', 'Сотрудник не найден')
  return u
}
const ensureScope = (u: User) => (u.scope ??= { clientIds: [], regionIds: [], businessTypeIds: [] })
const uniq = <T>(a: T[]) => [...new Set(a)]
const activeAdmins = (db: Db) =>
  db.users.filter((u) => u.kind === 'employee' && u.status !== 'blocked' && isFullAccess(db, u))

/** Нельзя назначить руководителем самого себя или своего подчинённого — иначе цепочка замкнётся. */
function assertManager(db: Db, employeeId: Id | undefined, managerId?: Id) {
  if (!managerId) return
  const m = db.users.find((u) => u.id === managerId && u.kind === 'employee')
  if (!m || m.status === 'blocked') fail('Руководитель — активный сотрудник BASF')
  if (employeeId && (managerId === employeeId || subordinateIds(db, employeeId).has(managerId))) {
    fail('Руководителем нельзя назначить самого сотрудника или его подчинённого — получится замкнутая цепочка')
  }
}

function assertRole(db: Db, roleId: Id) {
  const r = db.roles.find((x) => x.id === roleId)
  if (!r || r.type !== 'employee' || !r.active) fail('Выберите действующую роль сотрудника')
}

function validateEmployee(db: Db, v: EmployeeInput) {
  if (!v.lastName.trim() || !v.firstName.trim()) fail('Укажите фамилию и имя')
  if (!isEmail(v.email)) fail('Проверьте адрес почты')
  if (db.users.some((u) => u.email.toLowerCase() === v.email.trim().toLowerCase() && u.id !== v.id))
    fail('Пользователь с такой почтой уже есть — почта должна быть уникальной')
  if (v.phone.trim() && !isPhone(v.phone)) fail('Телефон: +7 900 123-45-67')
  assertRole(db, v.roleId)
}

function detail(db: Db, user: User, viewer: User): EmployeeDetail {
  const role = db.roles.find((r) => r.id === user.roleId)!
  const subs = (function walk(id: Id, depth: number): EmployeeDetail['subordinates'] {
    return db.users
      .filter((u) => u.managerId === id)
      .flatMap((u) => [
        {
          id: u.id,
          name: fullName(u),
          roleName: db.roles.find((r) => r.id === u.roleId)?.name ?? '',
          depth,
          status: u.status,
        },
        ...walk(u.id, depth + 1),
      ])
  })(user.id, 1)
  const { password: _p, ...safe } = user
  return {
    user: safe,
    role,
    manager: user.managerId
      ? { id: user.managerId, name: fullName(db.users.find((u) => u.id === user.managerId)) }
      : undefined,
    subordinates: subs,
    zone: {
      clientIds: user.scope?.clientIds ?? [],
      regionIds: user.scope?.regionIds ?? [],
      businessTypeIds: user.scope?.businessTypeIds ?? [],
    },
    inviteLink: user.status === 'invited' ? inviteLinkFor(db, user.id) : undefined,
    isSelf: user.id === viewer.id,
    assets: {
      clients: user.scope?.clientIds.length ?? 0,
      regions: user.scope?.regionIds.length ?? 0,
      businessTypes: user.scope?.businessTypeIds.length ?? 0,
      applications: db.applications.filter((a) => a.responsibleIds.includes(user.id)).length,
      subordinates: db.users.filter((u) => u.managerId === user.id).length,
      pendingOrders: db.orders.filter((o) => o.responsibleId === user.id && o.status === 'pending').length,
    },
    refs: {
      roles: db.roles.filter((r) => r.type === 'employee'),
      employees: db.users
        .filter((u) => u.kind === 'employee')
        .map((u) => ({ id: u.id, name: fullName(u), status: u.status })),
      clients: db.clients
        .map(({ id, name, code }) => ({ id, name, code }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
      regions: db.regions,
      businessTypes: db.businessTypes,
    },
  }
}

const tags = ['User' as const]

export const employeesApi = api.injectEndpoints({
  endpoints: (b) => ({
    listEmployees: b.query<EmployeesList, EmployeesQuery>({
      queryFn: (q, qa) =>
        mock((db) => {
          guard(db, currentUser(db, qa))
          const regionName = (id: Id) => db.regions.find((r) => r.id === id)?.name ?? '—'
          const all = db.users.filter((u) => u.kind === 'employee')
          const s = q.q.trim().toLowerCase()
          const rows = all
            .filter((u) => !s || fullName(u).toLowerCase().includes(s) || u.email.toLowerCase().includes(s))
            .filter((u) => !q.roleId || u.roleId === q.roleId)
            .filter((u) => !q.regionId || u.scope?.regionIds.includes(q.regionId))
            .filter((u) => !q.managerId || (q.managerId === 'none' ? !u.managerId : u.managerId === q.managerId))
            .filter((u) => q.status === 'all' || u.status === q.status)
            .map<EmployeeRow>((u) => {
              const role = db.roles.find((r) => r.id === u.roleId)
              return {
                id: u.id,
                name: fullName(u),
                email: u.email,
                roleName: role?.name ?? '—',
                fullAccess: role?.fullAccess === true,
                regionNames: (u.scope?.regionIds ?? []).map(regionName),
                managerName: u.managerId ? fullName(db.users.find((x) => x.id === u.managerId)) : undefined,
                clientsCount: u.scope?.clientIds.length ?? 0,
                subordinatesCount: db.users.filter((x) => x.managerId === u.id).length,
                status: u.status,
              }
            })
          const sign = q.sortDir === 'asc' ? 1 : -1
          rows.sort(
            (a, b2) =>
              sign *
                (q.sortBy === 'role'
                  ? a.roleName.localeCompare(b2.roleName, 'ru')
                  : a.name.localeCompare(b2.name, 'ru')) || a.name.localeCompare(b2.name, 'ru'),
          )
          const start = (q.page - 1) * q.pageSize
          return {
            rows: rows.slice(start, start + q.pageSize),
            total: rows.length,
            refs: {
              roles: db.roles.filter((r) => r.type === 'employee'),
              regions: db.regions,
              managers: all
                .filter((u) => db.users.some((x) => x.managerId === u.id))
                .map((u) => ({ id: u.id, name: fullName(u) })),
              clients: db.clients.map(({ id, name }) => ({ id, name })),
              businessTypes: db.businessTypes,
            },
          }
        }),
      providesTags: tags,
    }),

    getEmployee: b.query<EmployeeDetail, Id>({
      queryFn: (id, qa) =>
        mock((db) => {
          const viewer = currentUser(db, qa)
          guard(db, viewer)
          return detail(db, employeeOf(db, id), viewer)
        }),
      providesTags: (_r, _e, id) => [{ type: 'User', id }],
    }),

    saveEmployee: b.mutation<{ id: Id; inviteLink?: string }, EmployeeInput>({
      queryFn: (input, qa) =>
        mock(
          (db) => {
            const viewer = currentUser(db, qa)
            guard(db, viewer)
            const v: EmployeeInput = {
              ...input,
              firstName: input.firstName.trim(),
              lastName: input.lastName.trim(),
              email: input.email.trim().toLowerCase(),
              phone: input.phone.trim(),
            }
            validateEmployee(db, v)
            assertManager(db, v.id, v.managerId)
            const existing = v.id ? employeeOf(db, v.id) : undefined
            if (existing) {
              const before = {
                firstName: existing.firstName,
                lastName: existing.lastName,
                email: existing.email,
                phone: existing.phone,
                roleId: existing.roleId,
                managerId: existing.managerId,
              }
              if (existing.id === viewer.id && existing.roleId !== v.roleId)
                fail('Свою собственную роль менять нельзя — иначе можно потерять доступ')
              if (existing.roleId !== v.roleId && isFullAccess(db, existing) && activeAdmins(db).length <= 1)
                fail('Это последний администратор — роль менять нельзя')
              Object.assign(existing, {
                firstName: v.firstName,
                lastName: v.lastName,
                email: v.email,
                phone: v.phone,
                roleId: v.roleId,
              })
              if (v.managerId) existing.managerId = v.managerId
              else delete existing.managerId
              const changes = diff(
                before,
                {
                  firstName: v.firstName,
                  lastName: v.lastName,
                  email: v.email,
                  phone: v.phone,
                  roleId: v.roleId,
                  managerId: v.managerId,
                },
                EMP_LABELS,
                {
                  roleId: (x) => db.roles.find((r) => r.id === x)?.name ?? String(x),
                  managerId: (x) => (x ? fullName(db.users.find((u) => u.id === x)) : '—'),
                },
              )
              if (changes.length)
                rec(db, qa, {
                  entity: 'employee',
                  entityId: existing.id,
                  entityName: fullName(existing),
                  action: 'Изменён',
                  changes,
                })
              return { id: existing.id }
            }
            const user: User = {
              id: newId('u'),
              firstName: v.firstName,
              lastName: v.lastName,
              email: v.email,
              phone: v.phone,
              password: '',
              roleId: v.roleId,
              kind: 'employee',
              status: 'invited',
              managerId: v.managerId,
              scope: { clientIds: [], regionIds: [], businessTypeIds: [] },
              notifyEmail: true,
            }
            db.users.push(user)
            rec(db, qa, { entity: 'employee', entityId: user.id, entityName: fullName(user), action: 'Создан' })
            return { id: user.id, inviteLink: sendInvite(db, user) }
          },
          { write: true },
        ),
      invalidatesTags: [...tags, 'Me'],
    }),

    sendEmployeeInvite: b.mutation<{ inviteLink: string }, Id>({
      queryFn: (id, qa) =>
        mock(
          (db) => {
            guard(db, currentUser(db, qa))
            const u = employeeOf(db, id)
            if (u.status !== 'invited') fail('Приглашение нужно только тем, кто ещё не задал пароль')
            return { inviteLink: sendInvite(db, u) }
          },
          { write: true },
        ),
      invalidatesTags: tags,
    }),

    /** Зона ответственности: клиенты, регионы и типы бизнеса (фич-лист 5.3). */
    updateZone: b.mutation<void, { id: Id } & ZoneInput>({
      queryFn: ({ id, ...zone }, qa) =>
        mock(
          (db) => {
            guard(db, currentUser(db, qa))
            const u = employeeOf(db, id)
            if (zone.clientIds.some((c) => !db.clients.some((x) => x.id === c))) fail('Неизвестный клиент')
            if (zone.regionIds.some((r) => !db.regions.some((x) => x.id === r))) fail('Неизвестный регион')
            if (zone.businessTypeIds.some((t) => !db.businessTypes.some((x) => x.id === t)))
              fail('Неизвестный тип бизнеса')
            u.scope = {
              clientIds: uniq(zone.clientIds),
              regionIds: uniq(zone.regionIds),
              businessTypeIds: uniq(zone.businessTypeIds),
            }
            rec(db, qa, {
              entity: 'employee',
              entityId: u.id,
              entityName: fullName(u),
              action: 'Изменена зона ответственности',
              summary: `Клиентов: ${u.scope.clientIds.length}, регионов: ${u.scope.regionIds.length}, типов бизнеса: ${u.scope.businessTypeIds.length}`,
            })
          },
          { write: true },
        ),
      invalidatesTags: [...tags, 'Order', 'Client'],
    }),

    /** Массовое добавление или снятие клиентов, регионов и типов бизнеса у нескольких сотрудников. */
    massZone: b.mutation<{ updated: number }, { ids: Id[]; mode: 'add' | 'remove' } & ZoneInput>({
      queryFn: ({ ids, mode, ...zone }, qa) =>
        mock(
          (db) => {
            guard(db, currentUser(db, qa))
            if (!ids.length) fail('Отметьте сотрудников')
            if (!zone.clientIds.length && !zone.regionIds.length && !zone.businessTypeIds.length)
              fail('Выберите, что назначить')
            const items = ids.map((id) => employeeOf(db, id))
            items.forEach((u) => {
              const s = ensureScope(u)
              const apply = (cur: Id[], delta: Id[]) =>
                mode === 'add' ? uniq([...cur, ...delta]) : cur.filter((x) => !delta.includes(x))
              s.clientIds = apply(s.clientIds, zone.clientIds)
              s.regionIds = apply(s.regionIds, zone.regionIds)
              s.businessTypeIds = apply(s.businessTypeIds, zone.businessTypeIds)
            })
            rec(db, qa, {
              entity: 'employee',
              entityName: `Сотрудников: ${items.length}`,
              action: mode === 'add' ? 'Добавлена зона ответственности' : 'Снята зона ответственности',
              summary: `Клиентов: ${zone.clientIds.length}, регионов: ${zone.regionIds.length}, типов бизнеса: ${zone.businessTypeIds.length}`,
            })
            return { updated: items.length }
          },
          { write: true },
        ),
      invalidatesTags: [...tags, 'Order', 'Client'],
    }),

    /**
     * Деактивация: блокировка входа и перенос клиентов, регионов, приложений, подчинённых и заказов на одобрении
     * на другого сотрудника — одним шагом (фич-лист 5.5).
     */
    deactivateEmployee: b.mutation<{ moved: EmployeeDetail['assets'] }, { id: Id; transferToId?: Id }>({
      queryFn: ({ id, transferToId }, qa) =>
        mock(
          (db) => {
            const viewer = currentUser(db, qa)
            guard(db, viewer)
            const u = employeeOf(db, id)
            if (u.id === viewer.id) fail('Себя деактивировать нельзя')
            if (u.status === 'blocked') fail('Сотрудник уже деактивирован')
            if (isFullAccess(db, u) && activeAdmins(db).length <= 1)
              fail('Это последний администратор — деактивировать нельзя')
            const before = detail(db, u, viewer).assets
            const hasAssets = Object.values(before).some((n) => n > 0)
            if (hasAssets) {
              if (!transferToId) fail('Выберите, кому передать клиентов, приложения и подчинённых')
              const target = db.users.find((x) => x.id === transferToId && x.kind === 'employee')
              if (!target || target.status === 'blocked' || target.id === u.id)
                fail('Принимающий — другой активный сотрудник')
              const t = ensureScope(target!)
              const s = ensureScope(u)
              t.clientIds = uniq([...t.clientIds, ...s.clientIds])
              t.regionIds = uniq([...t.regionIds, ...s.regionIds])
              t.businessTypeIds = uniq([...t.businessTypeIds, ...s.businessTypeIds])
              db.applications.forEach((a) => {
                if (a.responsibleIds.includes(u.id))
                  a.responsibleIds = uniq(a.responsibleIds.map((r) => (r === u.id ? target!.id : r)))
              })
              db.users.forEach((x) => {
                if (x.managerId === u.id) {
                  if (x.id === target!.id) delete x.managerId
                  else x.managerId = target!.id
                }
              })
              db.orders.forEach((o) => {
                if (o.responsibleId === u.id && o.status === 'pending') o.responsibleId = target!.id
              })
              u.scope = { clientIds: [], regionIds: [], businessTypeIds: [] }
              delete u.managerId
            } else delete u.managerId
            u.status = 'blocked'
            rec(db, qa, {
              entity: 'employee',
              entityId: u.id,
              entityName: fullName(u),
              action: 'Деактивирован',
              summary: transferToId
                ? `Передано сотруднику: ${fullName(db.users.find((x) => x.id === transferToId))} (клиентов: ${before.clients}, регионов: ${before.regions}, приложений: ${before.applications}, подчинённых: ${before.subordinates})`
                : undefined,
            })
            return { moved: before }
          },
          { write: true },
        ),
      invalidatesTags: [...tags, 'Order', 'Application', 'Client'],
    }),

    activateEmployee: b.mutation<{ inviteLink?: string }, Id>({
      queryFn: (id, qa) =>
        mock(
          (db) => {
            guard(db, currentUser(db, qa))
            const u = employeeOf(db, id)
            if (u.status !== 'blocked') fail('Сотрудник и так работает')
            u.status = u.password ? 'active' : 'invited'
            rec(db, qa, { entity: 'employee', entityId: u.id, entityName: fullName(u), action: 'Возвращён в работу' })
            return u.status === 'invited' ? { inviteLink: sendInvite(db, u) } : {}
          },
          { write: true },
        ),
      invalidatesTags: tags,
    }),

    /** Страница «Что видит сотрудник и почему» (фич-лист 4.9): только просмотр. */
    getVisibility: b.query<VisibilityReport, Id>({
      queryFn: (id, qa) =>
        mock((db) => {
          guard(db, currentUser(db, qa))
          const u = employeeOf(db, id)
          const real = db.orders.filter((o) => o.status !== 'draft')
          const seen = real.map((o) => ({ o, v: orderVisibility(db, u, o) })).filter((x) => x.v.reasons.length)
          const nameOfRegion = (rid: Id) => db.regions.find((r) => r.id === rid)?.name ?? '—'
          const clientsSeen = db.clients
            .map((c) => ({ c, reasons: clientVisibility(db, u, c.id) }))
            .filter((x) => x.reasons.length)
          return {
            employee: {
              id: u.id,
              name: fullName(u),
              roleName: db.roles.find((r) => r.id === u.roleId)?.name ?? '',
              fullAccess: isFullAccess(db, u),
              status: u.status,
            },
            zone: {
              clients: u.scope?.clientIds.length ?? 0,
              regions: u.scope?.regionIds.length ?? 0,
              businessTypes: u.scope?.businessTypeIds.length ?? 0,
              subordinates: subordinateIds(db, u.id).size,
            },
            clients: clientsSeen
              .map(({ c, reasons }) => ({
                id: c.id,
                name: c.name,
                regionNames: c.regionIds.map(nameOfRegion),
                reasons,
                ordersVisible: seen.filter((x) => x.o.clientId === c.id).length,
                ordersTotal: real.filter((o) => o.clientId === c.id).length,
              }))
              .sort((a, b2) => a.name.localeCompare(b2.name, 'ru')),
            orders: seen
              .sort((a, b2) => b2.o.createdAt.localeCompare(a.o.createdAt))
              .slice(0, 300)
              .map(({ o, v }) => ({
                id: o.id,
                number: o.number,
                status: o.status,
                clientName: db.clients.find((c) => c.id === o.clientId)?.name ?? '—',
                regionName: nameOfRegion(o.regionId),
                businessTypeName: db.businessTypes.find((t) => t.id === o.businessTypeId)?.name ?? '—',
                reasons: v.reasons,
              })),
            totals: { clients: clientsSeen.length, orders: seen.length, ordersAll: real.length },
          }
        }),
      providesTags: tags,
    }),

    explainOrder: b.mutation<OrderExplanation, { employeeId: Id; number: string }>({
      queryFn: ({ employeeId, number }, qa) =>
        mock((db) => {
          guard(db, currentUser(db, qa))
          const u = employeeOf(db, employeeId)
          const n = number.trim().toLowerCase()
          const order = db.orders.find(
            (o) => o.status !== 'draft' && (o.number.toLowerCase() === n || o.erpNumber === n),
          )
          if (!order) return { found: false }
          const v = orderVisibility(db, u, order)
          return v.reasons.length
            ? { found: true, number: order.number, visible: true, reasons: v.reasons }
            : { found: true, number: order.number, visible: false, reasons: [], missing: whyNotVisible(db, u, order) }
        }),
    }),
  }),
})

export const {
  useListEmployeesQuery,
  useGetEmployeeQuery,
  useSaveEmployeeMutation,
  useSendEmployeeInviteMutation,
  useUpdateZoneMutation,
  useMassZoneMutation,
  useDeactivateEmployeeMutation,
  useActivateEmployeeMutation,
  useGetVisibilityQuery,
  useExplainOrderMutation,
} = employeesApi
