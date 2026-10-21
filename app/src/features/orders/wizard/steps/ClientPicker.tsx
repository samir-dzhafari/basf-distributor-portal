import { Select } from 'antd'
import { Field } from '@/shared/ui/Field'
import { ru } from '@/shared/i18n/ru'
import { useGetOrderClientsQuery } from '../../ordersApi'

const t = ru.order.recipient

/** Выбор клиента — только для сотрудников. */
export function ClientPicker({
  value,
  error,
  onChange,
}: {
  value: string
  error?: string
  onChange: (id: string) => void
}) {
  const { data: clients, isLoading } = useGetOrderClientsQuery()
  return (
    <Field label={t.client} hint={t.clientHint} error={error}>
      <Select
        size="large"
        showSearch
        loading={isLoading}
        value={value || undefined}
        placeholder={t.clientPlaceholder}
        optionFilterProp="label"
        style={{ width: '100%' }}
        onChange={onChange}
        notFoundContent={t.clientNotFound}
        options={clients?.map((c) => ({ value: c.id, label: `${c.name} · код ${c.code}` }))}
      />
    </Field>
  )
}
