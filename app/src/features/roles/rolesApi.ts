import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { newId } from '@/mocks/db'
import { currentUser, hasPermission } from '@/mocks/access'
import type { Db } from '@/mocks/seed'
import { audit, diff, type AuditInput } from '@/mocks/audit'
import { CLIENT_PERMISSIONS, PERMISSION_LABEL } from '@/shared/lib/permissionsMeta'
import { PERMISSIONS, type Id, type Permission, type Role, type RoleType, type User } from '@/shared/types/domain'

export interface RoleRow extends Role {
  usersCount: number
  activeUsersCount: number
}

export interface RoleInput {
  id?: Id
  name: string
  type: RoleType
  description: string
  permissions: Permission[]
  active: boolean
}

const rec = (db: Db, qa: { getState: () => unknown }, input: AuditInput) => audit(db, currentUser(db, qa), input)

const guard = (db: Db, user: User) => {
  if (!hasPermission(db, user, 'roles.manage')) throw new MockError('forbidden', 'Роли вам недоступны')
}
const fail = (message: string): never => {
  throw new MockError('validation', message)
}

export const rolesApi = api.injectEndpoints({
  endpoints: (b) => ({
    listRoles: b.query<RoleRow[], void>({
      queryFn: (_a, qa) =>
        mock((db) => {
          guard(db, currentUser(db, qa))
          return db.roles.map((r) => ({
            ...r,
            usersCount: db.users.filter((u) => u.roleId === r.id).length,
            activeUsersCount: db.users.filter((u) => u.roleId === r.id && u.status !== 'blocked').length,
          }))
        }),
      providesTags: ['Role'],
    }),

    saveRole: b.mutation<{ id: Id; affectedUsers: number }, RoleInput>({
      queryFn: (input, qa) =>
        mock(
          (db) => {
            guard(db, currentUser(db, qa))
            const name = input.name.trim()
            if (!name) fail('Укажите название роли')
            if (db.roles.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== input.id))
              fail('Роль с таким названием уже есть')
            if (input.type !== 'employee' && input.type !== 'client') fail('Выберите тип роли')
            const perms = [...new Set(input.permissions)].filter((p) => (PERMISSIONS as readonly string[]).includes(p))
            if (input.type === 'client' && perms.some((p) => !CLIENT_PERMISSIONS.includes(p))) {
              fail('Роли клиента можно давать только действия с собственными заказами')
            }
            const existing = input.id ? db.roles.find((r) => r.id === input.id) : undefined
            if (input.id && !existing) throw new MockError('notFound', 'Роль не найдена')
            const users = existing ? db.users.filter((u) => u.roleId === existing.id) : []
            if (existing) {
              if (existing.fullAccess) fail('Роль администратора — системная: её состав и статус менять нельзя')
              if (existing.type !== input.type && users.length)
                fail('Тип роли нельзя менять, пока она назначена пользователям')
              if (!input.active && users.some((u) => u.status !== 'blocked')) {
                fail('Нельзя отключить роль, пока она назначена активным пользователям — сначала назначьте им другую')
              }
              const before = {
                name: existing.name,
                description: existing.description,
                active: existing.active,
                permissions: [...existing.permissions],
              }
              Object.assign(existing, {
                name,
                type: input.type,
                description: input.description.trim(),
                permissions: perms,
                active: input.active,
              })
              const added = perms.filter((p) => !before.permissions.includes(p)).map((p) => PERMISSION_LABEL[p])
              const removed = before.permissions.filter((p) => !perms.includes(p)).map((p) => PERMISSION_LABEL[p])
              const changes = diff(
                before,
                { name, description: input.description.trim(), active: input.active },
                { name: 'Название', description: 'Описание', active: 'Действует' },
              )
              if (added.length) changes.push({ field: 'Добавлены разрешения', to: added.join(', ') })
              if (removed.length) changes.push({ field: 'Убраны разрешения', from: removed.join(', ') })
              if (changes.length)
                rec(db, qa, { entity: 'role', entityId: existing.id, entityName: name, action: 'Изменена', changes })
              return { id: existing.id, affectedUsers: users.length }
            }
            const role: Role = {
              id: newId('role'),
              name,
              type: input.type,
              description: input.description.trim(),
              permissions: perms,
              active: input.active,
            }
            db.roles.push(role)
            rec(db, qa, {
              entity: 'role',
              entityId: role.id,
              entityName: role.name,
              action: 'Создана',
              summary: `Разрешений: ${role.permissions.length}`,
            })
            return { id: role.id, affectedUsers: 0 }
          },
          { write: true },
        ),
      invalidatesTags: ['Role', 'User', 'Me'],
    }),
  }),
})

export const { useListRolesQuery, useSaveRoleMutation } = rolesApi
