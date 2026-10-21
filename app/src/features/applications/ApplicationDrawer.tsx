import { useEffect } from 'react'
import { App, Button, DatePicker, Drawer, Form, Input, Select, Switch } from 'antd'
import dayjs from 'dayjs'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { useSaveApplicationMutation, type ApplicationRefs, type ApplicationRow } from './applicationsApi'

const t = ru.applications.form

interface Values {
  number: string
  clientId: string
  regionId?: string
  businessTypeId?: string
  period: [dayjs.Dayjs, dayjs.Dayjs]
  responsibleIds: string[]
  active: boolean
}

const initial = (a: ApplicationRow | null): Partial<Values> =>
  a
    ? {
        number: a.number,
        clientId: a.clientId,
        regionId: a.regionId,
        businessTypeId: a.businessTypeId,
        period: [dayjs(a.validFrom), dayjs(a.validTo)],
        responsibleIds: a.responsibleIds,
        active: a.active,
      }
    : { number: '', responsibleIds: [], active: true, period: [dayjs().startOf('year'), dayjs().endOf('year')] }

/** Приложение к договору: клиент, регион и тип бизнеса из условий клиента, период и ответственные. */
export function ApplicationDrawer({
  application,
  refs,
  open,
  onClose,
}: {
  application: ApplicationRow | null
  refs: ApplicationRefs
  open: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<Values>()
  const [save, { isLoading }] = useSaveApplicationMutation()
  const clientId: string | undefined = Form.useWatch('clientId', form)
  const client = refs.clients.find((c) => c.id === (clientId ?? application?.clientId))

  useEffect(() => {
    if (open) form.setFieldsValue(initial(application))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, application?.id])

  const onFinish = async (v: Values) => {
    const r = await save({
      id: application?.id,
      number: v.number,
      clientId: v.clientId,
      regionId: v.regionId!,
      businessTypeId: v.businessTypeId!,
      validFrom: v.period[0].format('YYYY-MM-DD'),
      validTo: v.period[1].format('YYYY-MM-DD'),
      responsibleIds: v.responsibleIds,
      active: v.active,
    })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.saved)
    onClose()
  }

  const required = [{ required: true, message: ru.common.required }]
  return (
    <Drawer
      open={open}
      onClose={onClose}
      destroyOnHidden
      forceRender
      width={Math.min(560, window.innerWidth)}
      title={application ? t.titleEdit : t.titleNew}
    >
      <Form
        form={form}
        layout="vertical"
        size="large"
        requiredMark={false}
        initialValues={initial(application)}
        onFinish={onFinish}
      >
        <Form.Item
          name="number"
          label={t.number}
          rules={[{ required: true, whitespace: true, message: ru.common.required }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="clientId" label={t.client} rules={required}>
          <Select
            showSearch
            optionFilterProp="label"
            disabled={!!application}
            options={refs.clients.map((c) => ({ value: c.id, label: `${c.name} · код ${c.code}` }))}
            onChange={() => form.setFieldsValue({ regionId: undefined, businessTypeId: undefined })}
          />
        </Form.Item>
        <Form.Item name="regionId" label={t.region} extra={t.regionHint} rules={required}>
          <Select
            options={refs.regions
              .filter((r) => client?.regionIds.includes(r.id))
              .map((r) => ({ value: r.id, label: r.name }))}
          />
        </Form.Item>
        <Form.Item name="businessTypeId" label={t.businessType} extra={t.businessTypeHint} rules={required}>
          <Select
            options={refs.businessTypes
              .filter((b) => client?.businessTypeIds.includes(b.id))
              .map((b) => ({ value: b.id, label: b.name }))}
          />
        </Form.Item>
        <Form.Item name="period" label={t.period} rules={required}>
          <DatePicker.RangePicker style={{ width: '100%' }} format="DD.MM.YYYY" allowClear={false} />
        </Form.Item>
        <Form.Item name="responsibleIds" label={t.responsible} extra={t.responsibleHint}>
          <Select
            mode="multiple"
            optionFilterProp="label"
            options={refs.employees.map((e) => ({ value: e.id, label: `${e.name} · ${e.roleName}` }))}
          />
        </Form.Item>
        <Form.Item name="active" label={t.active} valuePropName="checked">
          <Switch />
        </Form.Item>
        <div className="card-actions">
          <Button type="primary" htmlType="submit" loading={isLoading}>
            {ru.common.save}
          </Button>
          <Button onClick={onClose}>{ru.common.cancel}</Button>
        </div>
      </Form>
    </Drawer>
  )
}
