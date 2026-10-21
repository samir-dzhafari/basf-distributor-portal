import dayjs from 'dayjs'
import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '@/app/api'
import { store } from '@/app/store'
import { authApi } from '@/features/auth/authApi'
import { logout } from '@/features/auth/authSlice'
import { getDb, resetDb } from '@/mocks/db'
import { analyzeApplicationsImport } from '@/mocks/applicationsImport'
import { applyPriceSchedule } from '@/mocks/prices'
import { analyzeProductsImport, applyProductsImport } from '@/mocks/productsImport'
import { applicationsApi, type ApplicationsResult, type ApplicationsQuery } from '../applications/applicationsApi'
import { dictionariesApi } from '../dictionaries/dictionariesApi'
import { catalogApi, type PriceHistory, type ProductInput, type ProductsQuery, type ProductsResult } from './catalogApi'

type Result<T> = { data?: T; error?: { code: string; message: string } }
const call = <T = void>(thunk: unknown) => (store.dispatch as (a: unknown) => Promise<Result<T>>)(thunk)
const as = async (id: string) => {
  store.dispatch(logout())
  store.dispatch(api.util.resetApiState())
  await store.dispatch(authApi.endpoints.demoLogin.initiate(id))
}

const pq: ProductsQuery = {
  q: '',
  groupId: '',
  lineId: '',
  businessTypeId: '',
  status: 'all',
  priceList: 'all',
  page: 1,
  pageSize: 100,
  sortBy: 'name',
  sortDir: 'asc',
}
const products = (patch: Partial<ProductsQuery> = {}) =>
  call<ProductsResult>(catalogApi.endpoints.listProducts.initiate({ ...pq, ...patch }, { forceRefetch: true }))
const aq: ApplicationsQuery = {
  q: '',
  clientId: '',
  regionId: '',
  businessTypeId: '',
  responsibleId: '',
  status: 'all',
  page: 1,
  pageSize: 100,
  sortBy: 'number',
  sortDir: 'asc',
}
const apps = (patch: Partial<ApplicationsQuery> = {}) =>
  call<ApplicationsResult>(
    applicationsApi.endpoints.listApplications.initiate({ ...aq, ...patch }, { forceRefetch: true }),
  )

const newProduct: ProductInput = {
  code: 'NP-0001',
  name: 'Тест Плюс 10 л',
  groupId: 'pg-fung',
  lineId: 'pl-cereal',
  businessTypeIds: ['bt-regular'],
  packSize: 10,
  unit: 'л',
  minQty: 20,
  multiple: 10,
  inPriceList: true,
  price: 1500,
}

beforeEach(() => {
  resetDb()
  store.dispatch(logout())
  store.dispatch(api.util.resetApiState())
})

