import type { EmployeeStatusFilter, EmployeesQuery } from './employeesApi'

export const defaultEmployeeQuery = (): EmployeesQuery => ({
  q: '',
  roleId: '',
  regionId: '',
  managerId: '',
  status: 'all',
  page: 1,
  pageSize: 20,
  sortBy: 'name',
  sortDir: 'asc',
})

const STATUSES: EmployeeStatusFilter[] = ['all', 'active', 'invited', 'blocked']

export function parseEmployeeQuery(sp: URLSearchParams): EmployeesQuery {
  const q = defaultEmployeeQuery()
  q.q = sp.get('q') ?? ''
  q.roleId = sp.get('role') ?? ''
  q.regionId = sp.get('region') ?? ''
  q.managerId = sp.get('manager') ?? ''
  const status = sp.get('status') as EmployeeStatusFilter | null
  if (status && STATUSES.includes(status)) q.status = status
  const page = Number(sp.get('page'))
  if (Number.isInteger(page) && page > 0) q.page = page
  if ([10, 20, 50].includes(Number(sp.get('size')))) q.pageSize = Number(sp.get('size'))
  if (sp.get('sort') === 'role') q.sortBy = 'role'
  if (sp.get('dir') === 'desc') q.sortDir = 'desc'
  return q
}

export function toEmployeeParams(q: EmployeesQuery): URLSearchParams {
  const sp = new URLSearchParams()
  const d = defaultEmployeeQuery()
  if (q.q) sp.set('q', q.q)
  if (q.roleId) sp.set('role', q.roleId)
  if (q.regionId) sp.set('region', q.regionId)
  if (q.managerId) sp.set('manager', q.managerId)
  if (q.status !== d.status) sp.set('status', q.status)
  if (q.page !== d.page) sp.set('page', String(q.page))
  if (q.pageSize !== d.pageSize) sp.set('size', String(q.pageSize))
  if (q.sortBy !== d.sortBy) sp.set('sort', q.sortBy)
  if (q.sortDir !== d.sortDir) sp.set('dir', q.sortDir)
  return sp
}
