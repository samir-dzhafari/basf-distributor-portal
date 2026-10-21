import type { Client } from '@/shared/types/domain'

export type Errors = Record<string, string>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const isEmail = (v: string) => EMAIL.test(v.trim())
export const isInn = (v: string) => /^(\d{10}|\d{12})$/.test(v.trim())
export const isKpp = (v: string) => /^\d{9}$/.test(v.trim())
/** Телефон РФ: 11 цифр, начинается с 7 или 8. */
export const isPhone = (v: string) => {
  const d = v.replace(/\D/g, '')
  return d.length === 11 && (d[0] === '7' || d[0] === '8')
}

export type Requisites = Pick<
  Client,
  'code' | 'name' | 'email' | 'inn' | 'kpp' | 'legalAddress' | 'phone' | 'regionIds' | 'active'
>

/** Реквизиты клиента по требованиям обмена с 1С (фич-лист 6.2). Контрольная сумма ИНН в демо не проверяется. */
export function validateRequisites(v: Requisites): Errors {
  const e: Errors = {}
  if (!v.name.trim()) e.name = 'Укажите наименование'
  if (!/^[\p{L}\d-]{3,15}$/u.test(v.code.trim())) e.code = 'Код в 1С: 3–15 букв, цифр или дефисов, без пробелов'
  if (!isEmail(v.email)) e.email = 'Проверьте адрес почты'
  if (!isInn(v.inn)) e.inn = 'ИНН — 10 цифр (организация) или 12 (ИП)'
  if (v.inn.trim().length === 10 && !isKpp(v.kpp)) e.kpp = 'КПП — 9 цифр'
  if (v.inn.trim().length === 12 && v.kpp.trim() && !isKpp(v.kpp)) e.kpp = 'КПП — 9 цифр или оставьте пустым'
  if (!v.legalAddress.trim()) e.legalAddress = 'Укажите юридический адрес'
  if (!isPhone(v.phone)) e.phone = 'Телефон: +7 900 123-45-67'
  if (!v.regionIds.length) e.regionIds = 'Выберите хотя бы один регион'
  return e
}

/** Условия клиента: хотя бы по одному варианту, оплата по умолчанию — из разрешённых. */
export function validateConditions(c: {
  paymentTermIds: string[]
  defaultPaymentTermId: string
  businessTypeIds: string[]
  deliveryTermIds: string[]
}): Errors {
  const e: Errors = {}
  if (!c.paymentTermIds.length) e.paymentTermIds = 'Выберите хотя бы одно условие оплаты'
  else if (!c.paymentTermIds.includes(c.defaultPaymentTermId))
    e.defaultPaymentTermId = 'Условие по умолчанию должно быть среди выбранных'
  if (!c.businessTypeIds.length) e.businessTypeIds = 'Выберите хотя бы один тип бизнеса'
  if (!c.deliveryTermIds.length) e.deliveryTermIds = 'Выберите хотя бы одно условие поставки'
  return e
}
