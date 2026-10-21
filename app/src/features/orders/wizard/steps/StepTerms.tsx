import { DatePicker, Typography } from 'antd'
import dayjs from 'dayjs'
import { useAppDispatch } from '@/app/hooks'
import { ru } from '@/shared/i18n/ru'
import { ChoiceCards } from '@/shared/ui/ChoiceCards'
import { Field } from '@/shared/ui/Field'
import { allowedPaymentTerms, canPickDelivery } from '../rules'
import { wizardActions } from '../wizardSlice'
import type { StepProps } from './types'

const t = ru.order.terms

/** Шаг 2. Оплата, поставка и желаемая дата. */
export function StepTerms({ me, ctx, d, errors }: StepProps) {
  const dispatch = useAppDispatch()
  const set = (field: 'paymentTermId' | 'deliveryTermId' | 'desiredDate', value: string) =>
    dispatch(wizardActions.setField({ field, value }))
  const pickDelivery = canPickDelivery(me, ctx)
  const delivery = pickDelivery ? ctx.deliveryTerms : ctx.deliveryTerms.filter((x) => x.id === d.deliveryTermId)

  return (
    <div className="step-form">
      <Field label={t.payment} hint={t.paymentHint} error={errors.paymentTermId}>
        <ChoiceCards
          name="payment"
          value={d.paymentTermId}
          onChange={(v) => set('paymentTermId', v)}
          options={allowedPaymentTerms(ctx, d).map((p) => ({
            value: p.id,
            title: p.name,
            description: t.paymentSub(p.code),
          }))}
        />
      </Field>

      <Field label={t.delivery} hint={pickDelivery ? undefined : t.deliveryFixed} error={errors.deliveryTermId}>
        <ChoiceCards
          name="delivery"
          columns={2}
          value={d.deliveryTermId}
          onChange={(v) => set('deliveryTermId', v)}
          options={delivery.map((x) => ({ value: x.id, title: x.name }))}
        />
      </Field>

      <Field label={t.date} hint={t.dateHint} error={errors.desiredDate}>
        <DatePicker
          size="large"
          format="DD.MM.YYYY"
          allowClear={false}
          placeholder={t.datePlaceholder}
          style={{ width: 220 }}
          value={d.desiredDate ? dayjs(d.desiredDate) : null}
          disabledDate={(day) => day.isBefore(dayjs().add(1, 'day').startOf('day'))}
          onChange={(day) => set('desiredDate', day ? day.format('YYYY-MM-DD') : '')}
        />
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
          {t.dateMin}
        </Typography.Text>
      </Field>
    </div>
  )
}
