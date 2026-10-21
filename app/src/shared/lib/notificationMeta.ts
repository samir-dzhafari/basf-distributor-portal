import type { NotificationType } from '@/shared/types/domain'

export type Severity = 'info' | 'success' | 'warning' | 'error'

export interface NotificationMeta {
  /** Название для настроек подписки. */
  label: string
  /** Кому приходит — для администратора и подсказки пользователю. */
  audience: string
  severity: Severity
  /** Заголовок уведомления. */
  title: (number: string) => string
}

/** События, получатели и тексты уведомлений (фич-лист 13.1, 13.3). */
export const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  'order.submitted': {
    label: 'Новый заказ на одобрение',
    audience:
      'Ответственные по приложению и сотрудники с правом одобрения, которым виден заказ; коллеги клиента; общая почта клиента',
    severity: 'info',
    title: (n) => `Заказ ${n} ждёт одобрения`,
  },
  'order.approved': {
    label: 'Заказ одобрен',
    audience: 'Пользователи клиента, автор заказа, общая почта клиента',
    severity: 'success',
    title: (n) => `Заказ ${n} одобрен`,
  },
  'order.rejected': {
    label: 'Заказ отклонён',
    audience: 'Пользователи клиента, автор заказа, общая почта клиента',
    severity: 'error',
    title: (n) => `Заказ ${n} отклонён`,
  },
  'order.changed': {
    label: 'Заказ изменён сотрудником',
    audience: 'Пользователи клиента, автор заказа, общая почта клиента',
    severity: 'warning',
    title: (n) => `В заказ ${n} внесены изменения`,
  },
  'order.cancelled': {
    label: 'Заказ отменён',
    audience: 'Ответственные по приложению, пользователи клиента, общая почта клиента',
    severity: 'warning',
    title: (n) => `Заказ ${n} отменён`,
  },
  'exchange.sent': {
    label: 'Заказ передан в 1С',
    audience: 'Автор заказа и ответственные по приложению',
    severity: 'info',
    title: (n) => `Заказ ${n} передан в 1С`,
  },
  'exchange.error': {
    label: 'Ошибка передачи в 1С',
    audience: 'Сотрудники, следящие за обменом с 1С, и ответственные по приложению',
    severity: 'error',
    title: (n) => `Не удалось передать заказ ${n} в 1С`,
  },
  'exchange.accepted': {
    label: 'Заказ принят в 1С',
    audience: 'Пользователи клиента, автор заказа, ответственные по приложению, общая почта клиента',
    severity: 'success',
    title: (n) => `Заказ ${n} принят в учётной системе`,
  },
  'exchange.completed': {
    label: 'Заказ выполнен',
    audience: 'Пользователи клиента, автор заказа, ответственные по приложению, общая почта клиента',
    severity: 'success',
    title: (n) => `Заказ ${n} выполнен`,
  },
  'document.uploaded': {
    label: 'Загружен документ к заказу',
    audience: 'Пользователи клиента, общая почта клиента',
    severity: 'info',
    title: (n) => `К заказу ${n} добавлен документ`,
  },
}

/** Какие события может получать пользователь каждого типа: настройки подписки показывают только их. */
export const NOTIFICATION_TYPES_FOR: Record<'client' | 'employee', NotificationType[]> = {
  client: [
    'order.submitted',
    'order.approved',
    'order.rejected',
    'order.changed',
    'order.cancelled',
    'exchange.accepted',
    'exchange.completed',
    'document.uploaded',
  ],
  employee: [
    'order.submitted',
    'order.approved',
    'order.rejected',
    'order.changed',
    'order.cancelled',
    'exchange.sent',
    'exchange.error',
    'exchange.accepted',
    'exchange.completed',
  ],
}
