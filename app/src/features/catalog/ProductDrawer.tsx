import { useEffect } from 'react'
import { App, Alert, Button, Checkbox, Drawer, Form, Input, InputNumber, Select, Switch } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { useSaveProductMutation, type ProductInput, type ProductRefs, type ProductRow } from './catalogApi'

const t = ru.catalog.form

const empty = (refs: ProductRefs): ProductInput => ({
  code: '',
  name: '',
  groupId: refs.groups[0]?.id ?? '',
  lineId: refs.lines[0]?.id ?? '',
  businessTypeIds: refs.businessTypes.slice(0, 1).map((b) => b.id),
  packSize: 10,
  unit: 'л',
  minQty: 10,
  multiple: 10,
  inPriceList: true,
  price: undefined,
})

/** Создание и правка продукта. Удаления нет: продукт закрывают (кнопкой в списке). */
export function ProductDrawer({
  product,
  refs,
  open,
  onClose,
}: {
  product: ProductRow | null
  refs: ProductRefs
  open: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<ProductInput>()
  const [save, { isLoading }] = useSaveProductMutation()

  useEffect(() => {
    if (open) form.setFieldsValue(product ?? empty(refs))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id])

  const onFinish = async (v: ProductInput) => {
    const r = await save({ ...v, id: product?.id })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.saved)
    onClose()
  }

  const required = [{ required: true, message: ru.common.required }]
  const positive = [{ required: true, type: 'number' as const, min: 0.001, message: ru.common.required }]

  return (
    <Drawer
      open={open}
      onClose={onClose}
      destroyOnHidden
      width={Math.min(560, window.innerWidth)}
      title={product ? t.titleEdit : t.titleNew}
      forceRender
    >
      {product?.closed && <Alert type="warning" showIcon message={t.closedNote} style={{ marginBottom: 16 }} />}
      <Form
        form={form}
        layout="vertical"
        size="large"
        requiredMark={false}
        initialValues={product ?? empty(refs)}
        onFinish={onFinish}
      >
        <Form.Item
          name="name"
          label={t.name}
          rules={[{ required: true, whitespace: true, message: ru.common.required }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="code" label={t.code} rules={required}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="groupId" label={t.group} rules={required}>
          <Select options={refs.groups.map((g) => ({ value: g.id, label: `${g.name} · НДС ${g.vatRate}%` }))} />
        </Form.Item>
        <Form.Item name="lineId" label={t.line} rules={required}>
          <Select options={refs.lines.map((l) => ({ value: l.id, label: l.name }))} />
        </Form.Item>
        <Form.Item
          name="businessTypeIds"
          label={t.businessTypes}
          extra={t.businessTypesHint}
          rules={[{ required: true, type: 'array', min: 1, message: ru.common.required }]}
        >
          <Checkbox.Group options={refs.businessTypes.map((b) => ({ value: b.id, label: b.name }))} />
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
          <Form.Item name="packSize" label={t.pack} rules={positive}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="unit" label={t.unit} rules={required}>
            <Select options={[{ value: 'л' }, { value: 'кг' }]} />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="minQty" label={t.minQty} rules={positive}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="multiple" label={t.multiple} extra={t.multipleHint} rules={positive}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </div>
        <Form.Item name="inPriceList" label={t.inPriceList} extra={t.inPriceListHint} valuePropName="checked">
          <Switch />
        </Form.Item>
        {!product && (
          <Form.Item name="price" label={t.price} extra={t.priceHint} rules={positive}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        )}
        <div className="card-actions">
          <Button type="primary" htmlType="submit" loading={isLoading}>
            {product ? ru.common.save : t.saveNew}
          </Button>
          <Button onClick={onClose}>{ru.common.cancel}</Button>
        </div>
      </Form>
    </Drawer>
  )
}