describe('продукты', () => {
  it('доступны только с правом; фильтры, поиск и сортировка', async () => {
    await as('u-mgr1')
    expect((await products()).error?.code).toBe('forbidden')
    await as('u-admin')
    const all = (await products()).data!
    expect(all.total).toBe(40)
    expect(all.openCount + all.closedCount).toBe(40)
    expect((await products({ q: 'кунулус' })).data!.rows.map((r) => r.name)).toEqual(['Кунулус 25 кг'])
    expect((await products({ status: 'closed' })).data!.rows.every((r) => r.closed)).toBe(true)
    expect((await products({ priceList: 'out' })).data!.rows.every((r) => !r.inPriceList)).toBe(true)
    expect((await products({ groupId: 'pg-seeds' })).data!.total).toBe(5)
    const byPrice = (await products({ sortBy: 'price', sortDir: 'desc' })).data!.rows
    expect(byPrice[0].price).toBeGreaterThanOrEqual(byPrice[1].price)
  })

  it('создание: проверки кода, упаковки, типов бизнеса; первая цена попадает в историю', async () => {
    await as('u-admin')
    const save = (v: Partial<ProductInput>) =>
      call<{ id: string }>(catalogApi.endpoints.saveProduct.initiate({ ...newProduct, ...v }))
    expect((await save({ code: 'x' })).error?.code).toBe('validation')
    expect((await save({ code: getDb().products[0].code })).error?.message).toMatch(/уже есть/)
    expect((await save({ minQty: 15 })).error?.message).toMatch(/кратен/)
    expect((await save({ businessTypeIds: [] })).error?.code).toBe('validation')
    expect((await save({ price: undefined })).error?.message).toMatch(/цену/)
    const ok = await save({})
    const h = (
      await call<PriceHistory>(catalogApi.endpoints.getPriceHistory.initiate(ok.data!.id, { forceRefetch: true }))
    ).data!
    expect(h.entries).toHaveLength(1)
    expect(h.entries[0]).toMatchObject({ price: 1500, status: 'current' })
    expect(getDb().products.find((p) => p.id === ok.data!.id)!.price).toBe(1500)
  })

  it('закрытие вместо удаления: массовые операции и закрытая позиция не попадает в заказ', async () => {
    await as('u-admin')
    const ids = getDb()
      .products.slice(0, 3)
      .map((p) => p.id)
    await call(catalogApi.endpoints.massUpdateProducts.initiate({ ids, closed: true }))
    expect(
      getDb()
        .products.slice(0, 3)
        .every((p) => p.closed),
    ).toBe(true)
    expect(getDb().products).toHaveLength(40) // ничего не удалено
    await call(
      catalogApi.endpoints.massUpdateProducts.initiate({
        ids,
        closed: false,
        groupId: 'pg-ins',
        businessTypeIds: ['bt-szr'],
        businessMode: 'add',
      }),
    )
    const p = getDb().products[0]
    expect(p).toMatchObject({ closed: false, groupId: 'pg-ins' })
    expect(p.businessTypeIds).toContain('bt-szr')
    expect((await call(catalogApi.endpoints.massUpdateProducts.initiate({ ids: [], closed: true }))).error?.code).toBe(
      'validation',
    )
  })

  it('цены: запланированная вступает в силу в свою дату, историю уже действовавших цен менять нельзя', async () => {
    await as('u-admin')
    const p = getDb().products[1]
    const base = p.price
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')
    await call(
      catalogApi.endpoints.addProductPrice.initiate({
        productId: p.id,
        price: base + 100,
        validFrom: tomorrow,
        comment: 'Повышение',
      }),
    )
    expect(getDb().products[1].price).toBe(base) // пока действует старая
    const h = (await call<PriceHistory>(catalogApi.endpoints.getPriceHistory.initiate(p.id, { forceRefetch: true })))
      .data!
    expect(h.entries[0]).toMatchObject({ status: 'scheduled', price: base + 100 })
    expect(h.entries.find((e) => e.status === 'current')!.price).toBe(base)
    applyPriceSchedule(getDb(), dayjs().add(2, 'day').format('YYYY-MM-DD'))
    expect(getDb().products[1].price).toBe(base + 100)

    const past = h.entries.find((e) => e.status === 'archive')!
    expect(
      (await call(catalogApi.endpoints.deletePriceEntry.initiate({ productId: p.id, entryId: past.id }))).error
        ?.message,
    ).toMatch(/уже действовала/)
    expect(
      (await call(catalogApi.endpoints.deletePriceEntry.initiate({ productId: p.id, entryId: h.entries[0].id }))).error,
    ).toBeUndefined()
    expect(
      (await call(catalogApi.endpoints.addProductPrice.initiate({ productId: p.id, price: 0, validFrom: tomorrow })))
        .error?.code,
    ).toBe('validation')
  })

  it('импорт: предпросмотр с ценами «было → станет», ошибки по строкам, применение', () => {
    const db = getDb()
    const existing = db.products[0]
    const input = {
      products: [
        {
          'Код 1С': existing.code,
          Наименование: existing.name,
          Группа: 'Фунгициды',
          Линейка: 'Овощи и картофель',
          'Типы бизнеса': 'Регулярный, СЗР',
          'Объём упаковки': '25',
          'Ед. изм.': 'кг',
          'Мин. объём': '25',
          Кратность: '25',
          'В прайс-листе': 'Да',
          'Цена без НДС': '800',
          'Действует с': '01.12.2099',
        },
        {
          'Код 1С': 'IMPORT-1',
          Наименование: 'Новинка 5 л',
          Группа: 'Гербициды',
          Линейка: 'Зерновые',
          'Типы бизнеса': 'Регулярный',
          'Объём упаковки': '5',
          'Ед. изм.': 'л',
          'Мин. объём': '',
          Кратность: '',
          'В прайс-листе': '',
          'Цена без НДС': '2 500,50',
          'Действует с': '',
        },
        {
          'Код 1С': 'BAD',
          Наименование: '',
          Группа: 'Марс',
          Линейка: 'Зерновые',
          'Типы бизнеса': 'Регулярный',
          'Объём упаковки': '-1',
          'Ед. изм.': 'шт',
          'Мин. объём': '',
          Кратность: '',
          'В прайс-листе': '',
          'Цена без НДС': '',
          'Действует с': '2026-13-45',
        },
        {
          'Код 1С': 'IMPORT-1',
          Наименование: 'Дубль',
          Группа: 'Гербициды',
          Линейка: 'Зерновые',
          'Типы бизнеса': 'Регулярный',
          'Объём упаковки': '5',
          'Ед. изм.': 'л',
          'Мин. объём': '',
          Кратность: '',
          'В прайс-листе': '',
          'Цена без НДС': '1',
          'Действует с': '',
        },
      ],
    }
    const { preview } = analyzeProductsImport(db, input)
    expect(preview.counts).toEqual({ new: 1, update: 1, error: 2 })
    expect(preview.lines.products[0].detail).toMatch(/Цена: .* → 800 с 01\.12\.2099/)
    expect(preview.issues.some((i) => i.row === 4 && /Неизвестная группа/.test(i.message))).toBe(true)
    expect(preview.issues.some((i) => i.row === 5 && /повторяется/.test(i.message))).toBe(true)

    const before = db.products.length
    applyProductsImport(db, input, 'u-admin')
    expect(db.products).toHaveLength(before + 1)
    const created = db.products.find((p) => p.code === 'IMPORT-1')!
    expect(created).toMatchObject({ price: 2500.5, minQty: 5, multiple: 5, inPriceList: true })
    expect(
      db.priceHistory.some((e) => e.productId === existing.id && e.validFrom === '2099-12-01' && e.price === 800),
    ).toBe(true)
    expect(db.products[0].price).toBe(existing.price) // будущая цена ещё не действует
  })
})

