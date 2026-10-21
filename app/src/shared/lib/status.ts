import type { OrderStatus } from '@/shared/types/domain'

export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'default' },
  pending: { label: 'На одобрении', color: 'gold' },
  rejected: { label: 'Отклонён', color: 'red' },
  cancelled: { label: 'Отменён', color: 'default' },
  sent: { label: 'Передан в 1С', color: 'blue' },
  accepted: { label: 'Принят в 1С', color: 'cyan' },
  completed: { label: 'Выполнен', color: 'green' },
  error: { label: 'Ошибка передачи', color: 'volcano' },
}
