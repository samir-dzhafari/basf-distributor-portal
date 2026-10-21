import { useMemo } from 'react'
import { calcOrder } from '@/shared/lib/money'
import type { OrderProduct } from '../ordersApi'
import { qtyProblem, type WizardData } from './validate'

export interface OrderLine {
  p: OrderProduct
  qty: number
  price: number
  vatRate: number
}

/** Позиции корзины и итоговые суммы. Позиции с недопустимым количеством в суммы не входят. */
export function useOrderTotals(d: Pick<WizardData, 'qty'>, products?: OrderProduct[]) {
  return useMemo(() => {
    const byId = new Map((products ?? []).map((p) => [p.id, p]))
    const lines: OrderLine[] = Object.entries(d.qty).flatMap(([id, qty]) => {
      const p = byId.get(id)
      return p ? [{ p, qty, price: p.price, vatRate: p.vatRate }] : []
    })
    return { lines, totals: calcOrder(lines.filter((l) => !qtyProblem(l.qty, l.p))) }
  }, [d.qty, products])
}
