import { Button, Grid, InputNumber, Table, Tag, Typography } from 'antd'
import { DeleteOutlined, UndoOutlined } from '@ant-design/icons'
import { ru } from '@/shared/i18n/ru'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { calcLine } from '@/shared/lib/money'
import type { OrderView } from '../orders/ordersViewApi'

const t = ru.approvals.page
type Item = OrderView['items'][number]

/** itemId → новое количество (0 — позиция убрана). Если ключа нет — позиция не менялась. */
export type Changes = Record<string, number>

export const effectiveQty = (item: Item, changes: Changes) => changes[item.id] ?? item.qty
const isMultiple = (item: Item, qty: number) => item.packSize <= 0 || qty % item.packSize === 0

/** Позиции с возможностью изменить количество в любую сторону или убрать (фич-лист 12.3). */
export function ApprovalItems({
  items,
  changes,
  onChange,
}: {
  items: Item[]
  changes: Changes
  onChange: (itemId: string, qty: number | null) => void
}) {
  const isMobile = !Grid.useBreakpoint().md

  const editor = (i: Item) => {
    const qty = effectiveQty(i, changes)
    const removed = qty === 0
    return (
      <div className="approve-qty">
        <InputNumber
          size="large"
          min={1}
          max={999999}
          precision={0}
          step={i.packSize || 1}
          disabled={removed}
          value={removed ? null : qty}
          suffix={i.unit}
          aria-label={`${t.colApproved}, ${i.unit}: ${i.name}`}
          onChange={(v) => typeof v === 'number' && onChange(i.id, v)}
        />
        {removed ? (
          <Button icon={<UndoOutlined />} onClick={() => onChange(i.id, null)}>
            {t.restore}
          </Button>
        ) : (
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            aria-label={`${t.remove}: ${i.name}`}
            onClick={() => onChange(i.id, 0)}
          />
        )}
        <div className="approve-qty__notes">
          {qty !== i.qty && !removed && <Tag color="gold">{t.changed(i.qty, i.unit)}</Tag>}
          {removed && <Tag color="red">{t.removed}</Tag>}
          {!removed && !isMultiple(i, qty) && <Tag>{t.notMultiple}</Tag>}
        </div>
      </div>
    )
  }

  const sum = (i: Item) => {
    const qty = effectiveQty(i, changes)
    return qty === 0 ? undefined : calcLine(i.price, qty, i.vatRate).gross
  }
  const struck = (i: Item) =>
    effectiveQty(i, changes) === 0 ? { textDecoration: 'line-through', opacity: 0.55 } : undefined

  if (isMobile) {
    return (
      <div className="line-cards">
        {items.map((i) => (
          <div key={i.id} className="line-card" style={struck(i)}>
            <div className="line-card__head">
              <div>
                <strong>{i.name}</strong>
                <small>
                  {ru.order.products.code(i.code)} · {t.colOrdered}: {formatNumber(i.qty)} {i.unit}
                </small>
              </div>
            </div>
            {editor(i)}
            <strong>{sum(i) !== undefined ? formatMoney(sum(i)!) : '—'}</strong>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Table<Item>
      size="small"
      pagination={false}
      rowKey="id"
      dataSource={items}
      columns={[
        {
          title: t.colProduct,
          render: (_, i) => (
            <div style={struck(i)}>
              <strong>{i.name}</strong>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {ru.order.products.code(i.code)}
              </Typography.Text>
            </div>
          ),
        },
        { title: t.colOrdered, align: 'right', render: (_, i) => `${formatNumber(i.qty)} ${i.unit}` },
        { title: t.colApproved, width: 330, render: (_, i) => editor(i) },
        { title: t.colPrice, align: 'right', render: (_, i) => formatMoney(i.price) },
        {
          title: t.colTotal,
          align: 'right',
          render: (_, i) => (sum(i) !== undefined ? <strong>{formatMoney(sum(i)!)}</strong> : '—'),
        },
      ]}
    />
  )
}
