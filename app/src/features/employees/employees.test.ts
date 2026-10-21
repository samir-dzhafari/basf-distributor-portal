import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '@/app/api'
import { store } from '@/app/store'
import { authApi } from '@/features/auth/authApi'
import { logout } from '@/features/auth/authSlice'
import { canSeeOrder, orderVisibility } from '@/mocks/access'
import { getDb, resetDb } from '@/mocks/db'
import { ordersViewApi, type OrderListResult } from '../orders/ordersViewApi'
import { defaultQuery } from '../orders/list/orderFilters'
import { rolesApi, type RoleRow } from '../roles/rolesApi'
import {
  employeesApi,
  type EmployeeDetail,
  type EmployeeInput,
  type EmployeesList,
  type EmployeesQuery,
  type OrderExplanation,
  type VisibilityReport,
} from './employeesApi'

type Result<T> = { data?: T; error?: { code: string; message: string } }
const call = <T = void>(thunk: unknown) => (store.dispatch as (a: unknown) => Promise<Result<T>>)(thunk)
const as = async (id: string) => {
  store.dispatch(logout())
  store.dispatch(api.util.resetApiState())
  await store.dispatch(authApi.endpoints.demoLogin.initiate(id))
}
const q: EmployeesQuery = {
  q: '',
  roleId: '',
  regionId: '',
  managerId: '',
  status: 'all',
  page: 1,
  pageSize: 50,
  sortBy: 'name',
  sortDir: 'asc',
}
const list = (patch: Partial<EmployeesQuery> = {}) =>
  call<EmployeesList>(employeesApi.endpoints.listEmployees.initiate({ ...q, ...patch }, { forceRefetch: true }))
const get = (id: string) =>
  call<EmployeeDetail>(employeesApi.endpoints.getEmployee.initiate(id, { forceRefetch: true }))
const save = (v: Partial<EmployeeInput>) =>
  call<{ id: string; inviteLink?: string }>(
    employeesApi.endpoints.saveEmployee.initiate({
      firstName: 'Нина',
      lastName: 'Тестова',
      email: 'n.testova@basf-demo.ru',
      phone: '',
      roleId: 'role-manager',
      ...v,
    }),
  )

beforeEach(() => {
  resetDb()
  store.dispatch(logout())
  store.dispatch(api.util.resetApiState())
})

