import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Input, Result, Typography } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import { ru } from '@/shared/i18n/ru'
import { errorMessage } from '@/app/api'
import { AuthLayout } from '../AuthLayout'
import { useRequestPasswordResetMutation } from '../authApi'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [request, { isLoading }] = useRequestPasswordResetMutation()
  const [done, setDone] = useState<{ demoLink?: string }>()
  const [error, setError] = useState<string>()

  const onFinish = async (v: { email: string }) => {
    setError(undefined)
    const r = await request(v)
    if ('error' in r) setError(errorMessage(r.error))
    else setDone(r.data)
  }

  if (done) {
    return (
      <AuthLayout>
        <Result
          status="success"
          title={ru.auth.forgotDoneTitle}
          subTitle={ru.auth.forgotDoneText}
          style={{ padding: '8px 0' }}
        />
        {import.meta.env.VITE_DEMO !== 'false' && done.demoLink && (
          <Alert
            type="info"
            showIcon
            message={ru.auth.demoMailTitle}
            description={
              <>
                <p style={{ marginBottom: 8 }}>{ru.auth.demoMailText}</p>
                <Button type="primary" onClick={() => navigate(done.demoLink!)}>
                  {ru.auth.demoMailButton}
                </Button>
              </>
            }
            style={{ marginBottom: 16 }}
          />
        )}
        <Link to="/login">{ru.auth.backToLogin}</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Typography.Title level={2}>{ru.auth.forgotTitle}</Typography.Title>
      <Typography.Paragraph type="secondary">{ru.auth.forgotText}</Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} role="alert" />}
      <Form layout="vertical" size="large" requiredMark={false} onFinish={onFinish}>
        <Form.Item
          name="email"
          label={ru.auth.email}
          rules={[
            { required: true, message: ru.common.required },
            { type: 'email', message: ru.common.emailInvalid },
          ]}
        >
          <Input prefix={<MailOutlined />} autoComplete="username" inputMode="email" autoFocus />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={isLoading}>
          {ru.auth.sendLink}
        </Button>
      </Form>
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Link to="/login">{ru.auth.backToLogin}</Link>
      </div>
    </AuthLayout>
  )
}
