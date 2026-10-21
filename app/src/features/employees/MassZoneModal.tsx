import { useState } from 'react'
import { App, Modal, Radio, Select, Space } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import type { Id } from '@/shared/types/domain'
import { Field } from '@/shared/ui/Field'
import { useMassZoneMutation, type EmployeesList } from './employeesApi'

const t = ru.employees

/** Массовое добавление или снятие клиентов, регионов и типов бизнеса у отмеченных сотрудников. */
export function MassZoneModal({
  ids,
  refs,
  open,
  onClose,
  onDone,
}: {
  ids: Id[]
  refs: EmployeesList['refs']
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { message } = App.useApp()
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const [clientIds, setClients] = useState<Id[]>([])
  const [regionIds, setRegions] = useState<Id[]>([])
  const [businessTypeIds, setBts] = useState<Id[]>([])
  const [run, { isLoading }] = useMassZoneMutation()
  const empty = !clientIds.length && !regionIds.length && !businessTypeIds.length

  const submit = async () => {
    const r = await run({ ids, mode, clientIds, regionIds, businessTypeIds })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.mass.done(r.data.updated))
    onDone()
  }

  return (
    <Modal
      open={open}
      title={`${t.mass.title} · ${t.selected(ids.length)}`}
      okText={t.mass.apply}
      cancelText={ru.common.cancel}
      okButtonProps={{ size: 'large', disabled: empty, loading: isLoading }}
      cancelButtonProps={{ size: 'large' }}
      onOk={submit}
      onCancel={onClose}
      destroyOnHidden
      width={620}
    >
      <p className="muted">{t.mass.hint}</p>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Radio.Group
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          size="large"
        >
          <Radio.Button value="add">{t.mass.add}</Radio.Button>
          <Radio.Button value="remove">{t.mass.remove}</Radio.Button>
        </Radio.Group>
        <Field label={t.zone.clients}>
          <Select
            mode="multiple"
            optionFilterProp="label"
            style={{ width: '100%' }}
            placeholder={t.zone.placeholderClients}
            value={clientIds}
            onChange={setClients}
            options={refs.clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label={t.zone.regions}>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            value={regionIds}
            onChange={setRegions}
            options={refs.regions.map((r) => ({ value: r.id, label: r.name }))}
          />
        </Field>
        <Field label={t.zone.businessTypes}>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            value={businessTypeIds}
            onChange={setBts}
            options={refs.businessTypes.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Field>
      </Space>
    </Modal>
  )
}
