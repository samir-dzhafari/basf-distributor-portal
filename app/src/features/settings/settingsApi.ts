import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { audit, diff } from '@/mocks/audit'
import { currentUser, hasPermission } from '@/mocks/access'
import { isEmail } from '@/shared/lib/requisites'
import type { SystemSettings } from '@/shared/types/domain'

export interface SettingsView {
  settings: SystemSettings
  /** Сколько клиентов уже превышают текущий лимит пользователей. */
  clientsOverLimit: number
}

const LABELS = {
  clientUserLimit: 'Лимит пользователей на клиента',
  separateCreateApprove: 'Разделение полномочий: создал ≠ одобрил',
  sessionHours: 'Срок жизни сессии, часов',
  senderEmail: 'Адрес отправителя писем',
  multiLevelApproval: 'Многоуровневое одобрение',
}

export const settingsApi = api.injectEndpoints({
  endpoints: (b) => ({
    getSettings: b.query<SettingsView, void>({
      queryFn: (_a, qa) =>
        mock((db) => {
          if (!hasPermission(db, currentUser(db, qa), 'settings.manage'))
            throw new MockError('forbidden', 'Настройки вам недоступны')
          const over = db.clients.filter(
            (c) => db.users.filter((u) => u.clientId === c.id).length > db.settings.clientUserLimit,
          ).length
          return { settings: db.settings, clientsOverLimit: over }
        }),
      providesTags: ['Settings'],
    }),

    updateSettings: b.mutation<SettingsView, SystemSettings>({
      queryFn: (s, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            if (!hasPermission(db, user, 'settings.manage'))
              throw new MockError('forbidden', 'Настройки вам недоступны')
            const fail = (m: string): never => {
              throw new MockError('validation', m)
            }
            if (!Number.isInteger(s.clientUserLimit) || s.clientUserLimit < 1 || s.clientUserLimit > 100)
              fail('Лимит пользователей — целое число от 1 до 100')
            if (!Number.isInteger(s.sessionHours) || s.sessionHours < 1 || s.sessionHours > 72)
              fail('Срок сессии — от 1 до 72 часов')
            if (!isEmail(s.senderEmail)) fail('Проверьте адрес отправителя')
            const next: SystemSettings = {
              clientUserLimit: s.clientUserLimit,
              separateCreateApprove: !!s.separateCreateApprove,
              sessionHours: s.sessionHours,
              senderEmail: s.senderEmail.trim(),
              multiLevelApproval: !!s.multiLevelApproval,
            }
            const changes = diff(db.settings, next, LABELS)
            db.settings = next
            if (changes.length)
              audit(db, user, { entity: 'settings', entityName: 'Системные настройки', action: 'Изменены', changes })
            const over = db.clients.filter(
              (c) => db.users.filter((u) => u.clientId === c.id).length > next.clientUserLimit,
            ).length
            return { settings: next, clientsOverLimit: over }
          },
          { write: true },
        ),
      invalidatesTags: ['Settings', 'Audit'],
    }),
  }),
})

export const { useGetSettingsQuery, useUpdateSettingsMutation } = settingsApi
