import { useEffect, type ReactNode } from 'react'
import { Typography } from 'antd'
import { ru } from '@/shared/i18n/ru'

export function PageHeader({ title, subtitle, extra }: { title: string; subtitle?: string; extra?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — ${ru.appName}`
  }, [title])
  return (
    <div className="page-header">
      <div>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
            {subtitle}
          </Typography.Paragraph>
        )}
      </div>
      {extra && <div className="page-header__extra">{extra}</div>}
    </div>
  )
}
