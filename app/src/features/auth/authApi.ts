import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { newId } from '@/mocks/db'
import { issueToken } from '@/mocks/invites'
import type { Db } from '@/mocks/seed'
import { isPasswordValid } from '@/shared/lib/password'
import { fullName } from '@/shared/lib/format'
import type { SafeUser, TokenType, User } from '@/shared/types/domain'
import type { Me } from './permissions'
import dayjs from 'dayjs'

const strip = ({ password: _p, ...rest }: User): SafeUser => rest

const attempts = new Map<string, { count: number; until: number }>()
const MAX_ATTEMPTS = 5
const LOCK_MS = 60_000

const findByEmail = (db: Db, email: string) =>
  db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())

function buildMe(db: Db, user: User): Me {
  const role = db.roles.find((r) => r.id === user.roleId)
  if (!role) throw new MockError('role', 'Роль пользователя не найдена')
  return { user: strip(user), role, clientName: db.clients.find((c) => c.id === user.clientId)?.name }
}

function assertCanLogin(db: Db, user: User) {
  if (user.status === 'blocked') throw new MockError('blocked', 'blocked')
  if (user.status === 'invited') throw new MockError('invited', 'invited')
  const client = db.clients.find((c) => c.id === user.clientId)
  if (client && !client.active) throw new MockError('blocked', 'blocked')
}

function openSession(db: Db, user: User) {
  return { userId: user.id, expiresAt: dayjs().add(db.settings.sessionHours, 'hour').toISOString() }
}

function validToken(db: Db, token: string) {
  const t = db.tokens.find((x) => x.token === token)
  if (!t || dayjs(t.expiresAt).isBefore(dayjs())) throw new MockError('token', 'Ссылка устарела или уже использована')
  const user = db.users.find((u) => u.id === t.userId)
  if (!user) throw new MockError('token', 'Ссылка устарела или уже использована')
  return { t, user }
}

export interface DemoPersona {
  userId: string
  name: string
  roleName: string
  description: string
  company?: string
}

const PERSONA_NOTES: Record<string, string> = {
  'c-1a': 'Собирает заказы и следит за статусами',
  'c-1b': 'Коллега из той же компании — видит те же заказы',
  'u-mgr1': 'Создаёт и исправляет заказы за клиентов',
  'u-app1': 'Одобряет или отклоняет заказы',
  'u-head': 'Видит заказы своей команды',
  'u-admin': 'Видит всё и настраивает систему',
}

