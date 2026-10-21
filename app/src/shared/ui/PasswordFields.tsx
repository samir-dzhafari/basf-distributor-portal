import { Form, Input } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { ru } from '@/shared/i18n/ru'
import { isPasswordValid } from '@/shared/lib/password'
import { PasswordRules } from './PasswordRules'

/** «Новый пароль» + живой список требований + «Повторите пароль». Используется внутри antd Form. */
export function PasswordFields({
  email,
  name = 'password',
  label = ru.auth.newPassword,
}: {
  email?: string
  name?: string
  label?: string
}) {
  const form = Form.useFormInstance()
  const value: string = Form.useWatch(name, form) ?? ''
  return (
    <>
      <Form.Item
        name={name}
        label={label}
        rules={[
          { required: true, message: ru.common.required },
          {
            validator: (_, v) =>
              !v || isPasswordValid(v, email) ? Promise.resolve() : Promise.reject(new Error(ru.auth.passwordNotValid)),
          },
        ]}
      >
        <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
      </Form.Item>
      <PasswordRules password={value} email={email} />
      <Form.Item
        name="confirm"
        label={ru.auth.repeatPassword}
        dependencies={[name]}
        rules={[
          { required: true, message: ru.common.required },
          ({ getFieldValue }) => ({
            validator: (_, v) =>
              !v || getFieldValue(name) === v ? Promise.resolve() : Promise.reject(new Error(ru.auth.passwordsDiffer)),
          }),
        ]}
      >
        <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
      </Form.Item>
    </>
  )
}
