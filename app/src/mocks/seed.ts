import dayjs from 'dayjs'
import { calcOrder } from '@/shared/lib/money'
import { NOTIFICATION_META } from '@/shared/lib/notificationMeta'
import type {
  Application,
  AuthToken,
  BusinessType,
  Client,
  Consignee,
  DeliveryTerm,
  EmailMessage,
  Order,
  OrderHistoryEntry,
  OrderItem,
  OrderStatus,
  PaymentTerm,
  Permission,
  Product,
  ProductGroup,
  ProductLine,
  Region,
  Role,
  SystemSettings,
  ClientGroup,
  AuditEntry,
  Notification,
  ExchangeJob,
  PaymentMethod,
  PriceEntry,
  VatRate,
  ExchangeLogEntry,
  ExchangeState,
  User,
} from '@/shared/types/domain'

export const DEMO_PASSWORD = 'Demo2027'
export const DEMO_INVITE_TOKEN = 'demo-invite-token'
export const EXCHANGE_DOWN = 'Нет ответа от сервера 1С (превышено время ожидания)'

export interface Db {
  version: number
  users: User[]
  roles: Role[]
  regions: Region[]
  businessTypes: BusinessType[]
  paymentTerms: PaymentTerm[]
  deliveryTerms: DeliveryTerm[]
  clients: Client[]
  consignees: Consignee[]
  productGroups: ProductGroup[]
  productLines: ProductLine[]
  products: Product[]
  applications: Application[]
  orders: Order[]
  tokens: AuthToken[]
  emails: EmailMessage[]
  settings: SystemSettings
  exchange: ExchangeState
  clientGroups: ClientGroup[]
  vatRates: VatRate[]
  paymentMethods: PaymentMethod[]
  priceHistory: PriceEntry[]
  notifications: Notification[]
  audit: AuditEntry[]
}

/** Детерминированный генератор — демо-данные одинаковы при каждом сбросе. */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const employeePerms: Permission[] = [
  'orders.create',
  'orders.edit',
  'orders.cancel',
  'orders.export',
  'documents.upload',
]

