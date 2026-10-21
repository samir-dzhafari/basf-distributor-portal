import { Timeline, Typography } from 'antd'
import { formatDateTime } from '@/shared/lib/format'
import type { OrderView } from '../ordersViewApi'

const color = (action: string) =>
  /отклон|отмен|Ошибка/i.test(action) ? 'red' : /одобрен|выполнен|Принят/i.test(action) ? 'green' : 'blue'

/** Журнал: кто, когда и что изменил. Новые события сверху. */
export function OrderHistory({ history }: { history: OrderView['history'] }) {
  return (
    <Timeline
      items={history.map((h) => ({
        key: h.id,
        color: color(h.action),
        children: (
          <>
            <div>
              <strong>{h.action}</strong>
            </div>
            {h.details && <div style={{ overflowWrap: 'anywhere', marginTop: 2 }}>{h.details}</div>}
            <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 2 }}>
              {formatDateTime(h.at)} · {h.userName}
            </Typography.Text>
          </>
        ),
      }))}
    />
  )
}
