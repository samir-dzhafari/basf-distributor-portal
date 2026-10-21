import { Alert, Card, Input, Typography } from 'antd'
import { useAppDispatch } from '@/app/hooks'
import { ru } from '@/shared/i18n/ru'
import { formatMoney } from '@/shared/lib/format'
import { useGetOrderProductsQuery } from '../../ordersApi'
import { useOrderTotals } from '../useOrderTotals'
import { wizardActions } from '../wizardSlice'
import { OrderLines } from './OrderLines'
import type { StepProps } from './types'

const t = ru.order.submitStep

/** Шаг 6. Состав заказа, суммы, комментарий. Отправка — кнопкой в нижней панели. */
export function StepSubmit({ d, errors, showErrors }: StepProps & { showErrors: boolean }) {
  const dispatch = useAppDispatch()
  const { data } = useGetOrderProductsQuery({ clientId: d.clientId, businessTypeId: d.businessTypeId })
  const { lines, totals } = useOrderTotals(d, data?.products)

  return (
    <div className="step-form">
      {showErrors && Object.keys(errors).length > 0 && (
        <Alert type="error" showIcon message={t.checkQty} role="alert" />
      )}
      <Card size="small" title={t.lines(lines.length)}>
        <OrderLines
          lines={lines}
          forceError={showErrors}
          onQty={(productId, qty) => dispatch(wizardActions.setQty({ productId, qty }))}
        />
        <dl className="totals">
          <div>
            <dt>{t.net}</dt>
            <dd>{formatMoney(totals.net)}</dd>
          </div>
          {totals.vatByRate.map((v) => (
            <div key={v.rate}>
              <dt>{t.vatRate(v.rate)}</dt>
              <dd>{formatMoney(v.amount)}</dd>
            </div>
          ))}
          <div className="totals__grand">
            <dt>{t.grand}</dt>
            <dd>{formatMoney(totals.gross)}</dd>
          </div>
        </dl>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {t.disclaimer}
        </Typography.Text>
      </Card>

      <Card size="small" title={t.comment}>
        <Input.TextArea
          rows={3}
          maxLength={500}
          showCount
          value={d.comment}
          placeholder={t.commentPlaceholder}
          aria-label={t.comment}
          onChange={(e) => dispatch(wizardActions.setComment(e.target.value))}
        />
      </Card>
    </div>
  )
}
