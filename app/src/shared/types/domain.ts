export type Id = string

/** Права (разрешения). Перечень фиксируется на этапе проектирования (фич-лист 4.3). */
export const PERMISSIONS = [
  'orders.create',
  'orders.edit',
  'orders.approve',
  'orders.cancel',
  'orders.export',
  'documents.upload',
  'clients.manage',
  'products.manage',
  'applications.manage',
  'dictionaries.manage',
  'users.manage',
  'roles.manage',
  'exchange.manage',
  'settings.manage',
  'audit.view',
] as const
export type Permission = (typeof PERMISSIONS)[number]

export type RoleType = 'employee' | 'client'

export interface Role {
  id: Id
  name: string
  type: RoleType
  description: string
  permissions: Permission[]
  /** Полный доступ (администратор) — разрешения не проверяются. */
  fullAccess?: boolean
  active: boolean
}

export type UserStatus = 'invited' | 'active' | 'blocked'

export interface User {
  id: Id
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
  roleId: Id
  kind: RoleType
  status: UserStatus
  /** Для пользователей клиента. */
  clientId?: Id
  /** Для сотрудников: зона ответственности и руководитель. */
  managerId?: Id
  scope?: { clientIds: Id[]; regionIds: Id[]; businessTypeIds: Id[] }
  /** Получает ли пользователь письма (настройка подписки). */
  notifyEmail: boolean
  /** Типы уведомлений, которые пользователь отключил (и в кабинете, и на почту). */
  mutedTypes?: NotificationType[]
}

export type SafeUser = Omit<User, 'password'>

export interface Region {
  id: Id
  name: string
}

export interface BusinessType {
  id: Id
  name: string
  validFrom: string
  validTo?: string
  paymentTermIds: Id[]
}

export interface PaymentTerm {
  id: Id
  /** Код для 1С. */
  code: string
  name: string
  /** Способ оплаты (справочник). */
  methodId: Id
}

export interface DeliveryTerm {
  id: Id
  code: string
  name: string
}

export interface Consignee {
  id: Id
  clientId: Id
  code: string
  name: string
  address: string
}

export interface Client {
  id: Id
  /** Код в учётной системе. */
  code: string
  name: string
  email: string
  inn: string
  kpp: string
  legalAddress: string
  phone: string
  regionIds: Id[]
  active: boolean
  businessTypeIds: Id[]
  paymentTermIds: Id[]
  defaultPaymentTermId: Id
  deliveryTermIds: Id[]
  canChooseDelivery: boolean
  /** Индивидуальная ставка НДС (приоритетнее ставки группы), %. */
  vatRate?: number
  groupId?: Id
  /** Присылать уведомления о заказах на общую почту компании (по умолчанию — да). */
  notifyCommonEmail?: boolean
  availability: {
    closedGroupIds: Id[]
    closedLineIds: Id[]
    closedProductIds: Id[]
    /** Позиции вне открытого прайс-листа, доступные клиенту. */
    openedProductIds: Id[]
  }
}

export interface ProductGroup {
  id: Id
  name: string
  vatRate: number
}

export interface ProductLine {
  id: Id
  name: string
}

export interface Product {
  id: Id
  code: string
  name: string
  groupId: Id
  lineId: Id
  businessTypeIds: Id[]
  /** Объём упаковки. */
  packSize: number
  unit: 'л' | 'кг'
  minQty: number
  /** Кратность (обычно равна объёму упаковки). */
  multiple: number
  price: number
  closed: boolean
  /** Входит ли в открытый прайс-лист. */
  inPriceList: boolean
}

export interface Application {
  id: Id
  number: string
  clientId: Id
  regionId: Id
  businessTypeId: Id
  validFrom: string
  validTo: string
  responsibleIds: Id[]
  active: boolean
}

export type OrderStatus = 'draft' | 'pending' | 'rejected' | 'cancelled' | 'sent' | 'accepted' | 'completed' | 'error'

export interface OrderItem {
  id: Id
  productId: Id
  qty: number
  /** Цена на момент заказа. */
  price: number
  vatRate: number
}

export interface OrderHistoryEntry {
  id: Id
  at: string
  userId: Id
  action: string
  details?: string
}

/** Типы документов к заказу (до 5, фич-лист 11.9). */
export const DOCUMENT_TYPES = ['Накладная', 'Транспортная накладная', 'УПД', 'Счёт-фактура', 'Другое'] as const

export interface OrderDocument {
  id: Id
  type: string
  fileName: string
  size?: number
  /** Содержимое загруженного файла (в демо хранится прямо в мок-БД). */
  dataUrl?: string
  uploadedAt: string
  uploadedById: Id
}