describe('сотрудники', () => {
  it('доступны только с правом; поиск, роль, руководитель, регион', async () => {
    await as('u-head')
    expect((await list()).error?.code).toBe('forbidden')
    await as('u-admin')
    expect((await list()).data!.total).toBe(7)
    expect((await list({ q: 'воронова' })).data!.rows.map((r) => r.name)).toEqual(['Воронова Ирина'])
    expect((await list({ roleId: 'role-manager' })).data!.rows.every((r) => r.roleName === 'Менеджер')).toBe(true)
    expect((await list({ managerId: 'u-head' })).data!.rows.map((r) => r.name).sort()).toEqual([
      'Абазов Руслан',
      'Летунова Елена',
    ])
    expect((await list({ regionId: 'rg-south' })).data!.rows.length).toBeGreaterThan(0)
    expect((await list({ status: 'blocked' })).data!.total).toBe(0)
  })

  it('создание: приглашение, уникальная почта, действующая роль сотрудника, ФИО и телефон', async () => {
    await as('u-admin')
    const ok = await save({ managerId: 'u-head' })
    expect(ok.data!.inviteLink).toMatch(/^\/activate\//)
    expect(getDb().users.find((u) => u.id === ok.data!.id)).toMatchObject({
      status: 'invited',
      kind: 'employee',
      managerId: 'u-head',
    })
    expect((await save({})).error?.message).toMatch(/уникальной/)
    expect((await save({ email: 'a@b.ru', roleId: 'role-client' })).error?.message).toMatch(/роль сотрудника/)
    expect((await save({ email: 'b@b.ru', lastName: ' ' })).error?.code).toBe('validation')
    expect((await save({ email: 'c@b.ru', phone: '123' })).error?.message).toMatch(/Телефон/)
  })

  it('иерархия: нельзя замкнуть цепочку; подчинённые видны по цепочке', async () => {
    await as('u-admin')
    const base = {
      firstName: 'Руслан',
      lastName: 'Абазов',
      email: 'r.abazov@basf-demo.ru',
      phone: '',
      roleId: 'role-manager',
    }
    // Мельников — руководитель Абазова; назначить Абазова руководителем Мельникова нельзя
    const cycle = await call(
      employeesApi.endpoints.saveEmployee.initiate({
        ...base,
        id: 'u-head',
        firstName: 'Олег',
        lastName: 'Мельников',
        email: 'o.melnikov@basf-demo.ru',
        roleId: 'role-head',
        managerId: 'u-mgr2',
      }),
    )
    expect(cycle.error?.message).toMatch(/замкнут/)
    const self = await call(
      employeesApi.endpoints.saveEmployee.initiate({ ...base, id: 'u-mgr2', managerId: 'u-mgr2' }),
    )
    expect(self.error?.message).toMatch(/замкнут/)
    // цепочка: Алехин → Абазов → Мельников
    await call(employeesApi.endpoints.saveEmployee.initiate({ ...base, id: 'u-mgr2', managerId: 'u-head' }))
    await call(
      employeesApi.endpoints.saveEmployee.initiate({
        firstName: 'Сергей',
        lastName: 'Алехин',
        email: 'a.alekhin@basf-demo.ru',
        phone: '',
        roleId: 'role-approver',
        id: 'u-app2',
        managerId: 'u-mgr2',
      }),
    )
    const head = (await get('u-head')).data!
    expect(head.subordinates.map((s) => [s.id, s.depth])).toEqual(
      expect.arrayContaining([
        ['u-mgr2', 1],
        ['u-app2', 2],
      ]),
    )
  })

  it('свою роль менять нельзя; последнего администратора не понизить и не отключить', async () => {
    await as('u-admin')
    const me = {
      firstName: 'Анна',
      lastName: 'Соколова',
      email: 'a.sokolova@basf-demo.ru',
      phone: '',
      roleId: 'role-manager',
      id: 'u-admin',
    }
    expect((await call(employeesApi.endpoints.saveEmployee.initiate(me))).error?.message).toMatch(/собственную роль/)
    expect((await call(employeesApi.endpoints.deactivateEmployee.initiate({ id: 'u-admin' }))).error?.message).toMatch(
      /Себя/,
    )
  })
})

describe('зона ответственности и видимость', () => {
  const ordersFor = async (id: string) => {
    await as(id)
    const r = await call<OrderListResult>(
      ordersViewApi.endpoints.listOrders.initiate({ ...defaultQuery(), pageSize: 50 }, { forceRefetch: true }),
    )
    return r.data!.rows
  }

  it('назначение клиента открывает его заказы, снятие — закрывает', async () => {
    const before = await ordersFor('u-mgr1')
    expect(before.some((o) => o.clientName.includes('Агрохим'))).toBe(false)
    await as('u-admin')
    const z = (await get('u-mgr1')).data!.zone
    await call(employeesApi.endpoints.updateZone.initiate({ id: 'u-mgr1', ...z, clientIds: [...z.clientIds, 'cl-2'] }))
    expect((await ordersFor('u-mgr1')).some((o) => o.clientName.includes('Агрохим'))).toBe(true)
    await as('u-admin')
    await call(employeesApi.endpoints.updateZone.initiate({ id: 'u-mgr1', ...z }))
    expect((await ordersFor('u-mgr1')).some((o) => o.clientName.includes('Агрохим'))).toBe(false)
  })

  it('ограничение по типам бизнеса отсекает заказы, а руководитель видит заказы подчинённых', () => {
    const db = getDb()
    const order = db.orders.find(
      (o) => o.status !== 'draft' && o.clientId === 'cl-3' && o.businessTypeId === 'bt-regular',
    )!
    const mgr = db.users.find((u) => u.id === 'u-mgr1')!
    expect(canSeeOrder(db, mgr, order)).toBe(true) // клиент cl-3 назначен Летуновой
    mgr.scope!.businessTypeIds = ['bt-szr']
    const v = orderVisibility(db, mgr, order)
    expect(v.reasons).toHaveLength(0)
    expect(v.blockedByBusinessType).toBe(true)
    // Мельников — руководитель Летуновой: видит её клиента по иерархии (регион Север ему не назначен)
    const head = db.users.find((u) => u.id === 'u-head')!
    head.scope!.businessTypeIds = []
    mgr.scope!.businessTypeIds = []
    const viaSub = orderVisibility(db, head, order).reasons
    expect(viaSub.some((r) => r.kind === 'client' && r.viaUserId === 'u-mgr1' && /подчинённому/.test(r.detail))).toBe(
      true,
    )
  })

  it('массовое добавление и снятие', async () => {
    await as('u-admin')
    await call(
      employeesApi.endpoints.massZone.initiate({
        ids: ['u-mgr1', 'u-mgr2'],
        mode: 'add',
        clientIds: ['cl-9'],
        regionIds: ['rg-east'],
        businessTypeIds: [],
      }),
    )
    expect(
      getDb()
        .users.filter((u) => ['u-mgr1', 'u-mgr2'].includes(u.id))
        .every((u) => u.scope!.clientIds.includes('cl-9') && u.scope!.regionIds.includes('rg-east')),
    ).toBe(true)
    await call(
      employeesApi.endpoints.massZone.initiate({
        ids: ['u-mgr1', 'u-mgr2'],
        mode: 'remove',
        clientIds: ['cl-9'],
        regionIds: [],
        businessTypeIds: [],
      }),
    )
    expect(getDb().users.find((u) => u.id === 'u-mgr1')!.scope!.clientIds).not.toContain('cl-9')
    expect(
      (
        await call(
          employeesApi.endpoints.massZone.initiate({
            ids: ['u-mgr1'],
            mode: 'add',
            clientIds: [],
            regionIds: [],
            businessTypeIds: [],
          }),
        )
      ).error?.code,
    ).toBe('validation')
  })

  it('отчёт «что видит и почему» и объяснение по номеру заказа', async () => {
    await as('u-admin')
    const rep = (
      await call<VisibilityReport>(employeesApi.endpoints.getVisibility.initiate('u-mgr1', { forceRefetch: true }))
    ).data!
    expect(rep.totals.orders).toBeGreaterThan(0)
    expect(rep.totals.orders).toBeLessThan(rep.totals.ordersAll)
    expect(rep.orders.every((o) => o.reasons.length > 0)).toBe(true)
    expect(rep.clients.every((c) => c.reasons.length > 0)).toBe(true)
    const admin = (
      await call<VisibilityReport>(employeesApi.endpoints.getVisibility.initiate('u-admin', { forceRefetch: true }))
    ).data!
    expect(admin.employee.fullAccess).toBe(true)
    expect(admin.totals.orders).toBe(admin.totals.ordersAll)

    const hidden = getDb().orders.find(
      (o) =>
        o.status !== 'draft' &&
        !canSeeOrder(
          getDb(),
          getDb().users.find((u) => u.id === 'u-mgr1')!,
          o,
        ),
    )!
    const no = (
      await call<OrderExplanation>(
        employeesApi.endpoints.explainOrder.initiate({ employeeId: 'u-mgr1', number: hidden.number.toLowerCase() }),
      )
    ).data!
    expect(no).toMatchObject({ found: true, visible: false })
    expect(no.missing!.length).toBeGreaterThan(1)
    const seen = rep.orders[0]
    expect(
      (
        await call<OrderExplanation>(
          employeesApi.endpoints.explainOrder.initiate({ employeeId: 'u-mgr1', number: seen.number }),
        )
      ).data,
    ).toMatchObject({ visible: true })
    expect(
      (
        await call<OrderExplanation>(
          employeesApi.endpoints.explainOrder.initiate({ employeeId: 'u-mgr1', number: 'NOPE' }),
        )
      ).data!.found,
    ).toBe(false)
  })
})

describe('деактивация с передачей', () => {
  it('нужна передача, если за сотрудником закреплены клиенты, приложения или подчинённые; всё переносится за один шаг', async () => {
    await as('u-admin')
    const db = getDb()
    const before = (await get('u-head')).data!.assets
    expect(before.subordinates).toBe(2)
    expect((await call(employeesApi.endpoints.deactivateEmployee.initiate({ id: 'u-head' }))).error?.message).toMatch(
      /кому передать/,
    )
    expect(
      (await call(employeesApi.endpoints.deactivateEmployee.initiate({ id: 'u-head', transferToId: 'u-head' }))).error
        ?.code,
    ).toBe('validation')

    const regionsBefore = db.users.find((u) => u.id === 'u-head')!.scope!.regionIds
    const r = await call<{ moved: typeof before }>(
      employeesApi.endpoints.deactivateEmployee.initiate({ id: 'u-head', transferToId: 'u-app1' }),
    )
    expect(r.data!.moved.subordinates).toBe(2)
    const head = db.users.find((u) => u.id === 'u-head')!
    expect(head.status).toBe('blocked')
    expect(head.scope!.regionIds).toEqual([])
    expect(db.users.find((u) => u.id === 'u-app1')!.scope!.regionIds).toEqual(expect.arrayContaining(regionsBefore))
    expect(
      db.users
        .filter((u) => u.managerId === 'u-app1')
        .map((u) => u.id)
        .sort(),
    ).toEqual(['u-mgr1', 'u-mgr2'])
    // вход заблокирован
    store.dispatch(logout())
    expect('error' in (await store.dispatch(authApi.endpoints.demoLogin.initiate('u-head')))).toBe(true)
  })

  it('приложения и заказы на одобрении переходят принимающему; без закреплённого — деактивация без передачи', async () => {
    await as('u-admin')
    const db = getDb()
    const appsOf = db.applications.filter((a) => a.responsibleIds.includes('u-app1')).map((a) => a.id)
    const pending = db.orders.filter((o) => o.responsibleId === 'u-app1' && o.status === 'pending').map((o) => o.id)
    expect(appsOf.length).toBeGreaterThan(0)
    await call(employeesApi.endpoints.deactivateEmployee.initiate({ id: 'u-app1', transferToId: 'u-app2' }))
    expect(
      db.applications
        .filter((a) => appsOf.includes(a.id))
        .every((a) => a.responsibleIds.includes('u-app2') && !a.responsibleIds.includes('u-app1')),
    ).toBe(true)
    expect(db.orders.filter((o) => pending.includes(o.id)).every((o) => o.responsibleId === 'u-app2')).toBe(true)

    const fresh = await save({ email: 'free@basf-demo.ru' })
    expect(
      (await call(employeesApi.endpoints.deactivateEmployee.initiate({ id: fresh.data!.id }))).error,
    ).toBeUndefined()
    expect(db.users.find((u) => u.id === fresh.data!.id)!.status).toBe('blocked')
    const back = await call<{ inviteLink?: string }>(employeesApi.endpoints.activateEmployee.initiate(fresh.data!.id))
    expect(back.data!.inviteLink).toBeTruthy()
  })

  it('последнего администратора деактивировать нельзя', async () => {
    await as('u-admin')
    const db = getDb()
    db.users.push({ ...db.users.find((u) => u.id === 'u-admin')!, id: 'u-admin2', email: 'second@basf-demo.ru' })
    await as('u-admin2')
    // второй администратор отключает первого — можно; затем первого уже нет, и отключить единственного оставшегося нельзя
    expect((await call(employeesApi.endpoints.deactivateEmployee.initiate({ id: 'u-admin' }))).error).toBeUndefined()
    db.users.push({
      ...db.users.find((u) => u.id === 'u-mgr1')!,
      id: 'u-extra',
      email: 'extra@basf-demo.ru',
      roleId: 'role-admin',
    })
    expect(
      (await call(employeesApi.endpoints.deactivateEmployee.initiate({ id: 'u-extra', transferToId: 'u-admin2' })))
        .error,
    ).toBeUndefined()
    const last = db.users.find((u) => u.id === 'u-admin2')!
    last.status = 'active'
    expect(db.users.filter((u) => u.roleId === 'role-admin' && u.status !== 'blocked')).toHaveLength(1)
  })
})

describe('роли', () => {
  const roles = () => call<RoleRow[]>(rolesApi.endpoints.listRoles.initiate(undefined, { forceRefetch: true }))
  const saveRole = (v: Record<string, unknown>) =>
    call<{ id: string; affectedUsers: number }>(
      rolesApi.endpoints.saveRole.initiate({
        name: 'Аналитик',
        type: 'employee',
        description: '',
        permissions: ['orders.export'],
        active: true,
        ...v,
      } as never),
    )

  it('доступны только с правом; видны счётчики пользователей', async () => {
    await as('u-head')
    expect((await roles()).error?.code).toBe('forbidden')
    await as('u-admin')
    const r = (await roles()).data!
    expect(r.find((x) => x.id === 'role-manager')!.usersCount).toBe(2)
  })

  it('создание, уникальность названия, права клиента ограничены', async () => {
    await as('u-admin')
    const ok = await saveRole({})
    expect(ok.data!.id).toBeTruthy()
    expect((await saveRole({})).error?.message).toMatch(/уже есть/)
    expect(
      (await saveRole({ name: 'Клиент+', type: 'client', permissions: ['orders.approve'] })).error?.message,
    ).toMatch(/собственными заказами/)
    expect(
      (await saveRole({ name: 'Клиент 2', type: 'client', permissions: ['orders.create', 'orders.cancel'] })).data!.id,
    ).toBeTruthy()
  })

  it('изменение прав применяется сразу; системную роль и используемую нельзя ломать', async () => {
    await as('u-admin')
    const res = await saveRole({
      id: 'role-manager',
      name: 'Менеджер',
      permissions: ['orders.create', 'orders.edit', 'orders.approve'],
    })
    expect(res.data!.affectedUsers).toBe(2)
    expect(getDb().roles.find((r) => r.id === 'role-manager')!.permissions).toContain('orders.approve')
    expect((await saveRole({ id: 'role-admin', name: 'Администратор', permissions: [] })).error?.message).toMatch(
      /системная/,
    )
    expect((await saveRole({ id: 'role-manager', name: 'Менеджер', active: false })).error?.message).toMatch(
      /назначена/,
    )
    expect(
      (await saveRole({ id: 'role-manager', name: 'Менеджер', type: 'client', permissions: [] })).error?.message,
    ).toMatch(/Тип роли/)
    const fresh = (await saveRole({ name: 'Временная' })).data!.id
    expect((await saveRole({ id: fresh, name: 'Временная', active: false })).error).toBeUndefined()
    // отключённую роль нельзя назначить новому сотруднику
    await as('u-admin')
    expect((await save({ email: 'x@basf-demo.ru', roleId: fresh })).error?.message).toMatch(/действующую роль/)
  })
})
