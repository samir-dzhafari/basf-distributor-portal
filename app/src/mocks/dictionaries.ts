import type {
  BusinessType,
  DeliveryTerm,
  Id,
  PaymentMethod,
  PaymentTerm,
  ProductGroup,
  ProductLine,
  Region,
  VatRate,
} from '@/shared/types/domain'
import { newId } from './db'
import { MockError } from './mock'
import type { Db } from './seed'

export const DICT_KINDS = [
  'productGroup',
  'productLine',
  'vatRate',
  'businessType',
  'region',
  'paymentMethod',
  'paymentTerm',
  'deliveryTerm',
] as const
export type DictKind = (typeof DICT_KINDS)[number]

export interface DictItems {
  productGroup: ProductGroup
  productLine: ProductLine
  vatRate: VatRate
  businessType: BusinessType
  region: Region
  paymentMethod: PaymentMethod
  paymentTerm: PaymentTerm
  deliveryTerm: DeliveryTerm
}

/** Где используется элемент справочника: ключ → количество. Из этого же считается запрет на удаление. */
export type Usage = Record<string, number>

export interface DictionariesData {
  productGroups: ProductGroup[]
  productLines: ProductLine[]
  vatRates: VatRate[]
  businessTypes: BusinessType[]
  regions: Region[]
  paymentMethods: PaymentMethod[]
  paymentTerms: PaymentTerm[]
  deliveryTerms: DeliveryTerm[]
  usage: Record<DictKind, Record<Id, Usage>>
}

