import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import reducer, { wizardActions as a } from './wizardSlice'
import { emptyWizard, firstInvalidStep, qtyProblem, validateItems, validateTerms, type QtyRule } from './validate'

const rule: QtyRule = { id: 'p1', name: 'Дуал Голд 20 л', minQty: 20, multiple: 20, unit: 'л' }
const state0 = () => reducer(undefined, { type: 'init' })

describe('wizard slice', () => {
  it('смена клиента сбрасывает зависимые поля и позиции', () => {
    let s = state0()
    s = reducer(s, a.setField({ field: 'clientId', value: 'cl-1' }))
    s = reducer(s, a.setField({ field: 'regionId', value: 'rg-far' }))
    s = reducer(s, a.setQty({ productId: 'p1', qty: 40 }))
    s = reducer(s, a.setField({ field: 'clientId', value: 'cl-2' }))
    expect(s.data.regionId).toBe('')
    expect(s.data.qty).toEqual({})
  })
  it('смена типа бизнеса очищает приложение и позиции с уведомлением', () => {
    let s = state0()
    s = reducer(s, a.setField({ field: 'businessTypeId', value: 'bt-regular' }))
    s = reducer(s, a.setField({ field: 'applicationId', value: 'ap-1' }))
    s = reducer(s, a.setQty({ productId: 'p1', qty: 40 }))
    s = reducer(s, a.setField({ field: 'businessTypeId', value: 'bt-szr' }))
    expect(s.data.applicationId).toBe('')
    expect(s.data.qty).toEqual({})
    expect(s.notice).toBeTruthy()
  })
  it('нулевое количество убирает позицию; addMany не перезаписывает', () => {
    let s = state0()
    s = reducer(s, a.setQty({ productId: 'p1', qty: 40 }))
    s = reducer(
      s,
      a.addMany([
        { productId: 'p1', qty: 20 },
        { productId: 'p2', qty: 10 },
      ]),
    )
    expect(s.data.qty).toEqual({ p1: 40, p2: 10 })
    s = reducer(s, a.setQty({ productId: 'p1', qty: 0 }))
    expect(s.data.qty).toEqual({ p2: 10 })
  })
})

describe('validation', () => {
  it('подсказывает ближайшее допустимое количество', () => {
    expect(qtyProblem(30, rule)?.nearest).toBe(40)
    expect(qtyProblem(10, rule)?.nearest).toBe(20)
    expect(qtyProblem(40, rule)).toBeNull()
  })
  it('дата поставки — не раньше завтра', () => {
    const base = { ...emptyWizard(), paymentTermId: 'x', deliveryTermId: 'y' }
    expect(validateTerms({ ...base, desiredDate: dayjs().format('YYYY-MM-DD') }).desiredDate).toBeTruthy()
    expect(validateTerms({ ...base, desiredDate: dayjs().add(1, 'day').format('YYYY-MM-DD') })).toEqual({})
  })
  it('пустой заказ и неверное количество', () => {
    const rules = new Map([[rule.id, rule]])
    expect(validateItems(emptyWizard(), rules).items).toBeTruthy()
    expect(validateItems({ ...emptyWizard(), qty: { p1: 25 } }, rules)['qty:p1']).toBeTruthy()
    expect(validateItems({ ...emptyWizard(), qty: { p1: 60 } }, rules)).toEqual({})
  })
  it('находит первый невалидный шаг', () => {
    expect(firstInvalidStep(emptyWizard(), new Map())).toBe(0)
    const d = { ...emptyWizard(), clientId: 'c', consigneeId: 'c', regionId: 'r', businessTypeId: 'b' }
    expect(firstInvalidStep(d, new Map())).toBe(1)
  })
})
