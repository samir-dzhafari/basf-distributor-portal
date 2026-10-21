import type { OrderItem } from '@/shared/types/domain'

const round2 = (v: number) => Math.round(v * 100) / 100

export interface LineTotals {
  /** Цена × количество, без НДС. */
  net: number
  vat: number
  gross: number
}

/** Цены в справочнике — без НДС; НДС начисляется сверху. */
export function calcLine(price: number, qty: number, vatRate: number): LineTotals {
  const net = round2(price * qty)
  const vat = round2((net * vatRate) / 100)
  return { net, vat, gross: round2(net + vat) }
}

export function calcOrder(items: Pick<OrderItem, 'price' | 'qty' | 'vatRate'>[]) {
  const lines = items.map((i) => calcLine(i.price, i.qty, i.vatRate))
  const byRate = new Map<number, number>()
  items.forEach((i, idx) => byRate.set(i.vatRate, round2((byRate.get(i.vatRate) ?? 0) + lines[idx].vat)))
  return {
    net: round2(lines.reduce((s, l) => s + l.net, 0)),
    vat: round2(lines.reduce((s, l) => s + l.vat, 0)),
    gross: round2(lines.reduce((s, l) => s + l.gross, 0)),
    vatByRate: [...byRate.entries()].map(([rate, amount]) => ({ rate, amount })),
  }
}

/** Проверка количества по минимальному объёму и кратности. Возвращает ближайшее допустимое значение. */
export function checkQty(qty: number, minQty: number, multiple: number) {
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false as const, nearest: minQty }
  const m = multiple > 0 ? multiple : 1
  const rounded = Math.max(minQty, Math.round(qty / m) * m)
  const ok = qty >= minQty && Math.abs(qty / m - Math.round(qty / m)) < 1e-9
  return { ok, nearest: rounded }
}
