import type { ClientsQuery, ClientStatusFilter } from '../clientsApi'

export const defaultClientQuery = (): ClientsQuery => ({
  q: '',
  regionId: '',
  groupId: '',
  status: 'all',
  page: 1,
  pageSize: 20,
  sortBy: 'name',
  sortDir: 'asc',
})

const STATUSES: ClientStatusFilter[] = ['all', 'active', 'inactive']

/** Фильтры списка клиентов хранятся в адресной строке. */
export function parseClientQuery(sp: URLSearchParams): ClientsQuery {
  const q = defaultClientQuery()
  q.q = sp.get('q') ?? ''
  q.regionId = sp.get('region') ?? ''
  q.groupId = sp.get('group') ?? ''
  const status = sp.get('status') as ClientStatusFilter | null
  if (status && STATUSES.includes(status)) q.status = status
  const page = Number(sp.get('page'))
  if (Number.isInteger(page) && page > 0) q.page = page
  const size = Number(sp.get('size'))
  if ([10, 20, 50].includes(size)) q.pageSize = size
  if (sp.get('sort') === 'code') q.sortBy = 'code'
  if (sp.get('dir') === 'desc') q.sortDir = 'desc'
  return q
}

export function toClientParams(q: ClientsQuery, tab?: string): URLSearchParams {
  const sp = new URLSearchParams()
  const d = defaultClientQuery()
  if (tab) sp.set('tab', tab)
  if (q.q) sp.set('q', q.q)
  if (q.regionId) sp.set('region', q.regionId)
  if (q.groupId) sp.set('group', q.groupId)
  if (q.status !== d.status) sp.set('status', q.status)
  if (q.page !== d.page) sp.set('page', String(q.page))
  if (q.pageSize !== d.pageSize) sp.set('size', String(q.pageSize))
  if (q.sortBy !== d.sortBy) sp.set('sort', q.sortBy)
  if (q.sortDir !== d.sortDir) sp.set('dir', q.sortDir)
  return sp
}
