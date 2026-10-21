import { Tag } from 'antd'
import { ORDER_STATUS } from '@/shared/lib/status'
import type { OrderStatus } from '@/shared/types/domain'

export function StatusTag({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status]
  return (
    <Tag color={s.color} style={{ marginInlineEnd: 0, fontSize: 14, padding: '2px 10px' }}>
      {s.label}
    </Tag>
  )
}