export const authApi = api.injectEndpoints({
  endpoints: (b) => ({
    getMe: b.query<Me, string>({
      queryFn: (userId) =>
        mock((db) => {
          const user = db.users.find((u) => u.id === userId)
          if (!user || user.status !== 'active') throw new MockError('session', 'Сессия завершена')
          return buildMe(db, user)
        }),
      providesTags: ['Me'],
    }),

    getDemoPersonas: b.query<DemoPersona[], void>({
      queryFn: () =>
        mock((db) =>
          Object.keys(PERSONA_NOTES).map((id) => {
            const u = db.users.find((x) => x.id === id)!
            return {
              userId: id,
              name: fullName(u),
              roleName: db.roles.find((r) => r.id === u.roleId)!.name,
              description: PERSONA_NOTES[id],
              company: db.clients.find((c) => c.id === u.clientId)?.name,
            }
          }),
        ),
    }),

    login: b.mutation<{ userId: string; expiresAt: string }, { email: string; password: string }>({
      queryFn: ({ email, password }) =>
        mock((db) => {
          const key = email.trim().toLowerCase()
          const a = attempts.get(key)
          if (a && a.until > Date.now()) throw new MockError('locked', 'locked')
          const user = findByEmail(db, email)
          if (user?.status === 'invited') throw new MockError('invited', 'invited')
          if (!user || !password || user.password !== password) {
            const cur = attempts.get(key) ?? { count: 0, until: 0 }
            cur.count += 1
            if (cur.count >= MAX_ATTEMPTS) {
              cur.until = Date.now() + LOCK_MS
              cur.count = 0
            }
            attempts.set(key, cur)
            throw new MockError('credentials', 'credentials')
          }
          attempts.delete(key)
          assertCanLogin(db, user)
          return openSession(db, user)
        }),
    }),

    demoLogin: b.mutation<{ userId: string; expiresAt: string }, string>({
      queryFn: (userId) =>
        mock((db) => {
          const user = db.users.find((u) => u.id === userId)
          if (!user) throw new MockError('credentials', 'credentials')
          assertCanLogin(db, user)
          return openSession(db, user)
        }),
    }),

    requestPasswordReset: b.mutation<{ demoLink?: string }, { email: string }>({
      queryFn: ({ email }) =>
        mock(
          (db) => {
            const user = findByEmail(db, email)
            // Ответ не раскрывает, есть ли такой адрес в системе.
            if (!user || user.status === 'blocked') return {}
            const type: TokenType = user.status === 'invited' ? 'invite' : 'reset'
            const token = issueToken(db, user.id, type)
            const link = `/${type === 'invite' ? 'activate' : 'reset'}/${token}`
            db.emails.push({
              id: newId('em'),
              to: user.email,
              at: new Date().toISOString(),
              subject: type === 'invite' ? 'Приглашение в кабинет дистрибьютора' : 'Восстановление пароля',
              body:
                type === 'invite'
                  ? 'Задайте пароль, чтобы войти в кабинет.'
                  : 'Перейдите по ссылке, чтобы создать новый пароль. Ссылка действует 1 час.',
              link,
            })
            return { demoLink: link }
          },
          { write: true },
        ),
    }),

    getTokenInfo: b.query<{ type: TokenType; name: string; email: string }, string>({
      queryFn: (token) =>
        mock((db) => {
          const { t, user } = validToken(db, token)
          return { type: t.type, name: user.firstName, email: user.email }
        }),
    }),

    setPasswordByToken: b.mutation<
      { type: TokenType; userId: string; expiresAt: string },
      { token: string; password: string }
    >({
      queryFn: ({ token, password }) =>
        mock(
          (db) => {
            const { t, user } = validToken(db, token)
            if (!isPasswordValid(password, user.email))
              throw new MockError('policy', 'Пароль не соответствует требованиям')
            user.password = password
            if (user.status === 'invited') user.status = 'active'
            db.tokens = db.tokens.filter((x) => x.token !== token)
            return { type: t.type, ...openSession(db, user) }
          },
          { write: true },
        ),
    }),

    changePassword: b.mutation<void, { userId: string; current: string; next: string }>({
      queryFn: ({ userId, current, next }) =>
        mock(
          (db) => {
            const user = db.users.find((u) => u.id === userId)
            if (!user) throw new MockError('session', 'Сессия завершена')
            if (user.password !== current) throw new MockError('wrongCurrent', 'Текущий пароль указан неверно')
            if (!isPasswordValid(next, user.email)) throw new MockError('policy', 'Пароль не соответствует требованиям')
            user.password = next
          },
          { write: true },
        ),
    }),

    updateProfile: b.mutation<void, { userId: string; firstName: string; lastName: string; phone: string }>({
      queryFn: ({ userId, ...patch }) =>
        mock(
          (db) => {
            const user = db.users.find((u) => u.id === userId)
            if (!user) throw new MockError('session', 'Сессия завершена')
            Object.assign(user, patch)
          },
          { write: true },
        ),
      invalidatesTags: ['Me'],
    }),
  }),
})

export const {
  useGetMeQuery,
  useGetDemoPersonasQuery,
  useLoginMutation,
  useDemoLoginMutation,
  useRequestPasswordResetMutation,
  useGetTokenInfoQuery,
  useSetPasswordByTokenMutation,
  useChangePasswordMutation,
  useUpdateProfileMutation,
} = authApi
