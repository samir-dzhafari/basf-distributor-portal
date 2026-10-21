import type { Permission } from '@/shared/types/domain'
import { ru } from '@/shared/i18n/ru'
import { can, isClient, type Me } from '@/features/auth/permissions'

export interface NavItem {
  key: string
  label: string
  path?: string
  perm?: Permission
  children?: NavItem[]
}

/** Меню собирается по правам: недоступное не показываем вообще. */
export function buildNav(me: Me): NavItem[] {
  const items: NavItem[] = [
    { key: 'orders', path: '/orders', label: isClient(me) ? ru.nav.myOrders : ru.nav.orders },
    { key: 'approvals', path: '/approvals', label: ru.nav.approvals, perm: 'orders.approve' },
    { key: 'clients', path: '/clients', label: ru.nav.clients, perm: 'clients.manage' },
    {
      key: 'catalog',
      label: ru.nav.catalog,
      children: [
        { key: 'products', path: '/catalog/products', label: ru.nav.products, perm: 'products.manage' },
        { key: 'applications', path: '/applications', label: ru.nav.applications, perm: 'applications.manage' },
        { key: 'dictionaries', path: '/dictionaries', label: ru.nav.dictionaries, perm: 'dictionaries.manage' },
      ],
    },
    {
      key: 'admin',
      label: ru.nav.admin,
      children: [
        { key: 'employees', path: '/admin/employees', label: ru.nav.employees, perm: 'users.manage' },
        { key: 'roles', path: '/admin/roles', label: ru.nav.roles, perm: 'roles.manage' },
        { key: 'exchange', path: '/admin/exchange', label: ru.nav.exchange, perm: 'exchange.manage' },
        { key: 'mailing', path: '/admin/notifications', label: ru.nav.mailing, perm: 'settings.manage' },
        { key: 'audit', path: '/admin/audit', label: ru.nav.audit, perm: 'audit.view' },
        { key: 'settings', path: '/admin/settings', label: ru.nav.settings, perm: 'settings.manage' },
      ],
    },
  ]
  const visible = (i: NavItem): NavItem | null => {
    if (i.children) {
      const ch = i.children.map(visible).filter((x): x is NavItem => !!x)
      return ch.length ? { ...i, children: ch } : null
    }
    return !i.perm || can(me, i.perm) ? i : null
  }
  return items.map(visible).filter((x): x is NavItem => !!x)
}

export const flatten = (items: NavItem[]): NavItem[] => items.flatMap((i) => (i.children ? flatten(i.children) : [i]))
