import { describe, expect, it } from 'vitest'
import { emptyAvailability, productAvailability, setProductOpen } from './availability'

const p = { id: 'p1', closed: false, groupId: 'g1', lineId: 'l1', inPriceList: true, businessTypeIds: ['bt-a'] }

describe('доступность продукта клиенту', () => {
  it('по умолчанию из открытого прайс-листа доступен', () => {
    expect(productAvailability(p, emptyAvailability()).orderable).toBe(true)
  })
  it('причины недоступности', () => {
    const a = emptyAvailability()
    expect(productAvailability({ ...p, closed: true }, a).reason).toBe('closedGlobally')
    expect(productAvailability(p, { ...a, closedGroupIds: ['g1'] }).reason).toBe('closedGroup')
    expect(productAvailability(p, { ...a, closedLineIds: ['l1'] }).reason).toBe('closedLine')
    expect(productAvailability(p, { ...a, closedProductIds: ['p1'] }).reason).toBe('closedProduct')
    expect(productAvailability({ ...p, inPriceList: false }, a).reason).toBe('outsidePrice')
    expect(productAvailability(p, a, ['bt-b']).reason).toBe('otherBusiness')
    expect(productAvailability(p, a, ['bt-a', 'bt-b']).orderable).toBe(true)
  })
  it('позицию вне прайс-листа можно открыть отдельно', () => {
    const out = { ...p, inPriceList: false }
    const opened = setProductOpen(emptyAvailability(), out, true)
    expect(productAvailability(out, opened).orderable).toBe(true)
    expect(productAvailability(out, setProductOpen(opened, out, false)).orderable).toBe(false)
  })
  it('позицию из прайс-листа закрывают и открывают обратно', () => {
    const closed = setProductOpen(emptyAvailability(), p, false)
    expect(closed.closedProductIds).toEqual(['p1'])
    expect(setProductOpen(closed, p, true).closedProductIds).toEqual([])
  })
  it('закрытая группа сильнее открытой вручную позиции', () => {
    const a = { ...emptyAvailability(), closedGroupIds: ['g1'], openedProductIds: ['p1'] }
    expect(productAvailability({ ...p, inPriceList: false }, a).reason).toBe('closedGroup')
  })
})
