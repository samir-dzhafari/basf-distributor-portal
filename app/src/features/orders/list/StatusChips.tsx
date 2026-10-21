import { ORDER_STATUS } from '@/shared/lib/status'
import { ru } from '@/shared/i18n/ru'
import type { OrderStatus } from '@/shared/types/domain'
import type { OrderListResult } from '../ordersViewApi'

const ORDER: OrderStatus[] = ['draft', 'pending', 'rejected', 'sent', 'accepted', 'completed', 'error', 'cancelled']

/** Быстрый фильтр по статусу со счётчиками: нажатие открывает готовый список. */
export function StatusChips({
  counts,
  total,
  selected,
  onSelect,
}: {
  counts: OrderListResult['counts']
  total: number
  selected: OrderStatus[]
  onSelect: (s: OrderStatus[]) => void
}) {
  const visible = ORDER.filter((s) => counts[s] || selected.includes(s))
  const chip = (key: string, label: string, n: number, on: boolean, onClick: () => void) => (
    <button key={key} type="button" className={`chip${on ? ' chip--on' : ''}`} aria-pressed={on} onClick={onClick}>
      {label} <span className="chip__n">{n}</span>
    </button>
  )
  return (
    <div className="chips" role="group" aria-label={ru.orders.list.status}>
      {chip('all', ru.orders.list.all, total, selected.length === 0, () => onSelect([]))}
      {visible.map((s) =>
        chip(s, ORDER_STATUS[s].label, counts[s] ?? 0, selected.length === 1 && selected[0] === s, () => onSelect([s])),
      )}
    </div>
  )
}
