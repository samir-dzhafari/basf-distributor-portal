import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Empty, Popover, Skeleton } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { ru } from '@/shared/i18n/ru'
import { NotificationItem } from './NotificationItem'
import {
  useGetUnreadCountQuery,
  useListNotificationsQuery,
  useMarkNotificationsReadMutation,
  type NotificationsResult,
} from './notificationsApi'

const t = ru.notifications

/** Колокольчик в шапке: число непрочитанных, быстрый просмотр последних и переход к заказу (фич-лист 13.5). */
export function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { data: unread = 0 } = useGetUnreadCountQuery(undefined, { pollingInterval: 10000 })
  const { data, isLoading } = useListNotificationsQuery({ unreadOnly: false, page: 1, pageSize: 8 }, { skip: !open })
  const [mark] = useMarkNotificationsReadMutation()

  const openItem = async (n: NotificationsResult['rows'][number]) => {
    setOpen(false)
    if (!n.read) await mark({ ids: [n.id] })
    navigate(`/orders/${n.orderId}`)
  }

  const content = (
    <div className="notif-panel">
      <div className="notif-panel__head">
        <strong>{t.title}</strong>
        <Button type="link" size="small" disabled={!unread} onClick={() => mark({ all: true })}>
          {t.markAll}
        </Button>
      </div>
      <div className="notif-panel__list">
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} style={{ padding: 12 }} />
        ) : !data?.rows.length ? (
          <Empty description={t.empty} style={{ padding: 24 }} />
        ) : (
          data.rows.map((n) => <NotificationItem key={n.id} n={n} onOpen={openItem} />)
        )}
      </div>
      <Button
        type="link"
        block
        onClick={() => {
          setOpen(false)
          navigate('/notifications')
        }}
      >
        {t.showAll}
      </Button>
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      arrow={false}
      styles={{ body: { padding: 0 } }}
    >
      <Button
        type="text"
        className="app-header__bell"
        aria-label={t.bellUnread(unread)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Badge count={unread} overflowCount={99} color="#F39500" size="small">
          <BellOutlined style={{ fontSize: 20, color: '#1E1E1E' }} />
        </Badge>
      </Button>
    </Popover>
  )
}
