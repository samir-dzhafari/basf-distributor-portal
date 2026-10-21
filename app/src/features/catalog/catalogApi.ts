import dayjs from 'dayjs'
import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { currentUser, hasPermission } from '@/mocks/access'
import { newId } from '@/mocks/db'
import {
  analyzeProductsImport,
  applyProductsImport,
  type ProductsImportInput,
  type ProductsPreview,
} from '@/mocks/productsImport'
import { addPrice, priceStatus, type PriceStatus } from '@/mocks/prices'
import type { ImportCounts } from '@/mocks/importTypes'
import type { Db } from '@/mocks/seed'
import { audit, diff, type AuditInput } from '@/mocks/audit'
import { fullName } from '@/shared/lib/format'
import type {
  BusinessType,
  Id,
  PriceEntry,
  Product,
  ProductGroup,
  ProductLine,
  User,
  VatRate,
} from '@/shared/types/domain'

export type ProductStatusFilter = 'all' | 'open' | 'closed'
export type PriceListFilter = 'all' | 'in' | 'out'
export type ProductSort = 'code' | 'name' | 'group' | 'line' | 'packSize' | 'minQty' | 'price'

export interface ProductsQuery {
  q: string
  groupId: Id
  lineId: Id
  businessTypeId: Id
  status: ProductStatusFilter
  priceList: PriceListFilter
  page: number
  pageSize: number
  sortBy: ProductSort
  sortDir: 'asc' | 'desc'
}

export interface ProductRow extends Product {
  groupName: string
  lineName: string
  businessTypeNames: string[]
  vatRate: number
  /** Ближайшая запланированная цена. */
  nextPrice?: { price: number; validFrom: string }
}

export interface ProductsResult {
  rows: ProductRow[]
  total: number
  openCount: number
  closedCount: number
}

export interface ProductRefs {
  groups: ProductGroup[]
  lines: ProductLine[]
  businessTypes: BusinessType[]
  vatRates: VatRate[]
}

export interface ProductInput {
  id?: Id
  code: string
  name: string
  groupId: Id
  lineId: Id
  businessTypeIds: Id[]
  packSize: number
  unit: 'л' | 'кг'
  minQty: number
  multiple: number
  inPriceList: boolean
  /** Только для нового продукта: первая цена. */
  price?: number
}

export interface MassPatch {
  ids: Id[]
  closed?: boolean
  groupId?: Id
  lineId?: Id
  inPriceList?: boolean
  businessTypeIds?: Id[]
  businessMode?: 'replace' | 'add'
}

export interface PriceHistory {
  product: { id: Id; code: string; name: string; price: number }
  entries: (PriceEntry & { status: PriceStatus; userName: string })[]
}

// ---------------------------------------------------------------------------------------------

const rec = (db: Db, qa: { getState: () => unknown }, input: AuditInput) => audit(db, currentUser(db, qa), input)
const PRODUCT_LABELS = {
  code: 'Код 1С',
  name: 'Наименование',
  groupId: 'Группа',
  lineId: 'Линейка',
  businessTypeIds: 'Типы бизнеса',
  packSize: 'Объём упаковки',
  unit: 'Единица',
  minQty: 'Мин. объём',
  multiple: 'Кратность',
  inPriceList: 'В прайс-листе',
}

function manager(db: Db, user: User) {
  if (!hasPermission(db, user, 'products.manage')) throw new MockError('forbidden', 'Каталог продуктов вам недоступен')
}

const fail = (message: string): never => {
  throw new MockError('validation', message)
}