export function createSeed(): Db {
  const rand = rng(2027)
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const now = dayjs()

  // ---------- Справочники ----------
  const regions: Region[] = [
    { id: 'rg-north', name: 'Север' },
    { id: 'rg-south', name: 'Юг' },
    { id: 'rg-west', name: 'Запад' },
    { id: 'rg-east', name: 'Восток' },
    { id: 'rg-nc', name: 'Северный Кавказ' },
    { id: 'rg-far', name: 'Дальний Восток' },
  ]

  const paymentTerms: PaymentTerm[] = [
    { id: 'pt-prepay', code: 'GO11', name: 'Предоплата', methodId: 'pm-invoice' },
    { id: 'pt-30', code: 'GO12', name: 'Отсрочка 30 дней', methodId: 'pm-invoice' },
    { id: 'pt-60', code: 'GO13', name: 'Отсрочка 60 дней', methodId: 'pm-invoice' },
  ]
  const deliveryTerms: DeliveryTerm[] = [
    { id: 'dt-delivery', code: 'DLV', name: 'Доставка' },
    { id: 'dt-pickup', code: 'EXW', name: 'Самовывоз' },
  ]
  const businessTypes: BusinessType[] = [
    { id: 'bt-regular', name: 'Регулярный', validFrom: '2024-01-01', paymentTermIds: ['pt-prepay', 'pt-30'] },
    { id: 'bt-szr', name: 'СЗР', validFrom: '2024-01-01', paymentTermIds: ['pt-prepay', 'pt-30', 'pt-60'] },
    { id: 'bt-seeds', name: 'Семена', validFrom: '2025-06-01', paymentTermIds: ['pt-prepay'] },
  ]

  const productGroups: ProductGroup[] = [
    { id: 'pg-fung', name: 'Фунгициды', vatRate: 22 },
    { id: 'pg-herb', name: 'Гербициды', vatRate: 22 },
    { id: 'pg-ins', name: 'Инсектициды', vatRate: 22 },
    { id: 'pg-seed', name: 'Протравители', vatRate: 22 },
    { id: 'pg-seeds', name: 'Семена', vatRate: 10 },
  ]
  const productLines: ProductLine[] = [
    { id: 'pl-cereal', name: 'Зерновые' },
    { id: 'pl-oil', name: 'Масличные' },
    { id: 'pl-corn', name: 'Кукуруза и свёкла' },
    { id: 'pl-veg', name: 'Овощи и картофель' },
  ]

  // ---------- Продукты (~40) ----------
  type P = [string, string, string, string[], number, 'л' | 'кг', number]
  const rows: P[] = [
    // название, группа, линейка, типы бизнеса, объём упаковки, ед., цена
    ['Кунулус', 'pg-fung', 'pl-veg', ['bt-regular', 'bt-szr'], 25, 'кг', 746],
    ['Кабрио Топ', 'pg-fung', 'pl-veg', ['bt-regular', 'bt-szr'], 10, 'кг', 3120],
    ['Акробат МЦ', 'pg-fung', 'pl-veg', ['bt-regular', 'bt-szr'], 15, 'кг', 1890],
    ['Регалис Плюс', 'pg-fung', 'pl-veg', ['bt-regular', 'bt-szr'], 5, 'кг', 8450],
    ['Пиктор', 'pg-fung', 'pl-oil', ['bt-regular', 'bt-szr'], 10, 'л', 4270],
    ['Каптан', 'pg-fung', 'pl-veg', ['bt-regular'], 15, 'кг', 1260],
    ['Абига-Пик', 'pg-fung', 'pl-veg', ['bt-regular', 'bt-szr'], 15, 'кг', 980],
    ['Оптима Экстра', 'pg-fung', 'pl-cereal', ['bt-regular', 'bt-szr'], 10, 'л', 2640],
    ['Солигор', 'pg-fung', 'pl-cereal', ['bt-regular', 'bt-szr'], 10, 'л', 3380],
    ['Тилмор', 'pg-fung', 'pl-cereal', ['bt-regular', 'bt-szr'], 10, 'л', 2910],
    ['Фликер', 'pg-fung', 'pl-cereal', ['bt-szr'], 5, 'л', 3740],
    ['Дуал Голд', 'pg-herb', 'pl-corn', ['bt-regular', 'bt-szr'], 20, 'л', 1980],
    ['Базагран', 'pg-herb', 'pl-oil', ['bt-regular', 'bt-szr'], 20, 'л', 1460],
    ['Фронтьер Оптима', 'pg-herb', 'pl-oil', ['bt-regular', 'bt-szr'], 20, 'л', 1730],
    ['Корсар Супер', 'pg-herb', 'pl-cereal', ['bt-regular', 'bt-szr'], 10, 'л', 2210],
    ['Пульсар', 'pg-herb', 'pl-oil', ['bt-regular', 'bt-szr'], 10, 'л', 2540],
    ['Каптора Плюс', 'pg-herb', 'pl-oil', ['bt-regular', 'bt-szr'], 10, 'л', 3060],
    ['Эверест', 'pg-herb', 'pl-cereal', ['bt-regular'], 5, 'кг', 4870],
    ['Секатор Турбо', 'pg-herb', 'pl-cereal', ['bt-regular', 'bt-szr'], 5, 'л', 5220],
    ['Бетанал Эксперт', 'pg-herb', 'pl-corn', ['bt-regular', 'bt-szr'], 10, 'л', 2390],
    ['Лонтрел Гранд', 'pg-herb', 'pl-corn', ['bt-regular'], 1, 'кг', 3910],
    ['Нопасаран', 'pg-herb', 'pl-cereal', ['bt-regular', 'bt-szr'], 10, 'л', 1560],
    ['Фастак', 'pg-ins', 'pl-cereal', ['bt-regular', 'bt-szr'], 5, 'л', 2190],
    ['Нурелл Д', 'pg-ins', 'pl-oil', ['bt-regular', 'bt-szr'], 10, 'л', 1840],
    ['Нурелл Д Макс', 'pg-ins', 'pl-oil', ['bt-szr'], 10, 'л', 2050],
    ['Альфа Ципи', 'pg-ins', 'pl-cereal', ['bt-regular'], 5, 'л', 1120],
    ['Децис Эксперт', 'pg-ins', 'pl-corn', ['bt-regular', 'bt-szr'], 5, 'л', 1650],
    ['Эфория', 'pg-ins', 'pl-veg', ['bt-regular', 'bt-szr'], 5, 'л', 3580],
    ['Модесто', 'pg-seed', 'pl-corn', ['bt-regular', 'bt-szr'], 20, 'л', 2760],
    ['Круйзер', 'pg-seed', 'pl-cereal', ['bt-regular', 'bt-szr'], 20, 'л', 2340],
    ['Ламадор', 'pg-seed', 'pl-cereal', ['bt-regular', 'bt-szr'], 20, 'л', 1990],
    ['Витавакс', 'pg-seed', 'pl-cereal', ['bt-regular'], 20, 'кг', 1480],
    ['Селест Топ', 'pg-seed', 'pl-corn', ['bt-szr'], 20, 'л', 3120],
    ['Мастер Бетон', 'pg-seed', 'pl-corn', ['bt-regular'], 20, 'л', 2680],
    ['Гибрид подсолнечника ПР64', 'pg-seeds', 'pl-oil', ['bt-seeds'], 150, 'кг', 14500],
    ['Гибрид подсолнечника НК Бригантес', 'pg-seeds', 'pl-oil', ['bt-seeds'], 150, 'кг', 15900],
    ['Гибрид кукурузы ЛГ 3232', 'pg-seeds', 'pl-corn', ['bt-seeds'], 50, 'кг', 9800],
    ['Гибрид рапса Ризолекс', 'pg-seeds', 'pl-oil', ['bt-seeds'], 5, 'кг', 11800],
    ['Гибрид сахарной свёклы Сигма', 'pg-seeds', 'pl-corn', ['bt-seeds'], 100, 'кг', 12600],
    ['Нурелл Бустер', 'pg-ins', 'pl-oil', ['bt-szr'], 10, 'л', 2380],
  ]
  const products: Product[] = rows.map(([name, groupId, lineId, businessTypeIds, packSize, unit, price], i) => ({
    id: `pr-${i + 1}`,
    code: String(58907347 + i * 137),
    name: `${name} ${packSize}${unit === 'кг' ? ' кг' : ' л'}`,
    groupId,
    lineId,
    businessTypeIds,
    packSize,
    unit,
    minQty: packSize,
    multiple: packSize,
    price,
    closed: i === 5 || i === 31,
    inPriceList: i !== 18 && i !== 40,
  }))

  // ---------- История цен: прайс 2026, пересмотр в июле, у части позиций — запланированное повышение ----------
  const priceHistory: PriceEntry[] = []
  products.forEach((p, i) => {
    const round10 = (v: number) => Math.round(v / 10) * 10
    const entry = (n: number, price: number, validFrom: string, comment: string, created: string): PriceEntry => ({
      id: `pe-${i}-${n}`,
      productId: p.id,
      price,
      validFrom,
      createdAt: created,
      userId: 'u-admin',
      comment,
    })
    priceHistory.push(entry(1, round10(p.price * 0.93), '2026-01-01', 'Прайс-лист 2026', '2026-01-01T09:00:00.000Z'))
    priceHistory.push(entry(2, p.price, '2026-07-01', 'Пересмотр цен', '2026-06-25T09:00:00.000Z'))
    if (i % 7 === 0) {
      priceHistory.push(
        entry(
          3,
          round10(p.price * 1.05),
          now.add(20, 'day').format('YYYY-MM-DD'),
          'Плановое повышение',
          now.toISOString(),
        ),
      )
    }
  })
  // ---------- Клиенты ----------
  const clientRows: [string, string, string[], string[]][] = [
    ['Агро Комплект', 'eao-august@mail.ru', ['rg-far'], ['bt-regular', 'bt-szr']],
    ['Агрохим', 'agrohim@mail.ru', ['rg-south', 'rg-nc'], ['bt-regular', 'bt-szr', 'bt-seeds']],
    ['Агролига', 'info@agroliga.ru', ['rg-north'], ['bt-regular']],
    ['АГРОТЕК', 'mail@agrotek.ru', ['rg-south'], ['bt-regular', 'bt-szr']],
    ['ФЭС-Агро', 'fes@fes-agro.ru', ['rg-south'], ['bt-regular', 'bt-szr']],
    ['Хингарант', 'khingarant@mail.ru', ['rg-west'], ['bt-regular', 'bt-szr']],
    ['Аверс', 'avers95@mail.ru', ['rg-nc'], ['bt-regular']],
    ['Агро-Департамент', 'info@agrodepartment.ru', ['rg-east'], ['bt-regular', 'bt-szr']],
    ['Агро-Максимум', 'agro_maximum@mail.ru', ['rg-east'], ['bt-regular', 'bt-seeds']],
    ['Агро-Маркет', 'mail@agro-market.su', ['rg-east', 'rg-west'], ['bt-regular', 'bt-szr']],
  ]
  const clients: Client[] = clientRows.map(([name, email, regionIds, businessTypeIds], i) => ({
    id: `cl-${i + 1}`,
    code: String(6067384 - i * 411237),
    name: `ООО «${name}»`,
    email,
    inn: String(2310000000 + i * 31337).slice(0, 10),
    kpp: `231001${String(i + 1).padStart(3, '0')}`,
    legalAddress: `г. ${['Хабаровск', 'Краснодар', 'Москва', 'Ставрополь', 'Ставрополь', 'Тамбов', 'Беслан', 'Новосибирск', 'Омск', 'Самара'][i]}, ул. Заводская, д. ${10 + i}`,
    phone: `+7 900 ${String(100 + i * 11)}-${String(10 + i)}-${String(20 + i)}`,
    regionIds,
    active: i !== 8,
    businessTypeIds,
    paymentTermIds: i % 3 === 0 ? ['pt-prepay'] : ['pt-prepay', 'pt-30'],
    defaultPaymentTermId: 'pt-prepay',
    deliveryTermIds: ['dt-delivery', 'dt-pickup'],
    canChooseDelivery: i % 4 !== 3,
    vatRate: i === 4 ? 10 : undefined,
    availability: {
      closedGroupIds: i === 6 ? ['pg-ins'] : [],
      closedLineIds: [],
      closedProductIds: i === 2 ? ['pr-12'] : [],
      openedProductIds: i === 0 ? ['pr-19'] : [],
    },
  }))

  const consignees: Consignee[] = clients.flatMap((c, i) => [
    {
      id: `cs-${i + 1}a`,
      clientId: c.id,
      code: c.code,
      name: c.name.replace('ООО', 'ООО').concat(' — основной склад'),
      address: c.legalAddress,
    },
    ...(i % 2 === 0
      ? [
          {
            id: `cs-${i + 1}b`,
            clientId: c.id,
            code: String(Number(c.code) + 1),
            name: `${c.name} — филиал`,
            address: `Склад №2, ${c.legalAddress}`,
          },
        ]
      : []),
  ])

  // ---------- Роли ----------
  const roles: Role[] = [
    {
      id: 'role-admin',
      name: 'Администратор',
      type: 'employee',
      description: 'Полный доступ ко всему',
      permissions: [],
      fullAccess: true,
      active: true,
    },
    {
      id: 'role-client',
      name: 'Клиент',
      type: 'client',
      description: 'Заказы своей компании',
      permissions: ['orders.create', 'orders.cancel', 'orders.export'],
      active: true,
    },
    {
      id: 'role-manager',
      name: 'Менеджер',
      type: 'employee',
      description: 'Создаёт и исправляет заказы клиентов',
      permissions: employeePerms,
      active: true,
    },
    {
      id: 'role-approver',
      name: 'Одобряющий менеджер',
      type: 'employee',
      description: 'Одобряет и отклоняет заказы',
      permissions: [...employeePerms, 'orders.approve'],
      active: true,
    },
    {
      id: 'role-head',
      name: 'Руководитель региона',
      type: 'employee',
      description: 'Видит заказы своей команды, одобряет и управляет клиентами',
      permissions: [...employeePerms, 'orders.approve', 'clients.manage', 'applications.manage'],
      active: true,
    },
    {
      id: 'role-viewer',
      name: 'Просмотр',
      type: 'employee',
      description: 'Только просмотр заказов',
      permissions: ['orders.export'],
      active: true,
    },
  ]

  // ---------- Пользователи ----------
  const u = (
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    roleId: string,
    extra: Partial<User> = {},
  ): User => ({
    id,
    firstName,
    lastName,
    email,
    password: DEMO_PASSWORD,
    phone: `+7 495 ${100 + Math.floor(rand() * 899)}-${10 + Math.floor(rand() * 89)}-${10 + Math.floor(rand() * 89)}`,
    roleId,
    kind: roleId === 'role-client' ? 'client' : 'employee',
    status: 'active',
    notifyEmail: true,
    ...extra,
  })

  const users: User[] = [
    // сотрудники BASF
    u('u-admin', 'Анна', 'Соколова', 'a.sokolova@basf-demo.ru', 'role-admin', {
      scope: { clientIds: [], regionIds: [], businessTypeIds: [] },
    }),
    u('u-head', 'Олег', 'Мельников', 'o.melnikov@basf-demo.ru', 'role-head', {
      scope: { clientIds: [], regionIds: ['rg-south'], businessTypeIds: ['bt-regular', 'bt-szr'] },
    }),
    u('u-mgr1', 'Елена', 'Летунова', 'e.letunova@basf-demo.ru', 'role-manager', {
      managerId: 'u-head',
      scope: { clientIds: ['cl-3'], regionIds: ['rg-north'], businessTypeIds: ['bt-regular'] },
    }),
    u('u-mgr2', 'Руслан', 'Абазов', 'r.abazov@basf-demo.ru', 'role-manager', {
      managerId: 'u-head',
      scope: { clientIds: ['cl-2', 'cl-5'], regionIds: ['rg-south'], businessTypeIds: ['bt-regular', 'bt-szr'] },
    }),
    u('u-app1', 'Ирина', 'Воронова', 'i.voronova@basf-demo.ru', 'role-approver', {
      scope: {
        clientIds: ['cl-1', 'cl-4'],
        regionIds: ['rg-far', 'rg-south'],
        businessTypeIds: ['bt-regular', 'bt-szr'],
      },
    }),
    u('u-app2', 'Сергей', 'Алехин', 'a.alekhin@basf-demo.ru', 'role-approver', {
      scope: { clientIds: ['cl-6'], regionIds: ['rg-west'], businessTypeIds: ['bt-regular', 'bt-szr'] },
    }),
    u('u-view', 'Мария', 'Кузнецова', 'm.kuznetsova@basf-demo.ru', 'role-viewer', {
      scope: { clientIds: [], regionIds: ['rg-east'], businessTypeIds: ['bt-regular'] },
    }),
    // пользователи клиентов
    u('c-1a', 'Пётр', 'Иванов', 'p.ivanov@agrokomplekt.ru', 'role-client', { clientId: 'cl-1' }),
    u('c-1b', 'Светлана', 'Орлова', 's.orlova@agrokomplekt.ru', 'role-client', { clientId: 'cl-1' }),
    u('c-2', 'Алексей', 'Рогов', 'a.rogov@agrohim.ru', 'role-client', { clientId: 'cl-2' }),
    u('c-3', 'Наталья', 'Белова', 'n.belova@agroliga.ru', 'role-client', { clientId: 'cl-3' }),
    u('c-4', 'Игорь', 'Фомин', 'i.fomin@agrotek.ru', 'role-client', { clientId: 'cl-4' }),
    u('c-10', 'Дмитрий', 'Новиков', 'd.novikov@agro-market.su', 'role-client', {
      clientId: 'cl-10',
      status: 'invited',
      password: '',
    }),
    u('c-7', 'Виктор', 'Громов', 'v.gromov@avers.ru', 'role-client', { clientId: 'cl-7', status: 'blocked' }),
  ]

  // ---------- Приложения к договорам ----------
  const applications: Application[] = []
  let appN = 1
  clients.forEach((c) => {
    c.regionIds.forEach((rg) => {
      c.businessTypeIds.slice(0, 2).forEach((bt) => {
        const code = {
          'rg-north': 'СЕВ',
          'rg-south': 'ЮГ',
          'rg-west': 'ЗАП',
          'rg-east': 'ВОС',
          'rg-nc': 'СК',
          'rg-far': 'ДВ',
        }[rg]
        applications.push({
          id: `ap-${appN}`,
          number: `${100 + appN * 7}-ДС1-${bt === 'bt-szr' ? 'СЗР' : bt === 'bt-seeds' ? 'СЕМ' : 'ОСН'}_${code}`,
          clientId: c.id,
          regionId: rg,
          businessTypeId: bt,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
          responsibleIds: appN % 3 === 0 ? ['u-app2'] : appN % 3 === 1 ? ['u-app1'] : ['u-app1', 'u-app2'],
          active: true,
        })
        appN++
      })
    })
  })

  // ---------- Заказы в разных статусах ----------
  const orders: Order[] = []
  const statusPlan: OrderStatus[] = [
    'pending',
    'pending',
    'pending',
    'pending',
    'draft',
    'draft',
    'rejected',
    'cancelled',
    'sent',
    'accepted',
    'accepted',
    'completed',
    'completed',
    'completed',
    'completed',
    'error',
    'completed',
    'pending',
    'accepted',
    'completed',
  ]
  const clientPool = ['cl-1', 'cl-1', 'cl-1', 'cl-2', 'cl-3', 'cl-4', 'cl-5', 'cl-6', 'cl-7', 'cl-2']
  statusPlan.forEach((status, i) => {
    const client = clients.find((c) => c.id === (i < 6 ? 'cl-1' : clientPool[i % clientPool.length]))!
    const regionId = pick(client.regionIds)
    const bt = pick(client.businessTypeIds)
    const app =
      applications.find((a) => a.clientId === client.id && a.regionId === regionId && a.businessTypeId === bt) ??
      applications.find((a) => a.clientId === client.id)!
    const consignee = consignees.find((c) => c.clientId === client.id)!
    const pool = products.filter((p) => !p.closed && p.businessTypeIds.includes(app.businessTypeId))
    const n = 1 + Math.floor(rand() * 4)
    const chosen = [...pool].sort(() => rand() - 0.5).slice(0, n)
    const items: OrderItem[] = chosen.map((p, k) => ({
      id: `oi-${i + 1}-${k + 1}`,
      productId: p.id,
      qty: p.multiple * (1 + Math.floor(rand() * 8)),
      price: p.price,
      vatRate: client.vatRate ?? productGroups.find((g) => g.id === p.groupId)!.vatRate,
    }))
    const created = now
      .subtract(i * 3 + 1, 'day')
      .hour(9 + (i % 8))
      .minute((i * 13) % 60)
    const creator =
      i === 1
        ? 'u-app1' // заказ, который она не сможет одобрить сама
        : i % 4 === 0 && ['cl-2', 'cl-4', 'cl-5'].includes(client.id)
          ? 'u-mgr2'
          : client.id === 'cl-1'
            ? i % 2
              ? 'c-1a'
              : 'c-1b'
            : (users.find((x) => x.clientId === client.id)?.id ?? 'u-mgr1')
    const hist: OrderHistoryEntry[] = [
      {
        id: `h-${i}-1`,
        at: created.toISOString(),
        userId: creator,
        action: status === 'draft' ? 'Создан черновик' : 'Заказ создан и отправлен на одобрение',
      },
    ]
    const approver = app.responsibleIds[0]
    const step = (m: number, userId: string, action: string, details?: string) =>
      hist.push({ id: `h-${i}-${hist.length + 1}`, at: created.add(m, 'hour').toISOString(), userId, action, details })
    if (status === 'rejected') step(5, approver, 'Заказ отклонён', 'Не совпадает объём с условиями приложения')
    if (status === 'cancelled') step(3, creator, 'Заказ отменён', 'Клиент передумал')
    if (['sent', 'accepted', 'completed', 'error'].includes(status)) step(4, approver, 'Заказ одобрен')
    if (['sent', 'accepted', 'completed'].includes(status)) step(4, 'system', 'Заказ передан в 1С')
    if (['accepted', 'completed'].includes(status))
      step(6, 'system', 'Принят в 1С', `Номер в 1С: ${String(3388649477 - i * 811)}`)
    if (status === 'completed') step(70, 'system', 'Заказ выполнен')
    if (status === 'error') step(5, 'system', 'Ошибка передачи в 1С', EXCHANGE_DOWN)
    orders.push({
      id: `or-${i + 1}`,
      number: `P-${String(1040 - i).padStart(6, '0')}`,
      erpNumber: ['accepted', 'completed'].includes(status) ? String(3388649477 - i * 811) : undefined,
      status,
      createdAt: created.toISOString(),
      createdById: creator,
      clientId: client.id,
      consigneeId: consignee.id,
      regionId,
      city: ['Хабаровск', 'Краснодар', 'Москва', 'Ставрополь', 'Тамбов'][i % 5],
      businessTypeId: app.businessTypeId,
      applicationId: app.id,
      paymentTermId: client.defaultPaymentTermId,
      deliveryTermId: i % 3 === 0 ? 'dt-pickup' : 'dt-delivery',
      desiredDate: created.add(14, 'day').format('YYYY-MM-DD'),
      comments: {
        ...(i % 5 === 0 ? { client: 'Просьба привезти до обеда' } : {}),
        ...(status !== 'draft' && i % 3 === 1 ? { manager: 'Условия согласованы с клиентом по телефону' } : {}),
      },
      items,
      history: hist,
      documents:
        status === 'completed'
          ? [
              {
                id: `d-${i}`,
                type: 'УПД',
                fileName: `UPD_${1040 - i}.pdf`,
                size: 184_320,
                uploadedAt: created.add(72, 'hour').toISOString(),
                uploadedById: 'u-mgr1',
              },
            ]
          : [],
      responsibleId: approver,
    })
  })

  // ---------- Группы клиентов (массовое назначение условий) ----------
  const clientGroups: ClientGroup[] = [
    {
      id: 'cg-south',
      name: 'Юг — оптовые клиенты',
      description: 'Крупные дистрибьюторы юга и Северного Кавказа',
      template: {
        paymentTermIds: ['pt-prepay', 'pt-30'],
        defaultPaymentTermId: 'pt-prepay',
        businessTypeIds: ['bt-regular', 'bt-szr'],
        deliveryTermIds: ['dt-delivery', 'dt-pickup'],
        canChooseDelivery: true,
        availability: { closedGroupIds: [], closedLineIds: [], closedProductIds: [], openedProductIds: [] },
      },
    },
    {
      id: 'cg-new',
      name: 'Новые клиенты',
      description: 'Ограниченный ассортимент и только предоплата, пока клиент не подтвердит оборот',
      template: {
        paymentTermIds: ['pt-prepay'],
        defaultPaymentTermId: 'pt-prepay',
        businessTypeIds: ['bt-regular'],
        deliveryTermIds: ['dt-delivery', 'dt-pickup'],
        canChooseDelivery: false,
        availability: { closedGroupIds: ['pg-seeds'], closedLineIds: [], closedProductIds: [], openedProductIds: [] },
      },
    },
  ]
  clients.forEach((c) => {
    if (['cl-2', 'cl-4', 'cl-5'].includes(c.id)) c.groupId = 'cg-south'
    if (['cl-8', 'cl-9'].includes(c.id)) c.groupId = 'cg-new'
  })

  // ---------- Обмен с 1С: задания по заказам, которые уже переданы ----------
  const exchange: ExchangeState = { mode: 'ok', jobs: [], log: [] }
  orders.forEach((o) => {
    if (!['sent', 'accepted', 'completed', 'error'].includes(o.status)) return
    const sentAt = o.history.find((h) => h.action === 'Заказ передан в 1С' || h.action === 'Ошибка передачи в 1С')
    const at = sentAt?.at ?? o.createdAt
    const job: ExchangeJob = {
      id: `ex-${o.id}`,
      orderId: o.id,
      status: o.status as ExchangeJob['status'],
      outcome: o.status === 'error' ? 'down' : 'ok',
      attempts: 1,
      sentAt: o.status === 'sent' ? now.subtract(1, 'second').toISOString() : at,
      updatedAt: at,
      lastError: o.status === 'error' ? EXCHANGE_DOWN : undefined,
      erpNumber: o.erpNumber,
      frozen: true,
    }
    exchange.jobs.push(job)
    const log = (message: string, level: ExchangeLogEntry['level'] = 'info') =>
      exchange.log.push({ id: `exl-${exchange.log.length + 1}`, at, orderId: o.id, level, message })
    log('Заказ передан в 1С')
    if (o.status === 'error') log(EXCHANGE_DOWN, 'error')
    if (o.erpNumber) log(`Принят в 1С, номер ${o.erpNumber}`)
  })

  // ---------- Уведомления: примеры для демонстрации центра уведомлений ----------
  const notifications: Notification[] = []
  const money = (o: Order) => `${new Intl.NumberFormat('ru-RU').format(Math.round(calcOrder(o.items).gross))} ₽`
  orders.forEach((o) => {
    const client = clients.find((c) => c.id === o.clientId)
    const add = (userId: string, type: Notification['type'], at: string, read: boolean) =>
      notifications.push({
        id: `nt-${notifications.length + 1}`,
        userId,
        type,
        orderId: o.id,
        title: NOTIFICATION_META[type].title(o.number),
        text: `${client?.name} · ${money(o)}`,
        at,
        read,
      })
    const app = applications.find((a) => a.id === o.applicationId)
    if (o.status === 'pending') {
      app?.responsibleIds
        .filter((u) => u !== o.createdById)
        .forEach((u) => add(u, 'order.submitted', o.createdAt, false))
    }
    if (o.status === 'completed' || o.status === 'accepted') {
      const done = o.history.find((h) => h.action === 'Заказ выполнен' || h.action === 'Принят в 1С')
      users
        .filter((u) => u.clientId === o.clientId && u.status === 'active')
        .forEach((u) =>
          add(
            u.id,
            o.status === 'completed' ? 'exchange.completed' : 'exchange.accepted',
            done?.at ?? o.createdAt,
            notifications.length % 3 === 0,
          ),
        )
    }
    if (o.status === 'rejected') add(o.createdById, 'order.rejected', o.history.at(-1)?.at ?? o.createdAt, false)
  })
  notifications.sort((a, b) => b.at.localeCompare(a.at))

  // ---------- Журнал действий: несколько записей, чтобы экран не был пустым ----------
  const audit: AuditEntry[] = [
    {
      id: 'au-1',
      at: now.subtract(2, 'day').toISOString(),
      userId: 'u-admin',
      entity: 'role',
      entityId: 'role-head',
      entityName: 'Руководитель региона',
      action: 'Изменена',
      changes: [
        { field: 'Разрешения', from: 'Одобрять и отклонять', to: 'Одобрять и отклонять, Работать с клиентами' },
      ],
    },
    {
      id: 'au-2',
      at: now.subtract(5, 'day').toISOString(),
      userId: 'u-admin',
      entity: 'price',
      entityId: 'pr-1',
      entityName: 'Кабрио Топ 10 кг',
      action: 'Добавлена цена',
      summary: 'Плановое повышение с ' + now.add(20, 'day').format('DD.MM.YYYY'),
      changes: [],
    },
    {
      id: 'au-3',
      at: now.subtract(9, 'day').toISOString(),
      userId: 'u-head',
      entity: 'client',
      entityId: 'cl-2',
      entityName: 'ООО «Агрохим»',
      action: 'Изменён',
      changes: [{ field: 'Телефон', from: '+7 900 122-11-21', to: '+7 900 122-11-22' }],
    },
  ]
  // ---------- Токены (демо-приглашение) ----------
  const tokens: AuthToken[] = [
    { token: DEMO_INVITE_TOKEN, userId: 'c-10', type: 'invite', expiresAt: now.add(7, 'day').toISOString() },
  ]

  return {
    version: 8,
    users,
    roles,
    regions,
    businessTypes,
    paymentTerms,
    deliveryTerms,
    clients,
    consignees,
    productGroups,
    productLines,
    products,
    applications,
    orders,
    tokens,
    emails: [],
    exchange,
    clientGroups,
    vatRates: [
      { id: 'vr-0', rate: 0 },
      { id: 'vr-10', rate: 10 },
      { id: 'vr-22', rate: 22 },
    ],
    paymentMethods: [{ id: 'pm-invoice', name: 'Счёт' }],
    priceHistory,
    notifications,
    audit,
    settings: {
      clientUserLimit: 10,
      separateCreateApprove: true,
      sessionHours: 8,
      senderEmail: 'noreply@basf-demo.ru',
      multiLevelApproval: false,
    },
  }
}
