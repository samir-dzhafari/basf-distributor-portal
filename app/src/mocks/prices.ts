import dayjs from 'dayjs'
import type { Id, PriceEntry } from '@/shared/types/domain'
import { newId } from './db'
import type { Db } from './seed'

export type PriceStatus = 'current' | 'scheduled' | 'archive'

/** Текущая цена — запись с самым поздним началом действия среди уже вступивших в силу. */
export function currentEntry(entries: PriceEntry[], today = dayjs().format('YYYY-MM-DD')): PriceEntry | undefined {
  return entries
    .filter((e) => e.validFrom <= today)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom) || b.createdAt.localeCompare(a.createdAt))[0]
}

export function priceStatus(
  entry: PriceEntry,
  entries: PriceEntry[],
  today = dayjs().format('YYYY-MM-DD'),
): PriceStatus {
  if (entry.validFrom > today) return 'scheduled'
  return currentEntry(entries, today)?.id === entry.id ? 'current' : 'archive'
}

/** Выставляет `product.price` по расписанию цен на сегодня. Вызывается при каждом обращении к мок-серверу. */
export function applyPriceSchedule(db: Db, today = dayjs().format('YYYY-MM-DD')): boolean {
  let changed = false
  const byProduct = new Map<Id, PriceEntry[]>()
  db.priceHistory.forEach((e) => byProduct.set(e.productId, [...(byProduct.get(e.productId) ?? []), e]))
  for (const p of db.products) {
    const cur = currentEntry(byProduct.get(p.id) ?? [], today)
    if (cur && cur.price !== p.price) {
      p.price = cur.price
      changed = true
    }
  }
  return changed
}

/** Добавляет цену с датой начала действия; на ту же дату запись заменяется. */
export function addPrice(
  db: Db,
  input: { productId: Id; price: number; validFrom: string; userId: Id; comment?: string },
): PriceEntry {
  db.priceHistory = db.priceHistory.filter((e) => !(e.productId === input.productId && e.validFrom === input.validFrom))
  const entry: PriceEntry = {
    id: newId('pe'),
    productId: input.productId,
    price: input.price,
    validFrom: input.validFrom,
    createdAt: new Date().toISOString(),
    userId: input.userId,
    comment: input.comment?.trim() || undefined,
  }
  db.priceHistory.push(entry)
  applyPriceSchedule(db)
  return entry
}
