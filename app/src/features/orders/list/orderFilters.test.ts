import { describe, expect, it } from 'vitest'
import { activeFilterCount, defaultQuery, parseQuery, toSearchParams } from './orderFilters'

describe('фильтры заказов в адресной строке', () => {
  it('по умолчанию адрес пустой', () => {
    expect(toSearchParams(defaultQuery()).toString()).toBe('')
    expect(parseQuery(new URLSearchParams())).toEqual(defaultQuery())
  })

  it('сохраняет и восстанавливает все поля', () => {
    const q = {
      ...defaultQuery(),
      q: 'P-0010',
      statuses: ['pending' as const, 'sent' as const],
      clientId: 'cl-1',
      regionId: 'rg-south',
      from: '2026-10-01',
      page: 3,
      pageSize: 50 as const,
      sortBy: 'total' as const,
      sortDir: 'asc' as const,
    }
    expect(parseQuery(toSearchParams(q))).toEqual(q)
  })

  it('игнорирует мусор в адресе', () => {
    const q = parseQuery(new URLSearchParams('status=pending,hack&page=-4&size=7&sort=evil&dir=up'))
    expect(q.statuses).toEqual(['pending'])
    expect(q.page).toBe(1)
    expect(q.pageSize).toBe(20)
    expect(q.sortBy).toBe('createdAt')
    expect(q.sortDir).toBe('desc')
  })

  it('считает включённые фильтры, период — один', () => {
    expect(activeFilterCount({ ...defaultQuery(), from: '2026-01-01', to: '2026-02-01', q: 'x' })).toBe(2)
  })
})
