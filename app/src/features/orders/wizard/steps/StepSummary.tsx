import type { ReactNode } from 'react'
import { Alert, Button, Card, Descriptions } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { ru } from '@/shared/i18n/ru'
import { formatDate } from '@/shared/lib/format'
import { STEP, STEP_OF_FIELD } from '../validate'
import type { StepProps } from './types'

const t = ru.order.summary
const layout = { column: { xs: 1, sm: 1, md: 2 }, size: 'small' as const, layout: 'vertical' as const }

function Block({
  title,
  step,
  onEdit,
  children,
}: {
  title: string
  step: number
  onEdit: (s: number) => void
  children: ReactNode
}) {
  return (
    <Card
      size="small"
      title={title}
      extra={
        <Button type="link" icon={<EditOutlined />} onClick={() => onEdit(step)} aria-label={`${t.edit}: ${title}`}>
          {t.edit}
        </Button>
      }
    >
      {children}
    </Card>
  )
}

const nameOf = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? '—'

/** Шаг 4. Проверка шапки заказа: любое поле можно исправить, не теряя остальное. */
export function StepSummary({ ctx, d, errors, onEdit }: StepProps & { onEdit: (step: number) => void }) {
  const consignee = ctx.consignees.find((c) => c.id === d.consigneeId)
  const app = ctx.applications.find((a) => a.id === d.applicationId)
  return (
    <div className="step-form">
      {Object.keys(errors).length > 0 && (
        <Alert
          type="error"
          showIcon
          role="alert"
          message={t.fixTitle}
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {Object.entries(errors).map(([k, m]) => (
                <li key={k}>
                  {m}{' '}
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0 }}
                    onClick={() => onEdit(STEP_OF_FIELD[k] ?? STEP.recipient)}
                  >
                    {t.fix}
                  </Button>
                </li>
              ))}
            </ul>
          }
        />
      )}
      <Block title={t.blockRecipient} step={STEP.recipient} onEdit={onEdit}>
        <Descriptions {...layout}>
          <Descriptions.Item label={t.client}>{ctx.client.name}</Descriptions.Item>
          <Descriptions.Item label={t.consignee}>
            {consignee ? `${consignee.name}, ${consignee.address}` : '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t.region}>{nameOf(ctx.regions, d.regionId)}</Descriptions.Item>
          <Descriptions.Item label={t.businessType}>{nameOf(ctx.businessTypes, d.businessTypeId)}</Descriptions.Item>
        </Descriptions>
      </Block>
      <Block title={t.blockTerms} step={STEP.terms} onEdit={onEdit}>
        <Descriptions {...layout}>
          <Descriptions.Item label={t.payment}>{nameOf(ctx.paymentTerms, d.paymentTermId)}</Descriptions.Item>
          <Descriptions.Item label={t.delivery}>{nameOf(ctx.deliveryTerms, d.deliveryTermId)}</Descriptions.Item>
          <Descriptions.Item label={t.date}>{formatDate(d.desiredDate)}</Descriptions.Item>
        </Descriptions>
      </Block>
      <Block title={t.blockApplication} step={STEP.application} onEdit={onEdit}>
        <Descriptions {...layout}>
          <Descriptions.Item label={t.applicationNumber}>{app?.number ?? '—'}</Descriptions.Item>
        </Descriptions>
      </Block>
    </div>
  )
}
