import { CheckCircleFilled, MinusCircleOutlined } from '@ant-design/icons'
import { Typography } from 'antd'
import { checkPassword } from '@/shared/lib/password'
import { ru } from '@/shared/i18n/ru'

/** Живой список требований к паролю — человек сразу видит, чего не хватает. */
export function PasswordRules({ password, email }: { password: string; email?: string }) {
  const rules = checkPassword(password, email)
  return (
    <div aria-live="polite" style={{ marginBottom: 16 }}>
      <Typography.Text type="secondary">{ru.auth.passwordRules}:</Typography.Text>
      <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
        {rules.map((r) => (
          <li
            key={r.id}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              color: r.ok ? '#00793A' : '#5A5F61',
              padding: '2px 0',
            }}
          >
            {r.ok ? <CheckCircleFilled aria-hidden /> : <MinusCircleOutlined aria-hidden />}
            <span>{r.label}</span>
            <span className="sr-only">{r.ok ? ' — выполнено' : ' — не выполнено'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
