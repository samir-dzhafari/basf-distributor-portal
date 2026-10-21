import { BellOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { formatDateTime } from '@/shared/lib/format'
import type { NotificationsResult } from './notificationsApi'

type Item = NotificationsResult['rows'][number]

const ICON = {
  info: <BellOutlined style={{ color: '#004A96' }} />,
  success: <CheckCircleOutlined style={{ color: '#00793A' }} />,
  warning: <ExclamationCircleOutlined style={{ color: '#A85F00' }} />,
  error: <CloseCircleOutlined style={{ color: '#C50022' }} />,
}

/** Строка уведомления: значок по важности, заголовок, пояснение, время. Непрочитанные выделены. */
export function NotificationItem({ n, onOpen }: { n: Item; onOpen: (n: Item) => void }) {
  return (
    <button type="button" className={`notif${n.read ? '' : ' notif--unread'}`} onClick={() => onOpen(n)}>
      <span className="notif__icon" aria-hidden>
        {ICON[n.severity]}
      </span>
      <span className="notif__body">
        <strong>{n.title}</strong>
        <span className="muted">{n.text}</span>
        <small className="muted">{formatDateTime(n.at)}</small>
      </span>
      {!n.read && <span className="notif__dot" aria-label="Не прочитано" />}
    </button>
  )
}
