import { Button, Grid, Table, Typography } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { ru } from '@/shared/i18n/ru'
import { formatMoney } from '@/shared/lib/format'
import { calcLine } from '@/shared/lib/money'
import type { OrderLine } from '../useOrderTotals'
import { QtyInput } from './QtyInput'

const t = ru.order.submitStep

interface Props {
  lines: OrderLine[]
  forceError: boolean
  onQty: (productId: string, qty: number | null) => void
}

/** Состав заказа: таблица на широком экране, карточки на телефоне. */
export function OrderLines({ lines, forceError, onQty }: Props) {
  const isMobile = !Grid.useBreakpoint().md
  const remove = (l: OrderLine) => (
    <Button
      type="text"
      danger
      icon={<DeleteOutlined />}
      aria-label={t.remove(l.p.name)}
      onClick={() => onQty(l.p.id, null)}
    />
  )

  if (isMobile) {
    if (!lines.length) return <Typography.Text type="secondary">{t.emptyText}</Typography.Text>
    return (
      <div className="line-cards">
        {lines.map((l) => (
          <div key={l.p.id} className="line-card">
            <div className="line-card__head">
              <div>
                <strong>{l.p.name}</strong>
                <small>{ru.order.products.code(l.p.code)}</small>
              </div>
              {remove(l)}
            </div>
            <QtyInput product={l.p} value={l.qty} forceError={forceError} onChange={(q) => onQty(l.p.id, q)} />
            <dl>
              <div>
                <dt>{t.colPrice}</dt>
                <dd>{formatMoney(l.price)}</dd>
              </div>
              <div>
                <dt>{t.colNet}</dt>
                <dd>{formatMoney(calcLine(l.price, l.qty, l.vatRate).net)}</dd>
              </div>
              <div>
                <dt>{ru.order.products.vat(l.vatRate)}</dt>
                <dd>{formatMoney(calcLine(l.price, l.qty, l.vatRate).vat)}</dd>
              </div>
              <div className="line-card__total">
                <dt>{t.colTotal}</dt>
                <dd>{formatMoney(calcLine(l.price, l.qty, l.vatRate).gross)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Table
      size="small"
      pagination={false}
      rowKey={(r) => r.p.id}
      dataSource={lines}
      locale={{ emptyText: t.emptyText }}
      columns={[
        {
          title: ru.order.products.colProduct,
          render: (_, r) => (
            <>
              <strong>{r.p.name}</strong>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {ru.order.products.code(r.p.code)}
              </Typography.Text>
            </>
          ),
        },
        { title: t.colPrice, align: 'right', render: (_, r) => formatMoney(r.price) },
        {
          title: t.colQty,
          width: 190,
          render: (_, r) => (
            <QtyInput product={r.p} value={r.qty} forceError={forceError} onChange={(q) => onQty(r.p.id, q)} />
          ),
        },
        { title: t.colNet, align: 'right', render: (_, r) => formatMoney(calcLine(r.price, r.qty, r.vatRate).net) },
        { title: t.colVat, align: 'right', render: (_, r) => `${r.vatRate}%` },
        {
          title: t.colTotal,
          align: 'right',
          render: (_, r) => <strong>{formatMoney(calcLine(r.price, r.qty, r.vatRate).gross)}</strong>,
        },
        { title: '', width: 48, render: (_, r) => remove(r) },
      ]}
    />
  )
}