export interface Order {
  id: Id
  number: string
  erpNumber?: string
  status: OrderStatus
  createdAt: string
  createdById: Id
  clientId: Id
  consigneeId: Id
  regionId: Id
  city: string
  businessTypeId: Id
  applicationId: Id
  paymentTermId: Id
  deliveryTermId: Id
  desiredDate: string
  comments: { client?: string; manager?: string; admin?: string }
  items: OrderItem[]
  history: OrderHistoryEntry[]
  documents: OrderDocument[]
  responsibleId?: Id
}

export interface EmailMessage {
  id: Id
  to: string
  subject: string
  body: string
  at: string
  link?: string
  /** Событие, по которому отправлено письмо. */
  kind?: string
  /** HTML-версия письма (для просмотра). */
  html?: string
}

export type TokenType = 'invite' | 'reset'

export interface AuthToken {
  token: string
  userId: Id
  type: TokenType
  expiresAt: string
}

export interface SystemSettings {
  clientUserLimit: number
  separateCreateApprove: boolean
  sessionHours: number
  senderEmail: string
  multiLevelApproval: boolean
}

/** Поведение эмулятора 1С (для демонстрации): отвечает штатно / не отвечает / отклоняет заказ. */
export type ExchangeMode = 'ok' | 'down' | 'reject'

/** Задание на передачу заказа в 1С (фич-лист 15.3–15.5). */
export interface ExchangeJob {
  id: Id
  orderId: Id
  /** Совпадает со статусом заказа после передачи: передан → принят → выполнен, либо ошибка. */
  status: 'sent' | 'accepted' | 'completed' | 'error' | 'cancelled'
  /** Чем закончится эта попытка — решается в момент отправки по режиму эмулятора. */
  outcome: ExchangeMode
  attempts: number
  /** Начало последней попытки. */
  sentAt: string
  /** Момент последней смены статуса. */
  updatedAt: string
  lastError?: string
  erpNumber?: string
  /** Демо-данные: статус зафиксирован и не меняется сам по времени. */
  frozen?: boolean
}

export interface ExchangeLogEntry {
  id: Id
  at: string
  orderId: Id
  level: 'info' | 'error'
  message: string
}

export interface ExchangeState {
  mode: ExchangeMode
  jobs: ExchangeJob[]
  log: ExchangeLogEntry[]
}

/** Условия, которые можно назначать и клиенту, и группе клиентов (массовое назначение, фич-лист 6.9). */
export interface ClientConditions {
  paymentTermIds: Id[]
  defaultPaymentTermId: Id
  businessTypeIds: Id[]
  deliveryTermIds: Id[]
  canChooseDelivery: boolean
  /** Индивидуальная ставка НДС, %; пусто — по группе продуктов. */
  vatRate?: number
  availability: Client['availability']
}

export interface ClientGroup {
  id: Id
  name: string
  description: string
  /** Шаблон условий группы — применяется к участникам по кнопке. */
  template: ClientConditions
}

export interface VatRate {
  id: Id
  /** Ставка, %. */
  rate: number
}

export interface PaymentMethod {
  id: Id
  name: string
}

/** Цена продукта с началом действия; текущая цена — последняя запись, вступившая в силу (фич-лист 8.5). */
export interface PriceEntry {
  id: Id
  productId: Id
  price: number
  /** YYYY-MM-DD */
  validFrom: string
  createdAt: string
  userId: Id
  comment?: string
}

/** События, о которых система уведомляет (фич-лист 13.1). */
export const NOTIFICATION_TYPES = [
  'order.submitted',
  'order.approved',
  'order.rejected',
  'order.changed',
  'order.cancelled',
  'exchange.sent',
  'exchange.error',
  'exchange.accepted',
  'exchange.completed',
  'document.uploaded',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface Notification {
  id: Id
  userId: Id
  type: NotificationType
  orderId: Id
  title: string
  text: string
  at: string
  read: boolean
}

export type AuditEntity =
  | 'client'
  | 'consignee'
  | 'group'
  | 'employee'
  | 'role'
  | 'product'
  | 'price'
  | 'application'
  | 'dictionary'
  | 'settings'
  | 'import'

export interface AuditChange {
  field: string
  from?: string
  to?: string
}

/** Запись журнала действий: кто, когда, над каким объектом и что изменил (фич-лист 14.1). */
export interface AuditEntry {
  id: Id
  at: string
  userId: Id
  entity: AuditEntity
  entityId?: Id
  entityName: string
  action: string
  summary?: string
  changes: AuditChange[]
}
