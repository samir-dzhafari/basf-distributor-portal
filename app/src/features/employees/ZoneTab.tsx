import { useState } from 'react'
import { Alert, App, Button, Select, Space, Typography } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { Field } from '@/shared/ui/Field'
import { useUpdateZoneMutation, type EmployeeDetail } from './employeesApi'

const t = ru.employees.zone
const same = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

/** Зона ответственности: клиенты, регионы и типы бизнеса. Видимость заказов складывается из них по «или». */
export function ZoneTab({ detail, onShowVisibility }: { detail: EmployeeDetail; onShowVisibility: () => void }) {
  const { message } = App.useApp()
  const { zone, refs, role } = detail
  const [clientIds, setClients] = useState(zone.clientIds)
  const [regionIds, setRegions] = useState(zone.regionIds)
  const [businessTypeIds, setBts] = useState(zone.businessTypeIds)
  const [save, { isLoading }] = useUpdateZoneMutation()
  const dirty =
    !same(clientIds, zone.clientIds) || !same(regionIds, zone.regionIds) || !same(businessTypeIds, zone.businessTypeIds)

  const onSave = async () => {
    const r = await save({ id: detail.user.id, clientIds, regionIds, businessTypeIds })
    if ('error' in r) message.error(errorMessage(r.error))
    else message.success(t.saved)
  }

  if (role.fullAccess) return <Alert type="info" showIcon message={t.fullAccess} />

  return (
    <div style={{ maxWidth: 820 }}>
      <Alert type="info" showIcon message={t.rules} style={{ marginBottom: 24 }} />
      <div className="step-form">
        <Field label={t.clients} hint={t.clientsHint}>
          <Select
            mode="multiple"
            size="large"
            style={{ width: '100%' }}
            optionFilterProp="label"
            placeholder={t.placeholderClients}
            value={clientIds}
            onChange={setClients}
            options={refs.clients.map((c) => ({ value: c.id, label: `${c.name} · ${c.code}` }))}
          />
        </Field>
        <Field label={t.regions} hint={t.regionsHint}>
          <Select
            mode="multiple"
            size="large"
            style={{ width: '100%' }}
            value={regionIds}
            onChange={setRegions}
            options={refs.regions.map((r) => ({ value: r.id, label: r.name }))}
          />
        </Field>
        <Field label={t.businessTypes} hint={t.businessTypesHint}>
          <Select
            mode="multiple"
            size="large"
            style={{ width: '100%' }}
            value={businessTypeIds}
            onChange={setBts}
            options={refs.businessTypes.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Field>
      </div>
      <Space style={{ marginTop: 24 }} wrap>
        <Button type="primary" size="large" disabled={!dirty} loading={isLoading} onClick={onSave}>
          {t.save}
        </Button>
        <Button type="link" onClick={onShowVisibility}>
          {t.check}
        </Button>
        {dirty && <Typography.Text type="warning">{t.dirty}</Typography.Text>}
      </Space>
    </div>
  )
}
