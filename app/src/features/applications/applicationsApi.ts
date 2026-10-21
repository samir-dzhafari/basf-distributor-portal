import dayjs from 'dayjs'
import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { accessibleClientIds, currentUser, hasPermission } from '@/mocks/access'
import {
  analyzeApplicationsImport,
  applyApplicationsImport,
  type ApplicationsImportInput,
  type ApplicationsPreview,
} from '@/mocks/applicationsImport'
import { newId } from '@/mocks/db'
import type { ImportCounts } from '@/mocks/importTypes'
import type { Db } from '@/mocks/seed'
import { audit, diff, type AuditInput } from '@/mocks/audit'
import { fullName } from '@/shared/lib/format'
import type { Application, BusinessType, Id, Region, User } from '@/shared/types/domain'

export type ApplicationState = 'active' | 'future' | 'expired' | 'inactive'
export type ApplicationStatusFilter = 'all' | ApplicationState

export interface ApplicationsQuery {
  q: string
  clientId: Id
  regionId: Id
  businessTypeId: Id
  responsibleId: Id
  status: ApplicationStatusFilter
  page: number
  pageSize: number
  sortBy: 'number' | 'client' | 'validTo'
  sortDir: 'asc' | 'desc'
}

export interface ApplicationRow extends Application {
  clientName: string
  regionName: string
  businessTypeName: string
  responsibleNames: string[]
  state: ApplicationState
}

export interface ApplicationsResult {
  rows: ApplicationRow[]
  total: number
  counts: Record<ApplicationState, number>
}

export interface ApplicationRefs {
  clients: { id: Id; name: string; code: string; regionIds: Id[]; businessTypeIds: Id[] }[]
  regions: Region[]
  businessTypes: BusinessType[]
  employees: { id: Id; name: string; roleName: string }[]
}

export type ApplicationInput = Omit<Application, 'id'> & { id?: Id }

export interface MassApplicationPatch {
  ids: Id[]
  active?: boolean
  addResponsibleIds?: Id[]
  removeResponsibleIds?: Id[]
}

// ---------------------------------------------------------------------------------------------

const rec = (db: Db, qa: { getState: () => unknown }, input: AuditInput) => audit(db, currentUser(db, qa), input)
const APP_LABELS = {
  number: 'Номер',
  regionId: 'Регион',
  businessTypeId: 'Тип бизнеса',
  validFrom: 'Действует с',
  validTo: 'Действует по',
  responsibleIds: 'Ответственные',
  active: 'Действует',
}

function allowed(db: Db, user: User) {
  if (!hasPermission(db, user, 'applications.manage'))
    throw new MockError('forbidden', 'Раздел «Приложения» вам недоступен')
  return accessibleClientIds(db, user)
}

export function stateOf(
  a: Pick<Application, 'active' | 'validFrom' | 'validTo'>,
  today = dayjs().format('YYYY-MM-DD'),
): ApplicationState {
  if (!a.active) return 'inactive'
  if (a.validTo < today) return 'expired'
  if (a.validFrom > today) return 'future'
  return 'active'
}

const fail = (message: string): never => {
  throw new MockError('validation', message)
}

function validate(db: Db, v: ApplicationInput, ids: Set<Id>) {
  if (!v.number.trim()) fail('Укажите номер приложения')
  if (db.applications.some((a) => a.number.toLowerCase() === v.number.trim().toLowerCase() && a.id !== v.id))
    fail('Приложение с таким номером уже есть')
  const client = db.clients.find((c) => c.id === v.clientId)
  if (!client || !ids.has(client.id)) fail('Выберите клиента')
  if (!client!.regionIds.includes(v.regionId)) fail('Регион не относится к этому клиенту')
  if (!client!.businessTypeIds.includes(v.businessTypeId)) fail('Тип бизнеса не открыт этому клиенту')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.validFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(v.validTo))
    fail('Укажите период действия')
  if (v.validTo < v.validFrom) fail('Дата окончания не может быть раньше начала')
  const employees = new Set(db.users.filter((u) => u.kind === 'employee').map((u) => u.id))
  if (v.responsibleIds.some((id) => !employees.has(id))) fail('Ответственными могут быть только сотрудники BASF')
}

