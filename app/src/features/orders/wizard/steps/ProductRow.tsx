import { Checkbox } from 'antd'
import { ru } from '@/shared/i18n/ru'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { calcLine } from '@/shared/lib/money'
import type { OrderProduct } from '../../ordersApi'
import { qtyProblem } from '../validate'
import { QtyInput } from './QtyInput'

const t = ru.order.products

/** Строка каталога: на широком экране — таблица, на узком — карточка (см. .prod-row в styles.css). */
export function ProductRow({
  p,
  qty,
  checked,
  forceError,
  onCheck,
  onQty,
}: {
  p: OrderProduct
  qty?: number
  checked: boolean
  forceError: boolean
  onCheck: (on: boolean) => void
  onQty: (q: number | null) => void
}) {
  const total = qty && !qtyProblem(qty, p) ? calcLine(p.price, qty, p.vatRate).gross : undefined
  return (
    <div className={`prod-row${qty ? ' prod-row--in' : ''}`}>
      <Checkbox checked={checked} onChange={(e) => onCheck(e.target.checked)} aria-label={t.check(p.name)} />
      <div className="prod-cell prod-cell--name">
        <strong>{p.name}</strong>
        <small>
          {t.code(p.code)} · {p.groupName}, {p.lineName}
        </small>
      </div>
      <div className="prod-cell" data-label={t.colPack}>
        {formatNumber(p.packSize)} {p.unit}
        <small>{t.multiple(formatNumber(p.multiple), p.unit)}</small>
      </div>
      <div className="prod-cell" data-label={t.colPrice}>
        {formatMoney(p.price)}
        <small>{t.vat(p.vatRate)}</small>
      </div>
      <div className="prod-cell" data-label={t.colQty}>
        <QtyInput product={p} value={qty} forceError={forceError} onChange={onQty} />
      </div>
      <div className="prod-cell num" data-label={t.colSum}>
        {total !== undefined ? <strong>{formatMoney(total)}</strong> : <span className="muted">—</span>}
      </div>
    </div>
  )
}
