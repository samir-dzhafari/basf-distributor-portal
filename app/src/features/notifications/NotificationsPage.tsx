import { useState } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Empty, Pagination, Segmented, Skeleton } from 'antd'
import { ru } from '@/shared/i18n/ru'
import { PageHeader } from '@/shared/ui/PageHeader'
import { NotificationItem } from './NotificationItem'
import {
  useListNotificationsQuery,
  useMarkNotificationsReadMutation,
  type NotificationsResult,
} from './notificationsApi'

const t = ru.notifications

/** Все уведомления: фильтр «непрочитанные», отметка прочитанными, переход к заказу. */
export default function NotificationsPage() {
  const navigate = useNavigate()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, error, refetch } = useListNotificationsQuery(
    { unreadOnly, page, pageSize: 20 },
    { refetchOnMountOrArgChange: true, pollingInterval: 15000 },
  )
  const [mark] = useMarkNotificationsReadMutation()

  const open = async (n: NotificationsResult['rows'][number]) => {
    if (!n.read) await mark({ ids: [n.id] })
    navigate(`/orders/${n.orderId}`)
  }

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        extra={
          <Button size="large" disabled={!data?.unread} onClick={() => mark({ all: true })}>
            {t.markAll}
          </Button>
        }
      />
      <Segmented
        size="large"
        value={unreadOnly ? 'unread' : 'all'}
        onChange={(v) => {
          setUnreadOnly(v === 'unread')
          setPage(1)
        }}
        options={[
          { value: 'all', label: t.all },
          { value: 'unread', label: `${t.unread}${data ? ` (${data.unread})` : ''}` },
        ]}
        style={{ marginBottom: 16 }}
      />
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data.rows.length ? (
        <Card>
          <Empty description={<strong>{unreadOnly ? t.emptyUnread : t.empty}</strong>}>
            <p className="muted">{t.emptyText}</p>
          </Empty>
        </Card>
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <div className="notif-list">
            {data.rows.map((n) => (
              <NotificationItem key={n.id} n={n} onOpen={open} />
            ))}
          </div>
          {data.total > 20 && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <Pagination
                current={page}
                pageSize={20}
                total={data.total}
                showSizeChanger={false}
                onChange={setPage}
                showTotal={t.found}
              />
            </div>
          )}
        </Card>
      )}
    </>
  )
}
