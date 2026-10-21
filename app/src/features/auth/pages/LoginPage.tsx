import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Form, Input, Skeleton, Typography } from 'antd'
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons'
import { errorCode } from '@/app/api'
import { useAppSelector } from '@/app/hooks'
import { ru } from '@/shared/i18n/ru'
import { DEMO_INVITE_TOKEN } from '@/mocks/seed'
import { AuthLayout } from '../AuthLayout'
import { useDemoLoginMutation, useGetDemoPersonasQuery, useLoginMutation } from '../authApi'

const DEMO = import.meta.env.VITE_DEMO !== 'false'

const ERRORS: Record<string, string> = {
  credentials: ru.auth.wrongCredentials,
  blocked: ru.auth.blocked,
  invited: ru.auth.notActivated,
  locked: ru.auth.tooManyAttempts,
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { from?: string; notice?: string } | null
  const userId = useAppSelector((s) => s.auth.userId)
  const [login, { isLoading }] = useLoginMutation()
  const [demoLogin, { isLoading: demoLoading, originalArgs }] = useDemoLoginMutation()
  const { data: personas, isLoading: personasLoading } = useGetDemoPersonasQuery(undefined, { skip: !DEMO })
  const [error, setError] = useState<string>()

  if (userId) return <Navigate to={state?.from ?? '/'} replace />

  const finish = (r: { error: unknown } | object) => {
    if ('error' in r) setError(ERRORS[errorCode(r.error) ?? ''] ?? ru.common.somethingWrong)
    else navigate(state?.from ?? '/', { replace: true })
  }

  const onFinish = async (v: { email: string; password: string }) => {
    setError(undefined)
    finish(await login(v))
  }

  const onDemo = async (id: string) => {
    setError(undefined)
    finish(await demoLogin(id))
  }

  return (
    <AuthLayout>
      <Typography.Title level={2}>{ru.auth.loginTitle}</Typography.Title>
      {state?.notice && <Alert type="success" showIcon message={state.notice} style={{ marginBottom: 16 }} />}
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} role="alert" />}
      <Form
        layout="vertical"
        size="large"
        requiredMark={false}
        onFinish={onFinish}
        onValuesChange={() => setError(undefined)}
      >
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
        <Form.Item name="password" label={ru.auth.password} rules={[{ required: true, message: ru.common.required }]}>
          <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={isLoading}>
          {ru.auth.login}
        </Button>
      </Form>
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Link to="/forgot">{ru.auth.forgot}</Link>
      </div>
      <Typography.Paragraph type="secondary" style={{ marginTop: 20, fontSize: 13, textAlign: 'center' }}>
        {ru.auth.noSelfRegister}
      </Typography.Paragraph>

      {DEMO && (
        <Card size="small" className="demo-card" title={ru.auth.demoTitle}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            {ru.auth.demoHint}
          </Typography.Paragraph>
          {personasLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : (
            <div className="persona-grid">
              {personas?.map((p) => (
                <button
                  key={p.userId}
                  type="button"
                  className="persona"
                  disabled={demoLoading}
                  aria-busy={demoLoading && originalArgs === p.userId}
                  onClick={() => onDemo(p.userId)}
                >
                  <UserOutlined aria-hidden />
                  <span>
                    <strong>{p.name}</strong>
                    <em>{p.company ? `${p.roleName}, ${p.company}` : p.roleName}</em>
                    <small>{p.description}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
          <Link to={`/activate/${DEMO_INVITE_TOKEN}`} style={{ display: 'inline-block', marginTop: 12 }}>
            {ru.auth.demoInvite}
          </Link>
        </Card>
      )}
    </AuthLayout>
  )
}