const fail = (message: string): never => {
  throw new MockError('validation', message)
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const ISO = /^\d{4}-\d{2}-\d{2}$/

export const USAGE_LABELS: Record<string, string> = {
  products: 'продуктов',
  groups: 'групп продуктов',
  clients: 'клиентов',
  employees: 'сотрудников',
  applications: 'приложений',
  orders: 'заказов',
  businessTypes: 'типов бизнеса',
  paymentTerms: 'условий оплаты',
}

function usageOf(db: Db, kind: DictKind, id: Id): Usage {
  const count = (n: number) => n
  switch (kind) {
    case 'productGroup':
      return { products: count(db.products.filter((p) => p.groupId === id).length) }
    case 'productLine':
      return { products: count(db.products.filter((p) => p.lineId === id).length) }
    case 'vatRate': {
      const rate = db.vatRates.find((v) => v.id === id)?.rate
      return {
        groups: db.productGroups.filter((g) => g.vatRate === rate).length,
        clients: db.clients.filter((c) => c.vatRate === rate).length,
      }
    }
    case 'businessType':
      return {
        clients: db.clients.filter((c) => c.businessTypeIds.includes(id)).length,
        products: db.products.filter((p) => p.businessTypeIds.includes(id)).length,
        applications: db.applications.filter((a) => a.businessTypeId === id).length,
        employees: db.users.filter((u) => u.scope?.businessTypeIds.includes(id)).length,
        orders: db.orders.filter((o) => o.businessTypeId === id).length,
      }
    case 'region':
      return {
        clients: db.clients.filter((c) => c.regionIds.includes(id)).length,
        applications: db.applications.filter((a) => a.regionId === id).length,
        employees: db.users.filter((u) => u.scope?.regionIds.includes(id)).length,
        orders: db.orders.filter((o) => o.regionId === id).length,
      }
    case 'paymentMethod':
      return { paymentTerms: db.paymentTerms.filter((p) => p.methodId === id).length }
    case 'paymentTerm':
      return {
        clients: db.clients.filter((c) => c.paymentTermIds.includes(id)).length,
        businessTypes: db.businessTypes.filter((b) => b.paymentTermIds.includes(id)).length,
        orders: db.orders.filter((o) => o.paymentTermId === id).length,
      }
    case 'deliveryTerm':
      return {
        clients: db.clients.filter((c) => c.deliveryTermIds.includes(id)).length,
        orders: db.orders.filter((o) => o.deliveryTermId === id).length,
      }
  }
}

export function dictionaries(db: Db): DictionariesData {
  const usage = Object.fromEntries(DICT_KINDS.map((k) => [k, {}])) as DictionariesData['usage']
  const collect: Record<DictKind, { id: Id }[]> = {
    productGroup: db.productGroups,
    productLine: db.productLines,
    vatRate: db.vatRates,
    businessType: db.businessTypes,
    region: db.regions,
    paymentMethod: db.paymentMethods,
    paymentTerm: db.paymentTerms,
    deliveryTerm: db.deliveryTerms,
  }
  DICT_KINDS.forEach((k) => collect[k].forEach((x) => (usage[k][x.id] = usageOf(db, k, x.id))))
  return {
    productGroups: db.productGroups,
    productLines: db.productLines,
    vatRates: db.vatRates,
    businessTypes: db.businessTypes,
    regions: db.regions,
    paymentMethods: db.paymentMethods,
    paymentTerms: db.paymentTerms,
    deliveryTerms: db.deliveryTerms,
    usage,
  }
}

const table = (db: Db, kind: DictKind) =>
  ({
    productGroup: db.productGroups,
    productLine: db.productLines,
    vatRate: db.vatRates,
    businessType: db.businessTypes,
    region: db.regions,
    paymentMethod: db.paymentMethods,
    paymentTerm: db.paymentTerms,
    deliveryTerm: db.deliveryTerms,
  })[kind] as { id: Id; name?: string; code?: string }[]

const PREFIX: Record<DictKind, string> = {
  productGroup: 'pg',
  productLine: 'pl',
  vatRate: 'vr',
  businessType: 'bt',
  region: 'rg',
  paymentMethod: 'pm',
  paymentTerm: 'pt',
  deliveryTerm: 'dt',
}

function checkUnique(db: Db, kind: DictKind, item: { id?: Id; name?: string; code?: string }, what: string) {
  const others = table(db, kind).filter((x) => x.id !== item.id)
  if (item.name !== undefined && others.some((x) => x.name && sameText(x.name, item.name!)))
    fail(`${what} с таким названием уже есть`)
  if (item.code !== undefined && others.some((x) => x.code && sameText(x.code, item.code!)))
    fail(`${what} с таким кодом уже есть`)
}

/** Проверка и сохранение элемента справочника. Возвращает id. */
export function saveDictItem<K extends DictKind>(db: Db, kind: K, input: Partial<DictItems[K]> & { id?: Id }): Id {
  const item = input as Record<string, unknown> & { id?: Id }
  const rows = table(db, kind)
  const existing = item.id ? rows.find((x) => x.id === item.id) : undefined
  if (item.id && !existing) throw new MockError('notFound', 'Запись не найдена')
  const str = (k: string) => String(item[k] ?? '').trim()

  switch (kind) {
    case 'productGroup': {
      if (!str('name')) fail('Укажите название группы')
      checkUnique(db, kind, { id: item.id, name: str('name') }, 'Группа')
      if (!db.vatRates.some((v) => v.rate === Number(item.vatRate))) fail('Выберите ставку НДС из справочника')
      break
    }
    case 'productLine':
      if (!str('name')) fail('Укажите название линейки')
      checkUnique(db, kind, { id: item.id, name: str('name') }, 'Линейка')
      break
    case 'vatRate': {
      const rate = Number(item.rate)
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) fail('Ставка — число от 0 до 100')
      if (db.vatRates.some((v) => v.rate === rate && v.id !== item.id)) fail('Такая ставка уже есть')
      const current = existing as VatRate | undefined
      if (current && current.rate !== rate) {
        const u = usageOf(db, 'vatRate', current.id)
        if (u.groups + u.clients > 0) fail('Ставка используется — измените сначала группы продуктов и клиентов')
      }
      break
    }
    case 'businessType': {
      if (!str('name')) fail('Укажите название типа бизнеса')
      checkUnique(db, kind, { id: item.id, name: str('name') }, 'Тип бизнеса')
      if (!ISO.test(str('validFrom'))) fail('Укажите дату начала действия')
      if (str('validTo') && (!ISO.test(str('validTo')) || str('validTo') < str('validFrom')))
        fail('Дата окончания не может быть раньше начала')
      const terms = (item.paymentTermIds as Id[] | undefined) ?? []
      if (!terms.length) fail('Выберите хотя бы одно условие оплаты')
      if (terms.some((t) => !db.paymentTerms.some((p) => p.id === t))) fail('Неизвестное условие оплаты')
      break
    }
    case 'region':
      if (!str('name')) fail('Укажите название региона')
      checkUnique(db, kind, { id: item.id, name: str('name') }, 'Регион')
      break
    case 'paymentMethod':
      if (!str('name')) fail('Укажите название способа оплаты')
      checkUnique(db, kind, { id: item.id, name: str('name') }, 'Способ оплаты')
      break
    case 'paymentTerm':
      if (!str('name')) fail('Укажите название условия оплаты')
      if (!/^[A-Za-z0-9-]{2,10}$/.test(str('code'))) fail('Код для 1С: 2–10 латинских букв, цифр или дефисов')
      checkUnique(db, kind, { id: item.id, name: str('name'), code: str('code') }, 'Условие оплаты')
      if (!db.paymentMethods.some((m) => m.id === item.methodId)) fail('Выберите способ оплаты')
      break
    case 'deliveryTerm':
      if (!str('name')) fail('Укажите название условия поставки')
      if (!/^[A-Za-z0-9-]{2,10}$/.test(str('code'))) fail('Код: 2–10 латинских букв, цифр или дефисов')
      checkUnique(db, kind, { id: item.id, name: str('name'), code: str('code') }, 'Условие поставки')
      break
  }

  // Переименование группы с НДС и прочее — просто запись; чистим строки.
  const clean: Record<string, unknown> = { ...item }
  for (const k of ['name', 'code', 'validFrom', 'validTo'])
    if (typeof clean[k] === 'string') clean[k] = (clean[k] as string).trim()
  if (kind === 'businessType' && !clean.validTo) delete clean.validTo
  if (kind === 'vatRate') clean.rate = Number(clean.rate)
  if (kind === 'productGroup') clean.vatRate = Number(clean.vatRate)

  if (existing) {
    Object.assign(existing, clean)
    return existing.id
  }
  const id = newId(PREFIX[kind])
  ;(rows as unknown[]).push({ ...clean, id })
  return id
}

export function deleteDictItem(db: Db, kind: DictKind, id: Id) {
  const rows = table(db, kind)
  if (!rows.some((x) => x.id === id)) throw new MockError('notFound', 'Запись не найдена')
  const used = Object.entries(usageOf(db, kind, id)).filter(([, n]) => n > 0)
  if (used.length) {
    fail(
      `Удалить нельзя: используется (${used.map(([k, n]) => `${USAGE_LABELS[k] ?? k}: ${n}`).join(', ')}). Отключите или замените значения.`,
    )
  }
  const idx = rows.findIndex((x) => x.id === id)
  rows.splice(idx, 1)
}
