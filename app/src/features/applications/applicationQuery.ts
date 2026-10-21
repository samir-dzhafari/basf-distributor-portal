import type { ApplicationStatusFilter, ApplicationsQuery } from './applicationsApi'

export const defaultApplicationQuery = (): ApplicationsQuery => ({
  q: '',
  clientId: '',
  regionId: '',
  businessTypeId: '',
  responsibleId: '',
  status: 'all',
  page: 1,
  pageSize: 20,
  sortBy: 'number',
  sortDir: 'asc',
})

const STATUSES: ApplicationStatusFilter[] = ['all', 'active', 'future', 'expired', 'inactive']

export function parseApplicationQuery(sp: URLSearchParams): ApplicationsQuery {
  const q = defaultApplicationQuery()
  q.q = sp.get('q') ?? ''
  q.clientId = sp.get('client') ?? ''
  q.regionId = sp.get('region') ?? ''
  q.businessTypeId = sp.get('bt') ?? ''
  q.responsibleId = sp.get('resp') ?? ''
  const status = sp.get('status') as ApplicationStatusFilter | null
  if (status && STATUSES.includes(status)) q.status = status
  const page = Number(sp.get('page'))
  if (Number.isInteger(page) && page > 0) q.page = page
  if ([10, 20, 50].includes(Number(sp.get('size')))) q.pageSize = Number(sp.get('size'))
  const sort = sp.get('sort')
  if (sort === 'client' || sort === 'validTo') q.sortBy = sort
  if (sp.get('dir') === 'desc') q.sortDir = 'desc'
  return q
}

export function toApplicationParams(q: ApplicationsQuery): URLSearchParams {
  const sp = new URLSearchParams()
  const d = defaultApplicationQuery()
  if (q.q) sp.set('q', q.q)
  if (q.clientId) sp.set('client', q.clientId)
  if (q.regionId) sp.set('region', q.regionId)
  if (q.businessTypeId) sp.set('bt', q.businessTypeId)
  if (q.responsibleId) sp.set('resp', q.responsibleId)
  if (q.status !== d.status) sp.set('status', q.status)
  if (q.page !== d.page) sp.set('page', String(q.page))
  if (q.pageSize !== d.pageSize) sp.set('size', String(q.pageSize))
  if (q.sortBy !== d.sortBy) sp.set('sort', q.sortBy)
  if (q.sortDir !== d.sortDir) sp.set('dir', q.sortDir)
  return sp
}
