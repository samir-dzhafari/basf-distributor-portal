import type { Permission, Role, SafeUser } from '@/shared/types/domain'

export interface Me {
  user: SafeUser
  role: Role
  clientName?: string
}

export const can = (me: Me | undefined | null, perm: Permission): boolean =>
  !!me && (me.role.fullAccess === true || me.role.permissions.includes(perm))

export const canAny = (me: Me | undefined | null, perms: Permission[]): boolean => perms.some((p) => can(me, p))

export const isClient = (me: Me | undefined | null) => me?.user.kind === 'client'
export const isAdmin = (me: Me | undefined | null) => me?.role.fullAccess === true
