import { Button, Result } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'

/** Единое сообщение об ошибке загрузки: что случилось по-человечески и кнопка «Повторить». */
export function ErrorState({
  error,
  onRetry,
  compact = false,
}: {
  error?: unknown
  onRetry?: () => void
  compact?: boolean
}) {
  return (
    <Result
      status="warning"
      title={ru.common.errorTitle}
      subTitle={error ? errorMessage(error) : ru.common.errorText}
      style={compact ? { padding: '16px 0' } : undefined}
      extra={
        onRetry && (
          <Button type="primary" size="large" onClick={onRetry}>
            {ru.common.retry}
          </Button>
        )
      }
    />
  )
}