describe('справочники', () => {
  const save = (kind: string, item: Record<string, unknown>) =>
    call<{ id: string }>(dictionariesApi.endpoints.saveDictionaryItem.initiate({ kind, item } as never))
  const remove = (kind: string, id: string) =>
    call(dictionariesApi.endpoints.deleteDictionaryItem.initiate({ kind, id } as never))

  it('доступны только с правом; в ответе есть счётчики использования', async () => {
    await as('u-head')
    expect(
      (await call(dictionariesApi.endpoints.getDictionaries.initiate(undefined, { forceRefetch: true }))).error?.code,
    ).toBe('forbidden')
    await as('u-admin')
    const d = (
      await call<import('@/mocks/dictionaries').DictionariesData>(
        dictionariesApi.endpoints.getDictionaries.initiate(undefined, { forceRefetch: true }),
      )
    ).data!
    expect(d.usage.productGroup['pg-fung'].products).toBeGreaterThan(0)
    expect(d.usage.region['rg-far'].clients).toBeGreaterThan(0)
    expect(d.usage.businessType['bt-regular'].employees).toBeGreaterThan(0)
  })

  it('создание, уникальность и проверки полей', async () => {
    await as('u-admin')
    expect((await save('region', { name: ' юг ' })).error?.message).toMatch(/уже есть/)
    expect((await save('region', { name: 'Поволжье' })).data!.id).toBeTruthy()
    expect((await save('vatRate', { rate: 22 })).error?.message).toMatch(/уже есть/)
    expect((await save('vatRate', { rate: 150 })).error?.code).toBe('validation')
    expect((await save('productGroup', { name: 'Новая', vatRate: 13 })).error?.message).toMatch(/справочника/)
    expect((await save('paymentTerm', { code: 'ф!', name: 'X', methodId: 'pm-invoice' })).error?.code).toBe(
      'validation',
    )
    expect(
      (await save('paymentTerm', { code: 'GO20', name: 'Отсрочка 90 дней', methodId: 'pm-invoice' })).data!.id,
    ).toBeTruthy()
    expect(
      (
        await save('businessType', {
          name: 'Новый',
          validFrom: '2026-01-01',
          validTo: '2025-01-01',
          paymentTermIds: ['pt-prepay'],
        })
      ).error?.message,
    ).toMatch(/раньше/)
    expect((await save('deliveryTerm', { code: 'DLV', name: 'Другая' })).error?.message).toMatch(/кодом/)
  })

  it('используемое удалить нельзя, неиспользуемое — можно; ставку НДС в использовании менять нельзя', async () => {
    await as('u-admin')
    expect((await remove('productGroup', 'pg-fung')).error?.message).toMatch(/продуктов/)
    expect((await remove('region', 'rg-far')).error?.message).toMatch(/клиентов/)
    expect((await save('vatRate', { id: 'vr-22', rate: 20 })).error?.message).toMatch(/используется/)
    const id = (await save('productLine', { name: 'Пустая' })).data!.id
    expect((await remove('productLine', id)).error).toBeUndefined()
    expect(getDb().productLines.some((l) => l.id === id)).toBe(false)
  })

  it('переименование группы продуктов с новой ставкой НДС меняет НДС в расчётах продуктов', async () => {
    await as('u-admin')
    await save('vatRate', { rate: 20 })
    await save('productGroup', { id: 'pg-ins', name: 'Инсектициды', vatRate: 20 })
    expect(getDb().productGroups.find((g) => g.id === 'pg-ins')!.vatRate).toBe(20)
    const rows = (await products({ groupId: 'pg-ins' })).data!.rows
    expect(rows.every((r) => r.vatRate === 20)).toBe(true)
  })
})

