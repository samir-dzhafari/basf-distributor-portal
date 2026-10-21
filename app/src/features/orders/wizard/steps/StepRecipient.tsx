import { Alert } from 'antd'
import { useAppDispatch } from '@/app/hooks'
import { isClient } from '@/features/auth/permissions'
import { ru } from '@/shared/i18n/ru'
import { ChoiceCards } from '@/shared/ui/ChoiceCards'
import { Field } from '@/shared/ui/Field'
import { wizardActions } from '../wizardSlice'
import type { StepProps } from './types'

const t = ru.order.recipient

/** Шаг 1. Кому и откуда: грузополучатель, регион, тип бизнеса (клиента сотрудник выбирает выше). */
export function StepRecipient({ me, ctx, d, errors }: StepProps) {
  const dispatch = useAppDispatch()
  const set = (field: 'consigneeId' | 'regionId' | 'businessTypeId', value: string) =>
    dispatch(wizardActions.setField({ field, value }))

  return (
    <div className="step-form">
      {isClient(me) && <Alert type="info" showIcon message={t.onBehalf(ctx.client.name)} />}

      <Field label={t.consignee} hint={t.consigneeHint} error={errors.consigneeId}>
        <ChoiceCards
          name="consignee"
          value={d.consigneeId}
          onChange={(v) => set('consigneeId', v)}
          options={ctx.consignees.map((c) => ({
            value: c.id,
            title: c.name,
            description: `${c.address} · код ${c.code}`,
          }))}
        />
      </Field>

      <Field label={t.region} hint={t.regionHint} error={errors.regionId}>
        <ChoiceCards
          name="region"
          columns={2}
          value={d.regionId}
          onChange={(v) => set('regionId', v)}
          options={ctx.regions.map((r) => ({ value: r.id, title: r.name }))}
        />
      </Field>

      <Field label={t.businessType} error={errors.businessTypeId}>
        <ChoiceCards
          name="business-type"
          columns={2}
          value={d.businessTypeId}
          onChange={(v) => set('businessTypeId', v)}
          options={ctx.businessTypes.map((b) => ({ value: b.id, title: b.name }))}
        />
      </Field>
    </div>
  )
}
