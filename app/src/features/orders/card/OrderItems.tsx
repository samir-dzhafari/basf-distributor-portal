import { Grid, Table, Typography } from 'antd'
import { ru } from '@/shared/i18n/ru'
import { formatMoney, formatNumber } from '@/shared/lib/format'
import { calcLine } from '@/shared/lib/money'
import type { OrderView } from '../ordersViewApi'

const t = ru.orders.card

type Item = OrderView['items'][number]

/** Позиции заказа: таблица на компьютере, карточки на телефоне. */
export function OrderItems({ items, totals }: { items: Item[]; totals: OrderView['totals'] }) {
  const isMobile = !Grid.useBreakpoint().md
  const sums = (i: Item) => calcLine(i.price, i.qty, i.vatRate)

  return (
    <>
      {isMobile ? (
        <div className="line-cards">
          {items.map((i) => (
            <div key={i.id} className="line-card">
              <div className="line-card__head">
                <div>
                  <strong>{i.name}</strong>
                  <small>{ru.order.products.code(i.code)}</small>
                </div>
                <strong>
                  {formatNumber(i.qty)} {i.unit}
                </strong>
              </div>
              <dl>
                <div>
                  <dt>{t.colPrice}</dt>
                  <dd>{formatMoney(i.price)}</dd>
                </div>
                <div>
                  <dt>{t.colNet}</dt>
                  <dd>{formatMoney(sums(i).net)}</dd>
                </div>
                <div>
                  <dt>{ru.order.products.vat(i.vatRate)}</dt>
                  <dd>{formatMoney(sums(i).vat)}</dd>
                </div>
                <div className="line-card__total">
                  <dt>{t.colTotal}</dt>
                  <dd>{formatMoney(sums(i).gross)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <Table<Item>
          size="small"
          pagination={false}
          rowKey="id"
          dataSource={items}
          columns={[
            {
              title: t.colProduct,
              render: (_, i) => (
                <>
                  <strong>{i.name}</strong>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {ru.order.products.code(i.code)}
                  </Typography.Text>
                </>
              ),
            },
            { title: t.colPack, render: (_, i) => `${formatNumber(i.packSize)} ${i.unit}` },
            { title: t.colQty, align: 'right', render: (_, i) => `${formatNumber(i.qty)} ${i.unit}` },
            { title: t.colPrice, align: 'right', render: (_, i) => formatMoney(i.price) },
            { title: t.colNet, align: 'right', render: (_, i) => formatMoney(sums(i).net) },
            { title: t.colVat, align: 'right', render: (_, i) => `${i.vatRate}%` },
            { title: t.colTotal, align: 'right', render: (_, i) => <strong>{formatMoney(sums(i).gross)}</strong> },
          ]}
        />
      )}
      <dl className="totals">
        <div>
          <dt>{t.net}</dt>
          <dd>{formatMoney(totals.net)}</dd>
        </div>
        {totals.vatByRate.map((v) => (
          <div key={v.rate}>
            <dt>{ru.order.products.vat(v.rate)}</dt>
            <dd>{formatMoney(v.amount)}</dd>
          </div>
        ))}
        <div className="totals__grand">
          <dt>{t.grand}</dt>
          <dd>{formatMoney(totals.gross)}</dd>
        </div>
      </dl>
    </>
  )
}
