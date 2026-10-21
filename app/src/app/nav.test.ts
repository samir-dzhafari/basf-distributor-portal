import { describe, expect, it } from 'vitest'
import type { Role, SafeUser } from '@/shared/types/domain'
import { can, isAdmin, isClient, type Me } from '@/features/auth/permissions'
import { buildNav, flatten } from './nav'

const role = (over: Partial<Role>): Role => ({ id: 'r', name: 'r', permissions: [], ...over }) as Role
const me = (kind: 'client' | 'staff', r: Partial<Role>): Me => ({ user: { id: 'u', kind } as SafeUser, role: role(r) })

describe('buildNav', () => {
  it('клиенту показывает только «Мои заказы»', () => {
    const keys = flatten(buildNav(me('client', { permissions: ['orders.create'] }))).map((i) => i.key)
    expect(keys).toEqual(['orders'])
  })

  it('прячет разделы без прав и пустые группы', () => {
    const nav = buildNav(me('staff', { permissions: ['orders.approve'] }))
    expect(nav.map((i) => i.key)).toEqual(['orders', 'approvals'])
  })

  it('администратор видит всё', () => {
    const m = me('staff', { fullAccess: true })
    const keys = flatten(buildNav(m)).map((i) => i.key)
    expect(keys).toEqual(expect.arrayContaining(['approvals', 'clients', 'products', 'roles', 'audit', 'settings']))
    expect(isAdmin(m)).toBe(true)
  })
})

describe('can', () => {
  it('без сессии прав нет', () => {
    expect(can(undefined, 'orders.create')).toBe(false)
  })
  it('учитывает список прав и тип пользователя', () => {
    const m = me('client', { permissions: ['orders.create'] })
    expect(can(m, 'orders.create')).toBe(true)
    expect(can(m, 'orders.approve')).toBe(false)
    expect(isClient(m)).toBe(true)
  })
})
