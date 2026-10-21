import type { Permission } from '@/shared/types/domain'

export interface PermissionGroup {
  title: string
  items: { key: Permission; label: string; hint: string }[]
}

/** Разрешения для конструктора ролей: понятные названия и группы. Перечень фиксируется на этапе проектирования (фич-лист 4.3). */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: 'Заказы',
    items: [
      {
        key: 'orders.create',
        label: 'Создавать заказы',
        hint: 'Мастер заказа, черновики. Сотрудник — за клиентов из своей зоны.',
      },
      { key: 'orders.edit', label: 'Исправлять заказы', hint: 'Шапка заказа до одобрения, свой комментарий.' },
      { key: 'orders.approve', label: 'Одобрять и отклонять', hint: 'Очередь одобрения. Свои заказы одобрить нельзя.' },
      { key: 'orders.cancel', label: 'Отменять заказы', hint: 'До передачи в 1С, с обязательной причиной.' },
      { key: 'orders.export', label: 'Выгружать заказы в Excel', hint: 'Только то, что роль видит в списке.' },
      { key: 'documents.upload', label: 'Загружать документы к заказам', hint: 'Накладные, УПД и другие.' },
    ],
  },
  {
    title: 'Клиенты и каталог',
    items: [
      {
        key: 'clients.manage',
        label: 'Работать с клиентами',
        hint: 'Реквизиты, пользователи, условия, ассортимент, группы, импорт.',
      },
      { key: 'products.manage', label: 'Вести продукты и цены', hint: 'Закрытие, классификация, прайс-лист, импорт.' },
      { key: 'applications.manage', label: 'Вести приложения к договорам', hint: 'Приложения и ответственные.' },
      {
        key: 'dictionaries.manage',
        label: 'Менять справочники',
        hint: 'Типы бизнеса, регионы, условия оплаты и поставки, ставки НДС.',
      },
    ],
  },
  {
    title: 'Администрирование',
    items: [
      {
        key: 'users.manage',
        label: 'Управлять сотрудниками',
        hint: 'Карточки, зона ответственности, иерархия, деактивация.',
      },
      { key: 'roles.manage', label: 'Управлять ролями', hint: 'Конструктор ролей и разрешений.' },
      { key: 'exchange.manage', label: 'Следить за обменом с 1С', hint: 'Журнал обмена, повторная отправка.' },
      { key: 'settings.manage', label: 'Менять системные настройки', hint: 'Лимиты, правила, сессии.' },
      { key: 'audit.view', label: 'Смотреть журнал действий', hint: 'Кто, когда и что менял.' },
    ],
  },
]

export const PERMISSION_LABEL = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])),
) as Record<Permission, string>

/** Что можно давать роли клиента: только действия с собственными заказами. */
export const CLIENT_PERMISSIONS: Permission[] = ['orders.create', 'orders.cancel', 'orders.export']
