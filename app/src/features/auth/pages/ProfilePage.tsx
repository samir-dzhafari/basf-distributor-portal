import { useState } from 'react'
import { Alert, App, Button, Card, Col, Descriptions, Form, Input, Row, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useAppSelector } from '@/app/hooks'
import { errorCode, errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PasswordFields } from '@/shared/ui/PasswordFields'
import { useChangePasswordMutation, useUpdateProfileMutation } from '../authApi'
import { useMe } from '../useMe'
import { MySubscriptions } from '@/features/notifications/MySubscriptions'

const t = ru.profile

/** Телефон РФ: 11 цифр, начинается с 7 или 8. */
const phoneOk = (v?: string) => {
  const d = (v ?? '').replace(/\D/g, '')
  return d.length === 11 && (d[0] === '7' || d[0] === '8')
}

export default function ProfilePage() {
  const { message } = App.useApp()
  const userId = useAppSelector((s) => s.auth.userId)!
  const { data: me } = useMe()
  const [update, { isLoading: saving }] = useUpdateProfileMutation()
  const [change, { isLoading: changing }] = useChangePasswordMutation()
  const [pwdForm] = Form.useForm()
  const [pwdError, setPwdError] = useState<string>()

  if (!me) return null
  const { user, role, clientName } = me

  const onSave = async (v: { firstName: string; lastName: string; phone: string }) => {
    const r = await update({ userId, ...v })
    if ('error' in r) message.error(errorMessage(r.error))
    else message.success(ru.common.saved)
  }

  const onChangePassword = async (v: { current: string; password: string }) => {
    setPwdError(undefined)
    const r = await change({ userId, current: v.current, next: v.password })
    if ('error' in r) return setPwdError(errorCode(r.error) === 'wrongCurrent' ? t.wrongCurrent : errorMessage(r.error))
    message.success(t.passwordUpdated)
    pwdForm.resetFields()
  }

  return (
    <>
      <PageHeader title={t.title} />
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title={t.personal}>
            <Form
              layout="vertical"
              requiredMark={false}
              onFinish={onSave}
              initialValues={{ firstName: user.firstName, lastName: user.lastName, phone: user.phone }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="lastName"
                    label={t.lastName}
                    rules={[{ required: true, message: ru.common.required }]}
                  >
                    <Input autoComplete="family-name" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="firstName"
                    label={t.firstName}
                    rules={[{ required: true, message: ru.common.required }]}
                  >
                    <Input autoComplete="given-name" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="phone"
                label={t.phone}
                rules={[
                  { required: true, message: ru.common.required },
                  {
                    validator: (_, v) =>
                      !v || phoneOk(v) ? Promise.resolve() : Promise.reject(new Error(ru.common.phoneInvalid)),
                  },
                ]}
              >
                <Input autoComplete="tel" inputMode="tel" placeholder="+7 900 123-45-67" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>
                {ru.common.save}
              </Button>
            </Form>
            <Descriptions column={1} size="small" style={{ marginTop: 24 }} styles={{ label: { width: 170 } }}>
              <Descriptions.Item label={t.email}>{user.email}</Descriptions.Item>
              <Descriptions.Item label={t.role}>{role.name}</Descriptions.Item>
              {clientName && <Descriptions.Item label={t.company}>{clientName}</Descriptions.Item>}
            </Descriptions>
            <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
              {t.emailHint}
            </Typography.Paragraph>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={t.security}>
            {pwdError && <Alert type="error" showIcon message={pwdError} style={{ marginBottom: 16 }} role="alert" />}
            <Form form={pwdForm} layout="vertical" requiredMark={false} onFinish={onChangePassword}>
              <Form.Item
                name="current"
                label={t.currentPassword}
                rules={[{ required: true, message: ru.common.required }]}
              >
                <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
              </Form.Item>
              <PasswordFields email={user.email} />
              <Button type="primary" htmlType="submit" loading={changing}>
                {t.changePassword}
              </Button>
            </Form>
          </Card>
          <Card title={t.notifications} style={{ marginTop: 24 }}>
            <MySubscriptions kind={user.kind} email={user.email} />
          </Card>
        </Col>
      </Row>
    </>
  )
}
