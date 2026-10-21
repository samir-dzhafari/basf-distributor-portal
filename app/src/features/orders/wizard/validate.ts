import dayjs from 'dayjs'
import { ru } from '@/shared/i18n/ru'
import { checkQty } from '@/shared/lib/money'
import type { Id } from '@/shared/types/domain'

const t = ru.order.errors

/** Всё, что пользователь ввёл в мастере. Пустая строка — «не выбрано». */
export interface WizardData {
  draftId?: Id
  clientId: Id
  consigneeId: Id
  regionId: Id
  businessTypeId: Id
  paymentTermId: Id
  deliveryTermId: Id
  /** YYYY-MM-DD */
  desiredDate: string
  applicationId: Id
  /** productId → количество (только > 0) */
  qty: Record<Id, number>
  comment: string
}

export const emptyWizard = (): WizardData => ({
  clientId: '',
  consigneeId: '',
  regionId: '',
  businessTypeId: '',
  paymentTermId: '',
  deliveryTermId: '',
  desiredDate: '',
  applicationId: '',
  qty: {},
  comment: '',
})

export const STEPS = ru.order.steps
export const STEP = { recipient: 0, terms: 1, application: 2, summary: 3, products: 4, submit: 5 } as const

export type Errors = Record<string, string>

export function validateRecipient(d: WizardData): Errors {
  const e: Errors = {}
  if (!d.clientId) e.clientId = t.client
  if (!d.consigneeId) e.consigneeId = t.consignee
  if (!d.regionId) e.regionId = t.region
  if (!d.businessTypeId) e.businessTypeId = t.businessType
  return e
}

export function validateTerms(d: WizardData, today = dayjs()): Errors {
  const e: Errors = {}
  if (!d.paymentTermId) e.paymentTermId = t.chooseOption
  if (!d.deliveryTermId) e.deliveryTermId = t.chooseOption
  if (!d.desiredDate) e.desiredDate = t.dateRequired
  else if (dayjs(d.desiredDate).isBefore(today.startOf('day').add(1, 'day'))) e.desiredDate = t.dateEarly
  return e
}

export function validateApplication(d: WizardData): Errors {
  return d.applicationId ? {} : { applicationId: t.application }
}

/** Шапка заказа целиком (шаги 1–3). */
export const validateHeader = (d: WizardData): Errors => ({
  ...validateRecipient(d),
  ...validateTerms(d),
  ...validateApplication(d),
})

export interface QtyRule {
  id: Id
  name: string
  minQty: number
  multiple: number
  unit: string
}

/** Сообщение об ошибке количества с подсказкой ближайшего допустимого значения; null — всё в порядке. */
export function qtyProblem(
  qty: number,
  p: Pick<QtyRule, 'minQty' | 'multiple' | 'unit'>,
): { message: string; nearest: number } | null {
  const r = checkQty(qty, p.minQty, p.multiple)
  if (r.ok) return null
  const parts = [t.multiple(p.multiple, p.unit)]
  if (p.minQty > p.multiple) parts.push(t.minimum(p.minQty, p.unit))
  return { message: `${parts.join(', ')}. ${t.nearest(r.nearest, p.unit)}`, nearest: r.nearest }
}

export function validateItems(d: WizardData, rules: Map<Id, QtyRule>): Errors {
  const e: Errors = {}
  const ids = Object.keys(d.qty)
  if (!ids.length) e.items = t.itemsEmpty
  for (const id of ids) {
    const rule = rules.get(id)
    if (!rule) e[`qty:${id}`] = t.productUnavailable
    else {
      const p = qtyProblem(d.qty[id], rule)
      if (p) e[`qty:${id}`] = p.message
    }
  }
  return e
}

/** Ошибки для указанного шага. */
export function validateStep(step: number, d: WizardData, rules: Map<Id, QtyRule>): Errors {
  switch (step) {
    case STEP.recipient:
      return validateRecipient(d)
    case STEP.terms:
      return validateTerms(d)
    case STEP.application:
      return validateApplication(d)
    case STEP.summary:
      return validateHeader(d)
    default:
      return validateItems(d, rules)
  }
}

/** Индекс первого шага с ошибкой или -1. */
export function firstInvalidStep(d: WizardData, rules: Map<Id, QtyRule>): number {
  if (Object.keys(validateRecipient(d)).length) return STEP.recipient
  if (Object.keys(validateTerms(d)).length) return STEP.terms
  if (Object.keys(validateApplication(d)).length) return STEP.application
  if (Object.keys(validateItems(d, rules)).length) return STEP.products
  return -1
}

/** Шаг, на котором исправляется поле шапки. */
export const STEP_OF_FIELD: Record<string, number> = {
  clientId: STEP.recipient,
  consigneeId: STEP.recipient,
  regionId: STEP.recipient,
  businessTypeId: STEP.recipient,
  paymentTermId: STEP.terms,
  deliveryTermId: STEP.terms,
  desiredDate: STEP.terms,
  applicationId: STEP.application,
}
