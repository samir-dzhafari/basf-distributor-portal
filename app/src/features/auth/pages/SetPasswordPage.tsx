import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Form, Result, Spin, Typography } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { PasswordFields } from '@/shared/ui/PasswordFields'
import { AuthLayout } from '../AuthLayout'
import { useGetTokenInfoQuery, useSetPasswordByTokenMutation } from '../authApi'

/** Один экран для двух ссылок из письма: приглашение (/activate) и сброс пароля (/reset). */
export default function SetPasswordPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { data: info, isLoading, isError } = useGetTokenInfoQuery(token)
  const [setPassword, { isLoading: saving }] = useSetPasswordByTokenMutation()
  const [error, setError] = useState<string>()

  if (isLoading) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      </AuthLayout>
    )
  }

  if (isError || !info) {
    return (
      <AuthLayout>
        <Result
          status="warning"
          title={ru.auth.linkInvalidTitle}
          subTitle={ru.auth.linkInvalidText}
          extra={
            <Button type="primary" size="large" onClick={() => navigate('/forgot')}>
              {ru.auth.requestNewLink}
            </Button>
          }
        />
        <div style={{ textAlign: 'center' }}>
          <Link to="/login">{ru.auth.backToLogin}</Link>
        </div>
      </AuthLayout>
    )
  }

  const isInvite = info.type === 'invite'

  const onFinish = async (v: { password: string }) => {
    setError(undefined)
    const r = await setPassword({ token, password: v.password })
    if ('error' in r) return setError(errorMessage(r.error))
    if (r.data.type === 'invite') navigate('/', { replace: true })
    else navigate('/login', { replace: true, state: { notice: ru.auth.passwordChanged } })
  }

  return (
    <AuthLayout>
      <Typography.Title level={2}>
        {isInvite ? `${ru.auth.activateTitle} ${info.name}` : ru.auth.resetTitle}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {isInvite ? ru.auth.activateText : ru.auth.resetText} <br />
        <Typography.Text strong>{info.email}</Typography.Text>
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} role="alert" />}
      <Form layout="vertical" size="large" requiredMark={false} onFinish={onFinish}>
        <PasswordFields email={info.email} />
        <Button type="primary" htmlType="submit" size="large" block loading={saving}>
          {isInvite ? ru.auth.activate : ru.auth.savePassword}
        </Button>
      </Form>
    </AuthLayout>
  )
}
