import { useEffect } from 'react'
import { Alert, App, Button, Drawer, Form, Select, Skeleton } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { useGetOrderContextQuery } from '../ordersApi'
import { useUpdateOrderHeaderMutation, type OrderView } from '../ordersViewApi'

const t = ru.orders.card

interface Values {
  consigneeId: string
  regionId: string
  deliveryTermId: string
  applicationId: string
}

/** Правка шапки до одобрения: грузополучатель, регион, условия поставки, приложение. */
export function EditHeaderDrawer({
  order,
  open,
  onClose,
}: {
  order: OrderView['order']
  open: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<Values>()
  const { data: ctx, isLoading, isError } = useGetOrderContextQuery(order.clientId, { skip: !open })
  const [update, { isLoading: saving }] = useUpdateOrderHeaderMutation()
  const region: string | undefined = Form.useWatch('regionId', form)

  const initial: Values = {
    consigneeId: order.consigneeId,
    regionId: order.regionId,
    deliveryTermId: order.deliveryTermId,
    applicationId: order.applicationId,
  }

  useEffect(() => {
    if (open) form.setFieldsValue(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.id])

  const applications = (ctx?.applications ?? []).filter(
    (a) => a.regionId === (region ?? order.regionId) && a.businessTypeId === order.businessTypeId,
  )

  const onFinish = async (v: Values) => {
    if ((Object.keys(initial) as (keyof Values)[]).every((k) => initial[k] === v[k])) {
      message.info(t.editNoChanges)
      return onClose()
    }
    const r = await update({ id: order.id, ...v })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.editSaved)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={t.editTitle} width={480} destroyOnHidden>
      <p className="muted">{t.editHint}</p>
      {isError && <Alert type="error" showIcon message={ru.common.somethingWrong} />}
      {isLoading || !ctx ? (
        <Skeleton active />
      ) : (
        <Form
          form={form}
          layout="vertical"
          size="large"
          requiredMark={false}
          initialValues={initial}
          onFinish={onFinish}
        >
          <Form.Item
            name="consigneeId"
            label={ru.order.recipient.consignee}
            rules={[{ required: true, message: ru.order.errors.consignee }]}
          >
            <Select options={ctx.consignees.map((c) => ({ value: c.id, label: `${c.name}, ${c.address}` }))} />
          </Form.Item>
          <Form.Item
            name="regionId"
            label={ru.order.recipient.region}
            rules={[{ required: true, message: ru.order.errors.region }]}
          >
            <Select
              options={ctx.regions.map((r) => ({ value: r.id, label: r.name }))}
              onChange={() => form.setFieldValue('applicationId', undefined)}
            />
          </Form.Item>
          <Form.Item
            name="deliveryTermId"
            label={ru.order.terms.delivery}
            rules={[{ required: true, message: ru.order.errors.chooseOption }]}
          >
            <Select options={ctx.deliveryTerms.map((d) => ({ value: d.id, label: d.name }))} />
          </Form.Item>
          <Form.Item
            name="applicationId"
            label={ru.order.application.label}
            extra={applications.length ? undefined : t.editApplicationEmpty}
            rules={[{ required: true, message: ru.order.errors.application }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={applications.map((a) => ({ value: a.id, label: a.number }))}
            />
          </Form.Item>
          <div className="card-actions">
            <Button type="primary" htmlType="submit" loading={saving}>
              {ru.common.save}
            </Button>
            <Button onClick={onClose}>{ru.common.cancel}</Button>
          </div>
        </Form>
      )}
    </Drawer>
  )
}