describe('приложения', () => {
  const base = () => {
    const c = getDb().clients.find((x) => x.id === 'cl-1')!
    return {
      number: 'TEST-1',
      clientId: c.id,
      regionId: c.regionIds[0],
      businessTypeId: c.businessTypeIds[0],
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
      responsibleIds: ['u-app1'],
      active: true,
    }
  }

  it('руководителю региона видны приложения его клиентов; менеджер без права — ничего', async () => {
    await as('u-mgr1')
    expect((await apps()).error?.code).toBe('forbidden')
    await as('u-head')
    const r = (await apps()).data!
    expect(r.total).toBeGreaterThan(0)
    expect(r.total).toBeLessThan(getDb().applications.length)
    await as('u-admin')
    expect((await apps()).data!.total).toBe(getDb().applications.length)
  })

  it('фильтры по состоянию, клиенту и ответственному; состояние считается по периоду', async () => {
    await as('u-admin')
    const a = getDb().applications[0]
    a.validTo = '2020-01-01'
    expect((await apps({ status: 'expired' })).data!.rows.map((x) => x.id)).toContain(a.id)
    a.active = false
    expect((await apps({ status: 'inactive' })).data!.rows.map((x) => x.id)).toContain(a.id)
    expect((await apps({ clientId: 'cl-1' })).data!.rows.every((x) => x.clientId === 'cl-1')).toBe(true)
    expect((await apps({ responsibleId: 'u-app2' })).data!.rows.every((x) => x.responsibleIds.includes('u-app2'))).toBe(
      true,
    )
  })

  it('создание: номер уникален, регион и тип бизнеса — из условий клиента, период корректен, ответственные — сотрудники', async () => {
    await as('u-admin')
    const save = (patch: object) =>
      call<{ id: string }>(applicationsApi.endpoints.saveApplication.initiate({ ...base(), ...patch }))
    expect((await save({})).data!.id).toBeTruthy()
    expect((await save({})).error?.message).toMatch(/уже есть/)
    expect((await save({ number: 'T2', regionId: 'rg-north' })).error?.message).toMatch(/Регион/)
    expect((await save({ number: 'T3', businessTypeId: 'bt-seeds' })).error?.message).toMatch(/Тип бизнеса/)
    expect((await save({ number: 'T4', validTo: '2025-01-01' })).error?.message).toMatch(/раньше/)
    expect((await save({ number: 'T5', responsibleIds: ['c-1a'] })).error?.message).toMatch(/сотрудники/)
  })

  it('массово: добавить ответственного и выключить', async () => {
    await as('u-admin')
    const ids = getDb()
      .applications.slice(0, 3)
      .map((a) => a.id)
    await call(
      applicationsApi.endpoints.massUpdateApplications.initiate({ ids, addResponsibleIds: ['u-head'], active: false }),
    )
    expect(
      getDb()
        .applications.slice(0, 3)
        .every((a) => a.responsibleIds.includes('u-head') && !a.active),
    ).toBe(true)
    await call(applicationsApi.endpoints.massUpdateApplications.initiate({ ids, removeResponsibleIds: ['u-head'] }))
    expect(getDb().applications[0].responsibleIds).not.toContain('u-head')
  })

  it('импорт: ответственные по почте, ошибки по строкам', () => {
    const db = getDb()
    const all = new Set(db.clients.map((c) => c.id))
    const c = db.clients[0]
    const row = (patch: Record<string, string>) => ({
      'Номер приложения': 'IMP-1',
      'Код клиента': c.code,
      Регион: 'Дальний Восток',
      'Тип бизнеса': 'Регулярный',
      'Действует с': '01.01.2026',
      'Действует по': '31.12.2026',
      Активно: 'Да',
      'Ответственные (почта)': 'i.voronova@basf-demo.ru',
      ...patch,
    })
    const { preview } = analyzeApplicationsImport(
      db,
      {
        applications: [
          row({}),
          row({ 'Номер приложения': 'IMP-2', 'Ответственные (почта)': 'net@net.ru' }),
          row({ 'Номер приложения': 'IMP-3', 'Действует по': '01.01.2020' }),
        ],
      },
      all,
    )
    expect(preview.counts).toEqual({ new: 1, update: 0, error: 2 })
    expect(preview.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([expect.stringContaining('не найден'), expect.stringContaining('раньше')]),
    )
  })
})
