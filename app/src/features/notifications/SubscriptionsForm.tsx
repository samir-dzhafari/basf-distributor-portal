import { useState } from 'react'
import { Button, Switch, Typography } from 'antd'
import { ru } from '@/shared/i18n/ru'
import { NOTIFICATION_META, NOTIFICATION_TYPES_FOR } from '@/shared/lib/notificationMeta'
import type { NotificationType } from '@/shared/types/domain'
import type { Subscriptions } from './notificationsApi'

const t = ru.notifications.subs

/** Подписки: почта и отдельные события. Используется в профиле и в настройке пользователя клиента администратором. */
export function SubscriptionsForm({
  value,
  kind,
  email,
  saving,
  onSave,
}: {
  value: Subscriptions
  kind: 'client' | 'employee'
  email: string
  saving: boolean
  onSave: (s: Subscriptions) => void | Promise<void>
}) {
  const [notifyEmail, setEmail] = useState(value.notifyEmail)
  const [muted, setMuted] = useState<NotificationType[]>(value.mutedTypes)
  const dirty =
    notifyEmail !== value.notifyEmail ||
    JSON.stringify([...muted].sort()) !== JSON.stringify([...value.mutedTypes].sort())

  const toggle = (type: NotificationType, on: boolean) =>
    setMuted((cur) => (on ? cur.filter((x) => x !== type) : [...new Set([...cur, type])]))

  return (
    <div>
      <Typography.Paragraph type="secondary">{t.hint}</Typography.Paragraph>
      <label className="cond-switch" style={{ marginBottom: 20 }}>
        <Switch checked={notifyEmail} onChange={setEmail} aria-label={t.email} />
        <span>
          <strong>{t.email}</strong>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
            {t.emailHint(email)}
          </Typography.Text>
        </span>
      </label>
      <h4 style={{ margin: '0 0 8px' }}>{t.events}</h4>
      <div className="sub-list">
        {NOTIFICATION_TYPES_FOR[kind].map((type) => (
          <label key={type} className="sub-row">
            <Switch
              checked={!muted.includes(type)}
              onChange={(on) => toggle(type, on)}
              aria-label={NOTIFICATION_META[type].label}
            />
            <span>
              <strong>{NOTIFICATION_META[type].label}</strong>
            </span>
          </label>
        ))}
      </div>
      <Button
        type="primary"
        size="large"
        disabled={!dirty}
        loading={saving}
        onClick={() => onSave({ notifyEmail, mutedTypes: muted })}
        style={{ marginTop: 20 }}
      >
        {t.save}
      </Button>
    </div>
  )
}
