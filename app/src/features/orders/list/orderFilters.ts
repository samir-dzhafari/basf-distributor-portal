import type { Id, OrderStatus } from '@/shared/types/domain'

export const SORT_FIELDS = ['createdAt', 'number', 'total', 'status'] as const
export type SortField = (typeof SORT_FIELDS)[number]

export const PAGE_SIZES = [10, 20, 50] as const

const STATUSES: OrderStatus[] = ['draft', 'pending', 'rejected', 'cancelled', 'sent', 'accepted', 'completed', 'error']

export interface OrderFilters {
  /** Поиск по номеру заказа, номеру в 1С, номеру приложения, названию клиента. */
  q: string
  statuses: OrderStatus[]
  clientId: Id
  regionId: Id
  businessTypeId: Id
  creatorId: Id
  /** YYYY-MM-DD, включительно */
  from: string
  to: string
}

export interface OrderQuery extends OrderFilters {
  page: number
  pageSize: number
  sortBy: SortField
  sortDir: 'asc' | 'desc'
}

export const emptyFilters = (): OrderFilters => ({
  q: '',
  statuses: [],
  clientId: '',
  regionId: '',
  businessTypeId: '',
  creatorId: '',
  from: '',
  to: '',
})

export const defaultQuery = (): OrderQuery => ({
  ...emptyFilters(),
  page: 1,
  pageSize: 20,
  sortBy: 'createdAt',
  sortDir: 'desc',
})

const FILTER_KEYS: Record<Exclude<keyof OrderFilters, 'statuses'>, string> = {
  q: 'q',
  clientId: 'client',
  regionId: 'region',
  businessTypeId: 'bt',
  creatorId: 'creator',
  from: 'from',
  to: 'to',
}

/** Фильтры живут в адресной строке: ссылку можно сохранить, «Назад» работает, счётчики ведут в готовый список. */
export function parseQuery(sp: URLSearchParams): OrderQuery {
  const q = defaultQuery()
  ;(Object.keys(FILTER_KEYS) as (keyof typeof FILTER_KEYS)[]).forEach((k) => {
    q[k] = sp.get(FILTER_KEYS[k]) ?? ''
  })
  q.statuses = (sp.get('status') ?? '').split(',').filter((s): s is OrderStatus => STATUSES.includes(s as OrderStatus))
  const page = Number(sp.get('page'))
  if (Number.isInteger(page) && page > 0) q.page = page
  const size = Number(sp.get('size'))
  if ((PAGE_SIZES as readonly number[]).includes(size)) q.pageSize = size
  const sort = sp.get('sort') as SortField | null
  if (sort && SORT_FIELDS.includes(sort)) q.sortBy = sort
  if (sp.get('dir') === 'asc') q.sortDir = 'asc'
  return q
}

export function toSearchParams(q: OrderQuery): URLSearchParams {
  const sp = new URLSearchParams()
  ;(Object.keys(FILTER_KEYS) as (keyof typeof FILTER_KEYS)[]).forEach((k) => {
    if (q[k]) sp.set(FILTER_KEYS[k], q[k])
  })
  if (q.statuses.length) sp.set('status', q.statuses.join(','))
  const d = defaultQuery()
  if (q.page !== d.page) sp.set('page', String(q.page))
  if (q.pageSize !== d.pageSize) sp.set('size', String(q.pageSize))
  if (q.sortBy !== d.sortBy) sp.set('sort', q.sortBy)
  if (q.sortDir !== d.sortDir) sp.set('dir', q.sortDir)
  return sp
}

/** Сколько фильтров включено (без статусов — они вынесены в отдельную строку). */
export const activeFilterCount = (f: OrderFilters) =>
  [f.q, f.clientId, f.regionId, f.businessTypeId, f.creatorId, f.from || f.to].filter(Boolean).length
