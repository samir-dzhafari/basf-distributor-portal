import { Alert, Button, List, Popconfirm } from 'antd'
import { ru } from '@/shared/i18n/ru'
import { formatDateTime, formatMoney } from '@/shared/lib/format'
import type { DraftSummary } from '../ordersApi'

const t = ru.order.drafts

/** Неотправленные черновики пользователя: продолжить или удалить. */
export function DraftsBanner({
  drafts,
  onResume,
  onRemove,
}: {
  drafts: DraftSummary[]
  onResume: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
      message={t.title(drafts.length)}
      description={
        <List
          size="small"
          dataSource={drafts}
          renderItem={(d) => (
            <List.Item
              actions={[
                <Button key="resume" type="link" onClick={() => onResume(d.id)}>
                  {t.resume}
                </Button>,
                <Popconfirm
                  key="remove"
                  title={t.removeTitle}
                  description={t.removeHint}
                  okText={t.remove}
                  cancelText={t.cancel}
                  onConfirm={() => onRemove(d.id)}
                >
                  <Button type="link" danger>
                    {t.remove}
                  </Button>
                </Popconfirm>,
              ]}
            >
              {d.clientName} · {formatDateTime(d.createdAt)} · {ru.order.itemsCount(d.itemsCount)} ·{' '}
              {formatMoney(d.total)}
            </List.Item>
          )}
        />
      }
    />
  )
}