const tags = ['Application' as const]

export const applicationsApi = api.injectEndpoints({
  endpoints: (b) => ({
    getApplicationRefs: b.query<ApplicationRefs, void>({
      queryFn: (_a, qa) =>
        mock((db) => {
          const ids = allowed(db, currentUser(db, qa))
          return {
            clients: db.clients
              .filter((c) => ids.has(c.id))
              .map((c) => ({
                id: c.id,
                name: c.name,
                code: c.code,
                regionIds: c.regionIds,
                businessTypeIds: c.businessTypeIds,
              }))
              .sort((a, b2) => a.name.localeCompare(b2.name, 'ru')),
            regions: db.regions,
            businessTypes: db.businessTypes,
            employees: db.users
              .filter((u) => u.kind === 'employee' && u.status !== 'blocked')
              .map((u) => ({
                id: u.id,
                name: fullName(u),
                roleName: db.roles.find((r) => r.id === u.roleId)?.name ?? '',
              }))
              .sort((a, b2) => a.name.localeCompare(b2.name, 'ru')),
          }
        }),
      providesTags: ['Dictionary', 'Client'],
    }),

    listApplications: b.query<ApplicationsResult, ApplicationsQuery>({
      queryFn: (q, qa) =>
        mock((db) => {
          const ids = allowed(db, currentUser(db, qa))
          const rows = db.applications
            .filter((a) => ids.has(a.clientId))
            .map<ApplicationRow>((a) => ({
              ...a,
              clientName: db.clients.find((c) => c.id === a.clientId)?.name ?? '—',
              regionName: db.regions.find((r) => r.id === a.regionId)?.name ?? '—',
              businessTypeName: db.businessTypes.find((t) => t.id === a.businessTypeId)?.name ?? '—',
              responsibleNames: a.responsibleIds.map((id) => fullName(db.users.find((u) => u.id === id))),
              state: stateOf(a),
            }))
          const s = q.q.trim().toLowerCase()
          const base = rows
            .filter((a) => !s || a.number.toLowerCase().includes(s) || a.clientName.toLowerCase().includes(s))
            .filter((a) => !q.clientId || a.clientId === q.clientId)
            .filter((a) => !q.regionId || a.regionId === q.regionId)
            .filter((a) => !q.businessTypeId || a.businessTypeId === q.businessTypeId)
            .filter((a) => !q.responsibleId || a.responsibleIds.includes(q.responsibleId))
          const counts: ApplicationsResult['counts'] = { active: 0, future: 0, expired: 0, inactive: 0 }
          base.forEach((a) => counts[a.state]++)
          const list = base.filter((a) => q.status === 'all' || a.state === q.status)
          const key = { number: 'number', client: 'clientName', validTo: 'validTo' }[q.sortBy] as
            'number' | 'clientName' | 'validTo'
          const sign = q.sortDir === 'asc' ? 1 : -1
          list.sort((a, b2) => sign * a[key].localeCompare(b2[key], 'ru', { numeric: true }))
          const start = (q.page - 1) * q.pageSize
          return { rows: list.slice(start, start + q.pageSize), total: list.length, counts }
        }),
      providesTags: tags,
    }),

    saveApplication: b.mutation<{ id: Id }, ApplicationInput>({
      queryFn: (input, qa) =>
        mock(
          (db) => {
            const ids = allowed(db, currentUser(db, qa))
            const v = { ...input, number: input.number.trim() }
            validate(db, v, ids)
            const existing = v.id ? db.applications.find((a) => a.id === v.id) : undefined
            if (v.id && (!existing || !ids.has(existing.clientId)))
              throw new MockError('notFound', 'Приложение не найдено')
            const data = { ...v, responsibleIds: [...new Set(v.responsibleIds)] }
            if (existing) {
              const changes = diff(existing, data, APP_LABELS, {
                regionId: (x) => db.regions.find((r) => r.id === x)?.name ?? String(x),
                businessTypeId: (x) => db.businessTypes.find((b) => b.id === x)?.name ?? String(x),
                responsibleIds: (x) =>
                  (x as string[]).map((id) => fullName(db.users.find((u) => u.id === id))).join(', '),
              })
              Object.assign(existing, data)
              if (changes.length)
                rec(db, qa, {
                  entity: 'application',
                  entityId: existing.id,
                  entityName: v.number,
                  action: 'Изменено',
                  changes,
                })
              return { id: existing.id }
            }
            const app: Application = { ...data, id: newId('ap') }
            db.applications.push(app)
            rec(db, qa, { entity: 'application', entityId: app.id, entityName: app.number, action: 'Создано' })
            return { id: app.id }
          },
          { write: true },
        ),
      invalidatesTags: [...tags, 'Order'],
    }),

    massUpdateApplications: b.mutation<{ updated: number }, MassApplicationPatch>({
      queryFn: (patch, qa) =>
        mock(
          (db) => {
            const ids = allowed(db, currentUser(db, qa))
            if (!patch.ids.length) fail('Отметьте приложения')
            const employees = new Set(db.users.filter((u) => u.kind === 'employee').map((u) => u.id))
            if ((patch.addResponsibleIds ?? []).some((id) => !employees.has(id)))
              fail('Ответственными могут быть только сотрудники BASF')
            const items = db.applications.filter((a) => patch.ids.includes(a.id) && ids.has(a.clientId))
            items.forEach((a) => {
              if (patch.active !== undefined) a.active = patch.active
              if (patch.addResponsibleIds)
                a.responsibleIds = [...new Set([...a.responsibleIds, ...patch.addResponsibleIds])]
              if (patch.removeResponsibleIds)
                a.responsibleIds = a.responsibleIds.filter((id) => !patch.removeResponsibleIds!.includes(id))
            })
            rec(db, qa, {
              entity: 'application',
              entityName: `Приложений: ${items.length}`,
              action: 'Массовое изменение',
              summary: [
                patch.active !== undefined && (patch.active ? 'включены' : 'отключены'),
                patch.addResponsibleIds && 'добавлен ответственный',
                patch.removeResponsibleIds && 'снят ответственный',
              ]
                .filter(Boolean)
                .join(', '),
            })
            return { updated: items.length }
          },
          { write: true },
        ),
      invalidatesTags: [...tags, 'Order'],
    }),

    previewApplicationsImport: b.mutation<ApplicationsPreview, ApplicationsImportInput>({
      queryFn: (input, qa) =>
        mock((db) => analyzeApplicationsImport(db, input, allowed(db, currentUser(db, qa))).preview),
    }),

    applyApplicationsImport: b.mutation<ImportCounts, ApplicationsImportInput>({
      queryFn: (input, qa) =>
        mock(
          (db) => {
            const result = applyApplicationsImport(db, input, allowed(db, currentUser(db, qa)))
            rec(db, qa, {
              entity: 'import',
              entityName: 'Приложения',
              action: 'Импорт из Excel',
              summary: `Создано: ${result.new}, обновлено: ${result.update}, с ошибками: ${result.error}`,
            })
            return result
          },
          { write: true },
        ),
      invalidatesTags: [...tags, 'Order'],
    }),
  }),
})

export const {
  useGetApplicationRefsQuery,
  useListApplicationsQuery,
  useSaveApplicationMutation,
  useMassUpdateApplicationsMutation,
  usePreviewApplicationsImportMutation,
  useApplyApplicationsImportMutation,
} = applicationsApi