export function validateProduct(db: Db, v: ProductInput) {
  if (!/^[\p{L}\d-]{3,15}$/u.test(v.code.trim())) fail('Код 1С: 3–15 букв, цифр или дефисов, без пробелов')
  if (db.products.some((p) => p.code === v.code.trim() && p.id !== v.id)) fail('Продукт с таким кодом 1С уже есть')
  if (!v.name.trim()) fail('Укажите наименование')
  if (!db.productGroups.some((g) => g.id === v.groupId)) fail('Выберите группу продуктов')
  if (!db.productLines.some((l) => l.id === v.lineId)) fail('Выберите линейку')
  if (!v.businessTypeIds.length || v.businessTypeIds.some((id) => !db.businessTypes.some((b) => b.id === id)))
    fail('Выберите типы бизнеса')
  if (!(v.packSize > 0)) fail('Объём упаковки — положительное число')
  if (v.unit !== 'л' && v.unit !== 'кг') fail('Единица измерения: л или кг')
  if (!(v.multiple > 0)) fail('Кратность — положительное число')
  if (!(v.minQty > 0)) fail('Минимальный объём — положительное число')
  if (v.minQty % v.multiple !== 0) fail('Минимальный объём должен быть кратен кратности')
}

const SORTERS: Record<ProductSort, (a: ProductRow, b: ProductRow) => number> = {
  code: (a, b) => a.code.localeCompare(b.code, 'ru', { numeric: true }),
  name: (a, b) => a.name.localeCompare(b.name, 'ru'),
  group: (a, b) => a.groupName.localeCompare(b.groupName, 'ru'),
  line: (a, b) => a.lineName.localeCompare(b.lineName, 'ru'),
  packSize: (a, b) => a.packSize - b.packSize,
  minQty: (a, b) => a.minQty - b.minQty,
  price: (a, b) => a.price - b.price,
}

const tags = ['Product' as const]

