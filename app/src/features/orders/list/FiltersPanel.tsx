import { Button, Card, Col, DatePicker, Row, Select } from 'antd'
import dayjs from 'dayjs'
import { ru } from '@/shared/i18n/ru'
import { Field } from '@/shared/ui/Field'
import type { OrderFilterOptions } from '../ordersViewApi'
import type { OrderFilters } from './orderFilters'

const t = ru.orders.list

const select = (
  label: string,
  value: string,
  options: { id: string; name: string }[],
  onChange: (v: string) => void,
) => (
  <Field label={label}>
    <Select
      allowClear
      showSearch
      size="large"
      style={{ width: '100%' }}
      placeholder={t.anyOption}
      optionFilterProp="label"
      value={value || undefined}
      onChange={(v) => onChange(v ?? '')}
      options={options.map((o) => ({ value: o.id, label: o.name }))}
    />
  </Field>
)

/** Расширенные фильтры. Список клиентов и создателей показываем только сотруднику. */
export function FiltersPanel({
  value,
  options,
  showClient,
  showCreator,
  onChange,
  onReset,
}: {
  value: OrderFilters
  options?: OrderFilterOptions
  showClient: boolean
  showCreator: boolean
  onChange: (patch: Partial<OrderFilters>) => void
  onReset: () => void
}) {
  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 8]}>
        {showClient && (
          <Col xs={24} md={12} lg={8}>
            {select(t.client, value.clientId, options?.clients ?? [], (v) => onChange({ clientId: v }))}
          </Col>
        )}
        <Col xs={24} md={12} lg={showClient ? 8 : 12}>
          {select(t.region, value.regionId, options?.regions ?? [], (v) => onChange({ regionId: v }))}
        </Col>
        <Col xs={24} md={12} lg={showClient ? 8 : 12}>
          {select(t.businessType, value.businessTypeId, options?.businessTypes ?? [], (v) =>
            onChange({ businessTypeId: v }),
          )}
        </Col>
        {showCreator && (
          <Col xs={24} md={12} lg={8}>
            {select(t.creator, value.creatorId, options?.creators ?? [], (v) => onChange({ creatorId: v }))}
          </Col>
        )}
        <Col xs={24} md={12} lg={8}>
          <Field label={t.period}>
            <DatePicker.RangePicker
              size="large"
              style={{ width: '100%' }}
              format="DD.MM.YYYY"
              placeholder={[t.from, t.to]}
              allowEmpty={[true, true]}
              value={[value.from ? dayjs(value.from) : null, value.to ? dayjs(value.to) : null]}
              onChange={(r) =>
                onChange({ from: r?.[0]?.format('YYYY-MM-DD') ?? '', to: r?.[1]?.format('YYYY-MM-DD') ?? '' })
              }
            />
          </Field>
        </Col>
      </Row>
      <Button type="link" style={{ paddingLeft: 0 }} onClick={onReset}>
        {t.reset}
      </Button>
    </Card>
  )
}
