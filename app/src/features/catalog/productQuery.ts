import type { PriceListFilter, ProductSort, ProductStatusFilter, ProductsQuery } from './catalogApi'

export const defaultProductQuery = (): ProductsQuery => ({
  q: '',
  groupId: '',
  lineId: '',
  businessTypeId: '',
  status: 'all',
  priceList: 'all',
  page: 1,
  pageSize: 20,
  sortBy: 'name',
  sortDir: 'asc',
})

const STATUSES: ProductStatusFilter[] = ['all', 'open', 'closed']
const PRICE: PriceListFilter[] = ['all', 'in', 'out']
const SORTS: ProductSort[] = ['code', 'name', 'group', 'line', 'packSize', 'minQty', 'price']

export function parseProductQuery(sp: URLSearchParams): ProductsQuery {
  const q = defaultProductQuery()
  q.q = sp.get('q') ?? ''
  q.groupId = sp.get('group') ?? ''
  q.lineId = sp.get('line') ?? ''
  q.businessTypeId = sp.get('bt') ?? ''
  const status = sp.get('status') as ProductStatusFilter | null
  if (status && STATUSES.includes(status)) q.status = status
  const price = sp.get('price') as PriceListFilter | null
  if (price && PRICE.includes(price)) q.priceList = price
  const page = Number(sp.get('page'))
  if (Number.isInteger(page) && page > 0) q.page = page
  if ([10, 20, 50, 100].includes(Number(sp.get('size')))) q.pageSize = Number(sp.get('size'))
  const sort = sp.get('sort') as ProductSort | null
  if (sort && SORTS.includes(sort)) q.sortBy = sort
  if (sp.get('dir') === 'desc') q.sortDir = 'desc'
  return q
}

export function toProductParams(q: ProductsQuery): URLSearchParams {
  const sp = new URLSearchParams()
  const d = defaultProductQuery()
  if (q.q) sp.set('q', q.q)
  if (q.groupId) sp.set('group', q.groupId)
  if (q.lineId) sp.set('line', q.lineId)
  if (q.businessTypeId) sp.set('bt', q.businessTypeId)
  if (q.status !== d.status) sp.set('status', q.status)
  if (q.priceList !== d.priceList) sp.set('price', q.priceList)
  if (q.page !== d.page) sp.set('page', String(q.page))
  if (q.pageSize !== d.pageSize) sp.set('size', String(q.pageSize))
  if (q.sortBy !== d.sortBy) sp.set('sort', q.sortBy)
  if (q.sortDir !== d.sortDir) sp.set('dir', q.sortDir)
  return sp
}
