import { Checkbox, Radio, Select, Switch, Typography } from 'antd'
import { ru } from '@/shared/i18n/ru'
import { toggleId } from '@/shared/lib/availability'
import { validateConditions } from '@/shared/lib/requisites'
import type { BusinessType, ClientConditions, DeliveryTerm, PaymentTerm, VatRate } from '@/shared/types/domain'
import { Field } from '@/shared/ui/Field'

const t = ru.clients.conditions

export interface ConditionRefs {
  paymentTerms: PaymentTerm[]
  deliveryTerms: DeliveryTerm[]
  businessTypes: BusinessType[]
  vatRates: VatRate[]
}

/** Оплата, типы бизнеса, поставка и НДС. Используется и в карточке клиента, и в шаблоне группы. */
export function ConditionsFields({
  value,
  refs,
  showErrors,
  onChange,
}: {
  value: ClientConditions
  refs: ConditionRefs
  showErrors: boolean
  onChange: (patch: Partial<ClientConditions>) => void
}) {
  const errors = showErrors ? validateConditions(value) : {}

  const togglePayment = (id: string, on: boolean) => {
    const ids = toggleId(value.paymentTermIds, id, on)
    onChange({
      paymentTermIds: ids,
      // если сняли условие по умолчанию — берём первое из оставшихся
      defaultPaymentTermId: ids.includes(value.defaultPaymentTermId) ? value.defaultPaymentTermId : (ids[0] ?? ''),
    })
  }

  return (
    <div className="step-form">
      <Field label={t.payment} hint={t.paymentHint} error={errors.paymentTermIds ?? errors.defaultPaymentTermId}>
        <div className="cond-list">
          {refs.paymentTerms.map((p) => {
            const on = value.paymentTermIds.includes(p.id)
            return (
              <div key={p.id} className="cond-row">
                <Checkbox checked={on} onChange={(e) => togglePayment(p.id, e.target.checked)}>
                  {p.name} <span className="muted">· код {p.code}</span>
                </Checkbox>
                <Radio
                  disabled={!on}
                  checked={value.defaultPaymentTermId === p.id}
                  onChange={() => onChange({ defaultPaymentTermId: p.id })}
                  aria-label={`${t.defaultLabel}: ${p.name}`}
                >
                  {t.defaultLabel}
                </Radio>
              </div>
            )
          })}
        </div>
      </Field>

      <Field label={t.business} hint={t.businessHint} error={errors.businessTypeIds}>
        <div className="cond-list">
          {refs.businessTypes.map((b) => (
            <Checkbox
              key={b.id}
              checked={value.businessTypeIds.includes(b.id)}
              onChange={(e) => onChange({ businessTypeIds: toggleId(value.businessTypeIds, b.id, e.target.checked) })}
            >
              {b.name}
            </Checkbox>
          ))}
        </div>
      </Field>

      <Field label={t.delivery} hint={t.deliveryHint} error={errors.deliveryTermIds}>
        <div className="cond-list">
          {refs.deliveryTerms.map((d) => (
            <Checkbox
              key={d.id}
              checked={value.deliveryTermIds.includes(d.id)}
              onChange={(e) => onChange({ deliveryTermIds: toggleId(value.deliveryTermIds, d.id, e.target.checked) })}
            >
              {d.name}
            </Checkbox>
          ))}
        </div>
        <label className="cond-switch">
          <Switch checked={value.canChooseDelivery} onChange={(v) => onChange({ canChooseDelivery: v })} />
          <span>
            {t.canChoose}
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
              {t.canChooseHint}
            </Typography.Text>
          </span>
        </label>
      </Field>

      <Field label={t.vat} hint={t.vatHint}>
        <Select
          size="large"
          style={{ minWidth: 240 }}
          value={value.vatRate ?? 'group'}
          onChange={(v) => onChange({ vatRate: v === 'group' ? undefined : (v as number) })}
          options={[
            { value: 'group', label: t.vatByGroup },
            ...refs.vatRates.map((v) => ({ value: v.rate, label: t.vatRate(v.rate) })),
          ]}
        />
      </Field>
    </div>
  )
}
