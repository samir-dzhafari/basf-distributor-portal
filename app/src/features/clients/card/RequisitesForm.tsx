import { Button, Col, Form, Input, Row, Select, Switch, Typography } from 'antd'
import { ru } from '@/shared/i18n/ru'
import { validateRequisites, type Requisites } from '@/shared/lib/requisites'
import type { Region } from '@/shared/types/domain'

const t = ru.clients.requisites

export const emptyRequisites = (): Requisites => ({
  code: '',
  name: '',
  email: '',
  inn: '',
  kpp: '',
  legalAddress: '',
  phone: '',
  regionIds: [],
  active: true,
})

/** Реквизиты клиента. Одна форма для создания и редактирования; проверки — те же, что на «сервере». */
export function RequisitesForm({
  initial,
  regions,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial: Requisites
  regions: Region[]
  submitLabel: string
  submitting: boolean
  onSubmit: (v: Requisites) => void | Promise<void>
}) {
  const [form] = Form.useForm<Requisites>()
  const rule = (field: keyof Requisites) => ({
    validator: () => {
      const message = validateRequisites({ ...emptyRequisites(), ...form.getFieldsValue(true) })[field]
      return message ? Promise.reject(new Error(message)) : Promise.resolve()
    },
  })

  return (
    <Form form={form} layout="vertical" size="large" requiredMark={false} initialValues={initial} onFinish={onSubmit}>
      <Row gutter={16}>
        <Col xs={24} md={16}>
          <Form.Item name="name" label={t.name} validateTrigger="onBlur" rules={[rule('name')]}>
            <Input autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="code" label={t.code} extra={t.codeHint} validateTrigger="onBlur" rules={[rule('code')]}>
            <Input autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="inn" label={t.inn} validateTrigger="onBlur" rules={[rule('inn')]}>
            <Input inputMode="numeric" maxLength={12} autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="kpp" label={t.kpp} validateTrigger="onBlur" dependencies={['inn']} rules={[rule('kpp')]}>
            <Input inputMode="numeric" maxLength={9} autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="phone" label={t.phone} validateTrigger="onBlur" rules={[rule('phone')]}>
            <Input inputMode="tel" placeholder="+7 900 123-45-67" autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item name="legalAddress" label={t.address} validateTrigger="onBlur" rules={[rule('legalAddress')]}>
            <Input autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="email" label={t.email} extra={t.emailHint} validateTrigger="onBlur" rules={[rule('email')]}>
            <Input inputMode="email" autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="regionIds" label={t.regions} rules={[rule('regionIds')]}>
            <Select mode="multiple" options={regions.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item name="active" label={t.active} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        {t.docsNote}
      </Typography.Paragraph>
      <Button type="primary" htmlType="submit" loading={submitting}>
        {submitLabel}
      </Button>
    </Form>
  )
}
