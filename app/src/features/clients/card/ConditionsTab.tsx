import { useState } from 'react'
import { App, Button, Select } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { validateConditions } from '@/shared/lib/requisites'
import type { Client, ClientConditions } from '@/shared/types/domain'
import { Field } from '@/shared/ui/Field'
import { useUpdateClientGroupMutation, useUpdateConditionsMutation, type ClientDetail } from '../clientsApi'
import { ConditionsFields } from './ConditionsFields'

const t = ru.clients.conditions

export const conditionsOf = (c: Client): ClientConditions => ({
  paymentTermIds: c.paymentTermIds,
  defaultPaymentTermId: c.defaultPaymentTermId,
  businessTypeIds: c.businessTypeIds,
  deliveryTermIds: c.deliveryTermIds,
  canChooseDelivery: c.canChooseDelivery,
  vatRate: c.vatRate,
  availability: c.availability,
})

/** Оплата, типы бизнеса и поставки, НДС и группа клиента — одна форма, одно сохранение. */
export function ConditionsTab({ detail }: { detail: ClientDetail }) {
  const { message } = App.useApp()
  const { client, refs } = detail
  const [value, setValue] = useState<ClientConditions>(conditionsOf(client))
  const [groupId, setGroupId] = useState<string | undefined>(client.groupId)
  const [showErrors, setShowErrors] = useState(false)
  const [updateConditions, { isLoading }] = useUpdateConditionsMutation()
  const [updateGroup] = useUpdateClientGroupMutation()

  const onSave = async () => {
    if (Object.keys(validateConditions(value)).length) return setShowErrors(true)
    // Ассортимент здесь не меняется — берём сохранённый, чтобы не затереть правки с другой вкладки.
    const r = await updateConditions({ id: client.id, conditions: { ...value, availability: client.availability } })
    if ('error' in r) return void message.error(errorMessage(r.error))
    if (groupId !== client.groupId) await updateGroup({ ids: [client.id], groupId: groupId ?? null })
    setShowErrors(false)
    message.success(t.saved)
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <ConditionsFields
        value={value}
        refs={refs}
        showErrors={showErrors}
        onChange={(p) => setValue((v) => ({ ...v, ...p }))}
      />
      <Field label={t.group} hint={t.groupHint}>
        <Select
          allowClear
          size="large"
          style={{ minWidth: 280 }}
          placeholder={t.noGroup}
          value={groupId}
          onChange={(v) => setGroupId(v)}
          options={refs.groups.map((g) => ({ value: g.id, label: g.name }))}
        />
      </Field>
      <Button type="primary" size="large" loading={isLoading} onClick={onSave} style={{ marginTop: 24 }}>
        {ru.common.save}
      </Button>
    </div>
  )
}
