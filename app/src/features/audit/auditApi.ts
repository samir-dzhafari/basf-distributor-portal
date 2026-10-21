import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { currentUser, hasPermission } from '@/mocks/access'
import { fullName } from '@/shared/lib/format'
import type { AuditChange, AuditEntity, AuditEntry, Id } from '@/shared/types/domain'

export interface AuditQuery {
  q: string
  entity: AuditEntity | ''
  userId: Id
  /** YYYY-MM-DD, включительно */
  from: string
  to: string
  page: number
  pageSize: number
}

export interface AuditRow extends AuditEntry {
  userName: string
}

export interface AuditResult {
  rows: AuditRow[]
  total: number
  users: { id: Id; name: string }[]
}

export type { AuditChange }

export const auditApi = api.injectEndpoints({
  endpoints: (b) => ({
    listAudit: b.query<AuditResult, AuditQuery>({
      queryFn: (q, qa) =>
        mock((db) => {
          if (!hasPermission(db, currentUser(db, qa), 'audit.view'))
            throw new MockError('forbidden', 'Журнал действий вам недоступен')
          const s = q.q.trim().toLowerCase()
          const nameOf = (id: Id) => fullName(db.users.find((u) => u.id === id))
          const list = db.audit
            .filter((e) => !q.entity || e.entity === q.entity)
            .filter((e) => !q.userId || e.userId === q.userId)
            .filter((e) => !q.from || e.at.slice(0, 10) >= q.from)
            .filter((e) => !q.to || e.at.slice(0, 10) <= q.to)
            .filter(
              (e) =>
                !s ||
                [
                  e.entityName,
                  e.action,
                  e.summary ?? '',
                  nameOf(e.userId),
                  ...e.changes.map((c) => `${c.field} ${c.from ?? ''} ${c.to ?? ''}`),
                ]
                  .join(' ')
                  .toLowerCase()
                  .includes(s),
            )
          const start = (q.page - 1) * q.pageSize
          return {
            rows: list.slice(start, start + q.pageSize).map((e) => ({ ...e, userName: nameOf(e.userId) })),
            total: list.length,
            users: [...new Set(db.audit.map((e) => e.userId))]
              .map((id) => ({ id, name: nameOf(id) }))
              .sort((a, b2) => a.name.localeCompare(b2.name, 'ru')),
          }
        }),
      providesTags: [{ type: 'Audit', id: 'LIST' }],
    }),
  }),
})

export const { useListAuditQuery } = auditApi
