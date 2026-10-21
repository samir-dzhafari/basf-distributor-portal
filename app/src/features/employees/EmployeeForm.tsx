import { Link } from 'react-router-dom'
import { Alert, Button, Col, Form, Input, Row, Select } from 'antd'
import { ru } from '@/shared/i18n/ru'
import { isEmail, isPhone } from '@/shared/lib/requisites'
import type { Id, Role } from '@/shared/types/domain'
import type { EmployeeInput } from './employeesApi'

const t = ru.employees.form

export type EmployeeValues = Omit<EmployeeInput, 'id'>

/** Данные сотрудника: одна форма для создания и правки. Цепочку подчинения защищаем: руководитель — не сам и не подчинённый. */
export function EmployeeForm({
  initial,
  roles,
  managers,
  roleLocked,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial: EmployeeValues
  roles: Role[]
  managers: { id: Id; name: string }[]
  roleLocked?: boolean
  submitLabel: string
  submitting: boolean
  onSubmit: (v: EmployeeValues) => void | Promise<void>
}) {
  const [form] = Form.useForm<EmployeeValues>()
  const required = [{ required: true, whitespace: true, message: ru.common.required }]
  return (
    <Form form={form} layout="vertical" size="large" requiredMark={false} initialValues={initial} onFinish={onSubmit}>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="lastName" label={t.lastName} rules={required}>
            <Input autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="firstName" label={t.firstName} rules={required}>
            <Input autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="email"
            label={t.email}
            extra={t.emailHint}
            rules={[
              { required: true, message: ru.common.required },
              {
                validator: (_, v) =>
                  !v || isEmail(v) ? Promise.resolve() : Promise.reject(new Error(ru.common.emailInvalid)),
              },
            ]}
          >
            <Input inputMode="email" autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="phone"
            label={t.phone}
            rules={[
              {
                validator: (_, v) =>
                  !v || isPhone(v) ? Promise.resolve() : Promise.reject(new Error(ru.common.phoneInvalid)),
              },
            ]}
          >
            <Input inputMode="tel" placeholder="+7 900 123-45-67" autoComplete="off" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="roleId"
            label={t.role}
            extra={roleLocked ? t.selfRole : t.roleHint}
            rules={[{ required: true, message: ru.common.required }]}
          >
            <Select
              disabled={roleLocked}
              options={roles
                .filter((r) => r.active || r.id === initial.roleId)
                .map((r) => ({ value: r.id, label: r.name }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="managerId" label={t.manager} extra={t.managerHint}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t.noManager}
              options={managers.map((m) => ({ value: m.id, label: m.name }))}
            />
          </Form.Item>
        </Col>
      </Row>
      <Button type="primary" htmlType="submit" loading={submitting}>
        {submitLabel}
      </Button>
    </Form>
  )
}

export function InviteAlert({ link, onClose }: { link: string; onClose: () => void }) {
  const t2 = ru.employees.invite
  return (
    <Alert
      type="success"
      showIcon
      closable
      onClose={onClose}
      style={{ marginBottom: 16 }}
      message={t2.sent}
      description={
        <>
          {t2.demo} <Link to={link}>{t2.open}</Link>
        </>
      }
    />
  )
}