export const catalogApi = api.injectEndpoints({
  endpoints: (b) => ({
    getProductRefs: b.query<ProductRefs, void>({
      queryFn: (_a, qa) =>
        mock((db) => {
          manager(db, currentUser(db, qa))
          return {
            groups: db.productGroups,
            lines: db.productLines,
            businessTypes: db.businessTypes,
            vatRates: db.vatRates,
          }
        }),
      providesTags: ['Dictionary'],
    }),

    listProducts: b.query<ProductsResult, ProductsQuery>({
      queryFn: (q, qa) =>
        mock((db) => {
          manager(db, currentUser(db, qa))
          const today = dayjs().format('YYYY-MM-DD')
          const all = db.products.map<ProductRow>((p) => {
            const next = db.priceHistory
              .filter((e) => e.productId === p.id && e.validFrom > today)
              .sort((a, b2) => a.validFrom.localeCompare(b2.validFrom))[0]
            const group = db.productGroups.find((g) => g.id === p.groupId)
            return {
              ...p,
              groupName: group?.name ?? '—',
              lineName: db.productLines.find((l) => l.id === p.lineId)?.name ?? '—',
              businessTypeNames: p.businessTypeIds.map((id) => db.businessTypes.find((x) => x.id === id)?.name ?? '—'),
              vatRate: group?.vatRate ?? 0,
              nextPrice: next && { price: next.price, validFrom: next.validFrom },
            }
          })
          const s = q.q.trim().toLowerCase()
          const rows = all
            .filter((p) => !s || p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s))
            .filter((p) => !q.groupId || p.groupId === q.groupId)
            .filter((p) => !q.lineId || p.lineId === q.lineId)
            .filter((p) => !q.businessTypeId || p.businessTypeIds.includes(q.businessTypeId))
            .filter((p) => (q.status === 'all' ? true : q.status === 'open' ? !p.closed : p.closed))
            .filter((p) => (q.priceList === 'all' ? true : q.priceList === 'in' ? p.inPriceList : !p.inPriceList))
          const sign = q.sortDir === 'asc' ? 1 : -1
          rows.sort((a, b2) => sign * SORTERS[q.sortBy](a, b2) || a.name.localeCompare(b2.name, 'ru'))
          const start = (q.page - 1) * q.pageSize
          return {
            rows: rows.slice(start, start + q.pageSize),
            total: rows.length,
            openCount: all.filter((p) => !p.closed).length,
            closedCount: all.filter((p) => p.closed).length,
          }
        }),
      providesTags: tags,
    }),

    saveProduct: b.mutation<{ id: Id }, ProductInput>({
      queryFn: (input, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            manager(db, user)
            const v: ProductInput = { ...input, code: input.code.trim(), name: input.name.trim() }
            validateProduct(db, v)
            const existing = v.id ? db.products.find((p) => p.id === v.id) : undefined
            if (v.id && !existing) throw new MockError('notFound', 'Продукт не найден')
            const fields = {
              code: v.code,
              name: v.name,
              groupId: v.groupId,
              lineId: v.lineId,
              businessTypeIds: v.businessTypeIds,
              packSize: v.packSize,
              unit: v.unit,
              minQty: v.minQty,
              multiple: v.multiple,
              inPriceList: v.inPriceList,
            }
            if (existing) {
              const changes = diff(existing, fields, PRODUCT_LABELS, {
                groupId: (x) => db.productGroups.find((g) => g.id === x)?.name ?? String(x),
                lineId: (x) => db.productLines.find((g) => g.id === x)?.name ?? String(x),
                businessTypeIds: (x) =>
                  (x as string[]).map((id) => db.businessTypes.find((b) => b.id === id)?.name ?? id).join(', '),
              })
              Object.assign(existing, fields)
              if (changes.length)
                rec(db, qa, {
                  entity: 'product',
                  entityId: existing.id,
                  entityName: v.name,
                  action: 'Изменён',
                  changes,
                })
              return { id: existing.id }
            }
            if (!(v.price && v.price > 0)) fail('Укажите цену — она попадёт в прайс-лист')
            const product: Product = { ...fields, id: newId('pr'), closed: false, price: v.price! }
            db.products.push(product)
            addPrice(db, {
              productId: product.id,
              price: v.price!,
              validFrom: dayjs().format('YYYY-MM-DD'),
              userId: user.id,
              comment: 'Первая цена',
            })
            rec(db, qa, {
              entity: 'product',
              entityId: product.id,
              entityName: product.name,
              action: 'Создан',
              summary: `Цена: ${v.price} ₽`,
            })
            return { id: product.id }
          },
          { write: true },
        ),
      invalidatesTags: tags,
    }),

    /** Массовые операции: закрыть/открыть, группа, линейка, типы бизнеса, прайс-лист. Продукты не удаляются никогда. */
    massUpdateProducts: b.mutation<{ updated: number }, MassPatch>({
      queryFn: (patch, qa) =>
        mock(
          (db) => {
            manager(db, currentUser(db, qa))
            if (!patch.ids.length) fail('Отметьте продукты')
            if (patch.groupId && !db.productGroups.some((g) => g.id === patch.groupId)) fail('Группа не найдена')
            if (patch.lineId && !db.productLines.some((l) => l.id === patch.lineId)) fail('Линейка не найдена')
            if (
              patch.businessTypeIds &&
              (!patch.businessTypeIds.length ||
                patch.businessTypeIds.some((id) => !db.businessTypes.some((x) => x.id === id)))
            ) {
              fail('Выберите типы бизнеса')
            }
            const items = db.products.filter((p) => patch.ids.includes(p.id))
            items.forEach((p) => {
              if (patch.closed !== undefined) p.closed = patch.closed
              if (patch.groupId) p.groupId = patch.groupId
              if (patch.lineId) p.lineId = patch.lineId
              if (patch.inPriceList !== undefined) p.inPriceList = patch.inPriceList
              if (patch.businessTypeIds) {
                p.businessTypeIds =
                  patch.businessMode === 'add'
                    ? [...new Set([...p.businessTypeIds, ...patch.businessTypeIds])]
                    : [...patch.businessTypeIds]
              }
            })
            rec(db, qa, {
              entity: 'product',
              entityName: `Продуктов: ${items.length}`,
              action: 'Массовое изменение',
              summary: [
                patch.closed !== undefined && (patch.closed ? 'закрыты' : 'открыты'),
                patch.groupId && 'новая группа',
                patch.lineId && 'новая линейка',
                patch.businessTypeIds && 'типы бизнеса',
                patch.inPriceList !== undefined && (patch.inPriceList ? 'в прайс-лист' : 'из прайс-листа'),
              ]
                .filter(Boolean)
                .join(', '),
            })
            return { updated: items.length }
          },
          { write: true },
        ),
      invalidatesTags: tags,
    }),

    getPriceHistory: b.query<PriceHistory, Id>({
      queryFn: (id, qa) =>
        mock((db) => {
          manager(db, currentUser(db, qa))
          const p = db.products.find((x) => x.id === id)
          if (!p) throw new MockError('notFound', 'Продукт не найден')
          const all = db.priceHistory.filter((e) => e.productId === id)
          const entries = [...all]
            .sort((a, b2) => b2.validFrom.localeCompare(a.validFrom) || b2.createdAt.localeCompare(a.createdAt))
            .map((e) => ({
              ...e,
              status: priceStatus(e, all),
              userName: fullName(db.users.find((u) => u.id === e.userId)),
            }))
          return { product: { id: p.id, code: p.code, name: p.name, price: p.price }, entries }
        }),
      providesTags: (_r, _e, id) => [{ type: 'Product', id }],
    }),

    addProductPrice: b.mutation<void, { productId: Id; price: number; validFrom: string; comment?: string }>({
      queryFn: ({ productId, price, validFrom, comment }, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            manager(db, user)
            if (!db.products.some((p) => p.id === productId)) throw new MockError('notFound', 'Продукт не найден')
            if (!(price > 0)) fail('Цена — положительное число')
            if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) fail('Укажите дату начала действия')
            addPrice(db, { productId, price, validFrom, userId: user.id, comment })
            rec(db, qa, {
              entity: 'price',
              entityId: productId,
              entityName: db.products.find((p) => p.id === productId)?.name ?? '',
              action: 'Добавлена цена',
              summary: ` ₽ с ${validFrom}`,
            })
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, a) => [...tags, { type: 'Product', id: a.productId }],
    }),

    /** Отменить можно только запланированную цену: история уже действовавших цен не переписывается. */
    deletePriceEntry: b.mutation<void, { productId: Id; entryId: Id }>({
      queryFn: ({ productId, entryId }, qa) =>
        mock(
          (db) => {
            manager(db, currentUser(db, qa))
            const e = db.priceHistory.find((x) => x.id === entryId && x.productId === productId)
            if (!e) throw new MockError('notFound', 'Запись не найдена')
            if (e.validFrom <= dayjs().format('YYYY-MM-DD')) fail('Эта цена уже действовала — историю менять нельзя')
            db.priceHistory = db.priceHistory.filter((x) => x.id !== entryId)
            rec(db, qa, {
              entity: 'price',
              entityId: productId,
              entityName: db.products.find((p) => p.id === productId)?.name ?? '',
              action: 'Отменена запланированная цена',
              summary: ` ₽ с ${e.validFrom}`,
            })
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, a) => [...tags, { type: 'Product', id: a.productId }],
    }),

    previewProductsImport: b.mutation<ProductsPreview, ProductsImportInput>({
      queryFn: (input, qa) =>
        mock((db) => {
          manager(db, currentUser(db, qa))
          return analyzeProductsImport(db, input).preview
        }),
    }),

    applyProductsImport: b.mutation<ImportCounts, ProductsImportInput>({
      queryFn: (input, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            manager(db, user)
            const result = applyProductsImport(db, input, user.id)
            rec(db, qa, {
              entity: 'import',
              entityName: 'Продукты и цены',
              action: 'Импорт из Excel',
              summary: `Создано: ${result.new}, обновлено: ${result.update}, с ошибками: ${result.error}`,
            })
            return result
          },
          { write: true },
        ),
      invalidatesTags: [...tags, 'Order', 'Client'],
    }),
  }),
})

export const {
  useGetProductRefsQuery,
  useListProductsQuery,
  useSaveProductMutation,
  useMassUpdateProductsMutation,
  useGetPriceHistoryQuery,
  useAddProductPriceMutation,
  useDeletePriceEntryMutation,
  usePreviewProductsImportMutation,
  useApplyProductsImportMutation,
} = catalogApi
