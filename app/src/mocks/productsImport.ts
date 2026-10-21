import dayjs from 'dayjs'
import type { Id, Product } from '@/shared/types/domain'
import { currentEntry, addPrice } from './prices'
import { newId } from './db'
import {
  countLines,
  norm,
  yes,
  type ImportCounts,
  type ImportIssue,
  type ImportLine,
  type ImportPreview,
  type ImportRow,
} from './importTypes'
import type { Db } from './seed'

export const PRODUCTS_SHEET = 'Продукты'
export const PRODUCT_HEADERS = [
  'Код 1С',
  'Наименование',
  'Группа',
  'Линейка',
  'Типы бизнеса',
  'Объём упаковки',
  'Ед. изм.',
  'Мин. объём',
  'Кратность',
  'В прайс-листе',
  'Цена без НДС',
  'Действует с',
] as const

export type ProductsImportInput = { products: ImportRow[] }
export type ProductsPreview = ImportPreview<'products'>

interface PlanItem {
  row: number
  data: Omit<Product, 'id' | 'closed'> & { closed?: boolean }
  existingId?: Id
  price?: number
  validFrom: string
}

const num = (v: string) => Number(v.replace(/\s/g, '').replace(',', '.'))

/** Дата: 2026-11-01 или 01.11.2026. Пустая — «с сегодняшнего дня». */
export function parseDate(v: string): string | null {
  if (!v) return dayjs().format('YYYY-MM-DD')
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  const ru = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v)
  const s = iso ? v : ru ? `${ru[3]}-${ru[2]}-${ru[1]}` : ''
  return s && dayjs(s).isValid() ? s : null
}

const money = (n: number) => new Intl.NumberFormat('ru-RU').format(n)

/** Проверка файла: ничего не меняет, показывает новые и изменяемые позиции, цены «было → станет» и ошибки по строкам. */
export function analyzeProductsImport(
  db: Db,
  input: ProductsImportInput,
): { preview: ProductsPreview; plan: PlanItem[] } {
  const issues: ImportIssue<'products'>[] = []
  const lines: Record<'products', ImportLine[]> = { products: [] }
  const plan: PlanItem[] = []
  const byName = <T extends { id: Id; name: string }>(list: T[], name: string) =>
    list.find((x) => x.name.toLowerCase() === name.toLowerCase())
  const seen = new Set<string>()

  input.products.forEach((r, i) => {
    const row = i + 2
    const code = norm(r['Код 1С'])
    const name = norm(r['Наименование'])
    const e: string[] = []
    if (!/^[\p{L}\d-]{3,15}$/u.test(code)) e.push('Код 1С: 3–15 букв, цифр или дефисов')
    else if (seen.has(code)) e.push(`Код ${code} повторяется в файле`)
    seen.add(code)
    if (!name) e.push('Не указано наименование')
    const group = byName(db.productGroups, norm(r['Группа']))
    if (!group) e.push(`Неизвестная группа «${norm(r['Группа'])}»`)
    const line = byName(db.productLines, norm(r['Линейка']))
    if (!line) e.push(`Неизвестная линейка «${norm(r['Линейка'])}»`)
    const btNames = norm(r['Типы бизнеса'])
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const bts = btNames.map((n) => byName(db.businessTypes, n))
    if (!btNames.length) e.push('Не указан тип бизнеса')
    btNames.forEach((n, k) => !bts[k] && e.push(`Неизвестный тип бизнеса «${n}»`))
    const pack = num(norm(r['Объём упаковки']))
    if (!(pack > 0)) e.push('Объём упаковки — положительное число')
    const unit = norm(r['Ед. изм.']).toLowerCase()
    if (unit !== 'л' && unit !== 'кг') e.push('Единица измерения: л или кг')
    const multiple = norm(r['Кратность']) ? num(norm(r['Кратность'])) : pack
    const minQty = norm(r['Мин. объём']) ? num(norm(r['Мин. объём'])) : pack
    if (!(multiple > 0)) e.push('Кратность — положительное число')
    if (!(minQty > 0)) e.push('Минимальный объём — положительное число')
    else if (multiple > 0 && minQty % multiple !== 0) e.push('Минимальный объём должен быть кратен кратности')
    const priceText = norm(r['Цена без НДС'])
    const price = priceText ? num(priceText) : undefined
    if (price !== undefined && !(price > 0)) e.push('Цена — положительное число')
    const validFrom = parseDate(norm(r['Действует с']))
    if (!validFrom) e.push('Дата «Действует с»: ДД.ММ.ГГГГ')
    const existing = db.products.find((p) => p.code === code)
    if (!existing && price === undefined) e.push('Для нового продукта нужна цена')

    if (e.length) {
      e.forEach((message) => issues.push({ sheet: 'products', row, message }))
      lines.products.push({ row, title: `${code || '—'} ${name}`, action: 'error' })
      return
    }

    const data = {
      code,
      name,
      groupId: group!.id,
      lineId: line!.id,
      businessTypeIds: bts.map((b) => b!.id),
      packSize: pack,
      unit: unit as 'л' | 'кг',
      minQty,
      multiple,
      price: existing?.price ?? price!,
      inPriceList: norm(r['В прайс-листе']) ? yes(norm(r['В прайс-листе'])) : (existing?.inPriceList ?? true),
    }
    const changes: string[] = []
    if (existing) {
      const was = currentEntry(db.priceHistory.filter((h) => h.productId === existing.id))?.price ?? existing.price
      if (price !== undefined && price !== was)
        changes.push(`Цена: ${money(was)} → ${money(price)} с ${dayjs(validFrom!).format('DD.MM.YYYY')}`)
      if (existing.name !== name) changes.push('Наименование')
      if (existing.groupId !== data.groupId || existing.lineId !== data.lineId) changes.push('Группа/линейка')
      if (existing.packSize !== pack || existing.minQty !== minQty || existing.multiple !== multiple)
        changes.push('Упаковка')
      if (existing.inPriceList !== data.inPriceList) changes.push(data.inPriceList ? 'В прайс-лист' : 'Из прайс-листа')
      if (JSON.stringify([...existing.businessTypeIds].sort()) !== JSON.stringify([...data.businessTypeIds].sort()))
        changes.push('Типы бизнеса')
    }
    plan.push({ row, data, existingId: existing?.id, price, validFrom: validFrom! })
    lines.products.push({
      row,
      title: `${code} · ${name}`,
      action: existing ? 'update' : 'new',
      detail: existing
        ? changes.length
          ? changes.join('; ')
          : 'Без изменений'
        : price !== undefined
          ? `Цена: ${money(price)}`
          : undefined,
    })
  })
  return { preview: { lines, issues, counts: countLines(lines) }, plan }
}

export function applyProductsImport(db: Db, input: ProductsImportInput, userId: Id): ImportCounts {
  const { preview, plan } = analyzeProductsImport(db, input)
  for (const item of plan) {
    const { price, validFrom, existingId } = item
    let product: Product | undefined = existingId ? db.products.find((p) => p.id === existingId) : undefined
    if (product) Object.assign(product, { ...item.data, price: product.price })
    else {
      product = { ...item.data, id: newId('pr'), closed: false } as Product
      db.products.push(product)
    }
    if (price !== undefined) {
      const was = currentEntry(db.priceHistory.filter((h) => h.productId === product!.id))
      if (!was || was.price !== price || was.validFrom !== validFrom) {
        addPrice(db, { productId: product.id, price, validFrom, userId, comment: 'Импорт из Excel' })
      }
    }
  }
  return preview.counts
}
