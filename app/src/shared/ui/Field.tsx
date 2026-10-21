import type { ReactNode } from 'react'
import { Typography } from 'antd'

/** Поле формы: подпись сверху, подсказка, текст ошибки у самого поля. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div className="field" role="group" aria-label={label}>
      <Typography.Text strong className="field__label">
        {label}
      </Typography.Text>
      {hint && <div className="field__hint">{hint}</div>}
      {children}
      {error && (
        <div className="field__error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
