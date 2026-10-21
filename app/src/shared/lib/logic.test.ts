import { describe, expect, it } from 'vitest'
import { calcLine, calcOrder, checkQty } from './money'
import { checkPassword, isPasswordValid } from './password'

describe('money', () => {
  it('считает НДС сверху', () => {
    expect(calcLine(746, 1000, 22)).toEqual({ net: 746000, vat: 164120, gross: 910120 })
  })
  it('итоги заказа с разбивкой по ставкам', () => {
    const r = calcOrder([
      { price: 100, qty: 10, vatRate: 22 },
      { price: 50, qty: 4, vatRate: 10 },
    ])
    expect(r.net).toBe(1200)
    expect(r.vat).toBe(240)
    expect(r.gross).toBe(1440)
    expect(r.vatByRate).toEqual([
      { rate: 22, amount: 220 },
      { rate: 10, amount: 20 },
    ])
  })
  it('кратность и минимум', () => {
    expect(checkQty(40, 20, 20).ok).toBe(true)
    expect(checkQty(30, 20, 20)).toMatchObject({ ok: false })
    expect(checkQty(10, 20, 20)).toEqual({ ok: false, nearest: 20 })
  })
})

describe('password policy', () => {
  it('принимает хороший пароль', () => {
    expect(isPasswordValid('Poleviy2027', 'a@b.ru')).toBe(true)
  })
  it('отклоняет короткий, без цифр, равный логину', () => {
    expect(isPasswordValid('Abc1')).toBe(false)
    expect(isPasswordValid('Только буквы тут')).toBe(false)
    expect(isPasswordValid('petr1234', 'petr1234@mail.ru')).toBe(false)
    expect(checkPassword('').every((r) => !r.ok)).toBe(true)
  })
})
