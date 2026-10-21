import { api } from '@/app/api'
import { MockError, mock } from '@/mocks/mock'
import { newId } from '@/mocks/db'
import { accessibleClientIds, currentUser, hasPermission } from '@/mocks/access'
import { analyzeImport, applyImport, type ImportInput, type ImportPreview } from '@/mocks/clientsImport'
import { inviteLinkFor, sendInvite } from '@/mocks/invites'
import type { Db } from '@/mocks/seed'
import { audit, diff, type AuditInput } from '@/mocks/audit'
import { emptyAvailability } from '@/shared/lib/availability'
import { isEmail, isPhone, validateConditions, validateRequisites, type Requisites } from '@/shared/lib/requisites'
import type {
  Client,
  ClientConditions,
  ClientGroup,
  Consignee,
  Id,
  PaymentTerm,
  BusinessType,
  DeliveryTerm,
  Product,
  ProductGroup,
  ProductLine,
  Region,
  User,
  UserStatus,
  VatRate,
} from '@/shared/types/domain'

export type ClientStatusFilter = 'all' | 'active' | 'inactive'

export interface ClientsQuery {
  q: string
  regionId: Id
  groupId: Id
  status: ClientStatusFilter
  page: number
  pageSize: number
  sortBy: 'name' | 'code'
  sortDir: 'asc' | 'desc'
}

export interface ClientRow {
  id: Id
  code: string
  name: string
  email: string
  inn: string
  regionNames: string[]
  groupName?: string
  active: boolean
  usersCount: number
}

export interface ClientsList {
  rows: ClientRow[]
  total: number
  regions: Region[]
  groups: { id: Id; name: string }[]
}

export interface ClientUserRow {
  id: Id
  email: string
  firstName: string
  lastName: string
  phone: string
  status: UserStatus
  /** Ссылка из письма-приглашения (демо). */
  inviteLink?: string
}

export interface ClientDetail {
  client: Client
  users: ClientUserRow[]
  userLimit: number
  consignees: Consignee[]
  ordersCount: number
  refs: {
    regions: Region[]
    paymentTerms: PaymentTerm[]
    deliveryTerms: DeliveryTerm[]
    businessTypes: BusinessType[]
    groups: ClientGroup[]
    productGroups: ProductGroup[]
    productLines: ProductLine[]
    products: Product[]
    vatRates: VatRate[]
  }
}

export type ConditionSection = 'payment' | 'business' | 'delivery' | 'vat' | 'assortment'

export interface GroupRow extends ClientGroup {
  memberIds: Id[]
  memberNames: string[]
}

export type GroupInput = { id?: Id; name: string; description: string; template: ClientConditions; memberIds: Id[] }

// ---------------------------------------------------------------------------------------------

const rec = (db: Db, qa: { getState: () => unknown }, input: AuditInput) => audit(db, currentUser(db, qa), input)

const CLIENT_LABELS = {
  code: 'Код 1С',
  name: 'Наименование',
  email: 'Почта',
  inn: 'ИНН',
  kpp: 'КПП',
  legalAddress: 'Юридический адрес',
  phone: 'Телефон',
  regionIds: 'Регионы',
  active: 'Работает',
}

function manageable(db: Db, user: User) {
  if (!hasPermission(db, user, 'clients.manage')) throw new MockError('forbidden', 'Раздел «Клиенты» вам недоступен')
  return accessibleClientIds(db, user)
}

function clientOf(db: Db, user: User, id: Id): Client {
  const c = db.clients.find((x) => x.id === id)
  if (!c || !manageable(db, user).has(id)) throw new MockError('notFound', 'Клиент не найден или недоступен вам')
  return c
}

const toUserRow = (db: Db, u: User): ClientUserRow => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  phone: u.phone,
  status: u.status,
  inviteLink: u.status === 'invited' ? inviteLinkFor(db, u.id) : undefined,
})

const SECTION_APPLY: Record<ConditionSection, (c: Client, t: ClientConditions) => void> = {
  payment: (c, t) =>
    Object.assign(c, { paymentTermIds: [...t.paymentTermIds], defaultPaymentTermId: t.defaultPaymentTermId }),
  business: (c, t) => Object.assign(c, { businessTypeIds: [...t.businessTypeIds] }),
  delivery: (c, t) =>
    Object.assign(c, { deliveryTermIds: [...t.deliveryTermIds], canChooseDelivery: t.canChooseDelivery }),
  vat: (c, t) => Object.assign(c, { vatRate: t.vatRate }),
  assortment: (c, t) => Object.assign(c, { availability: structuredClone(t.availability) }),
}

function assertUnique(db: Db, v: Pick<Requisites, 'code' | 'inn' | 'kpp'>, exceptId?: Id) {
  const other = db.clients.filter((c) => c.id !== exceptId)
  if (other.some((c) => c.code === v.code.trim())) throw new MockError('validation', 'Клиент с таким кодом 1С уже есть')
  if (other.some((c) => c.inn === v.inn.trim() && c.kpp === v.kpp.trim())) {
    throw new MockError('validation', 'Клиент с таким ИНН и КПП уже есть')
  }
}

const clean = (v: Requisites): Requisites => ({
  ...v,
  code: v.code.trim(),
  name: v.name.trim(),
  email: v.email.trim(),
  inn: v.inn.trim(),
  kpp: v.kpp.trim(),
  legalAddress: v.legalAddress.trim(),
  phone: v.phone.trim(),
})

function assertRequisites(v: Requisites) {
  const errors = validateRequisites(v)
  const first = Object.values(errors)[0]
  if (first) throw new MockError('validation', first)
}

const norm = (s: string) => s.toLowerCase()

// ---------------------------------------------------------------------------------------------

export const clientsApi = api.injectEndpoints({
  endpoints: (b) => ({
    listClients: b.query<ClientsList, ClientsQuery>({
      queryFn: (q, qa) =>
        mock((db) => {
          const user = currentUser(db, qa)
          const ids = manageable(db, user)
          const s = norm(q.q.trim())
          const rows = db.clients
            .filter((c) => ids.has(c.id))
            .filter((c) => (q.status === 'all' ? true : q.status === 'active' ? c.active : !c.active))
            .filter((c) => !q.regionId || c.regionIds.includes(q.regionId))
            .filter((c) => !q.groupId || (q.groupId === 'none' ? !c.groupId : c.groupId === q.groupId))
            .filter((c) => !s || [c.name, c.code, c.inn, c.email].some((f) => norm(f).includes(s)))
            .map<ClientRow>((c) => ({
              id: c.id,
              code: c.code,
              name: c.name,
              email: c.email,
              inn: c.inn,
              regionNames: c.regionIds.map((r) => db.regions.find((x) => x.id === r)?.name ?? '—'),
              groupName: db.clientGroups.find((g) => g.id === c.groupId)?.name,
              active: c.active,
              usersCount: db.users.filter((u) => u.clientId === c.id).length,
            }))
          const sign = q.sortDir === 'asc' ? 1 : -1
          rows.sort((a, b2) => sign * a[q.sortBy].localeCompare(b2[q.sortBy], 'ru', { numeric: true }))
          const start = (q.page - 1) * q.pageSize
          return {
            rows: rows.slice(start, start + q.pageSize),
            total: rows.length,
            regions: db.regions,
            groups: db.clientGroups.map((g) => ({ id: g.id, name: g.name })),
          }
        }),
      providesTags: [{ type: 'Client', id: 'LIST' }],
    }),

    /** Справочники для форм клиентов и групп. */
    getClientRefs: b.query<ClientDetail['refs'], void>({
      queryFn: (_a, qa) =>
        mock((db) => {
          manageable(db, currentUser(db, qa))
          return {
            regions: db.regions,
            paymentTerms: db.paymentTerms,
            deliveryTerms: db.deliveryTerms,
            businessTypes: db.businessTypes,
            groups: db.clientGroups,
            productGroups: db.productGroups,
            productLines: db.productLines,
            products: db.products,
            vatRates: db.vatRates,
          }
        }),
    }),

    getClient: b.query<ClientDetail, Id>({
      queryFn: (id, qa) =>
        mock((db) => {
          const client = clientOf(db, currentUser(db, qa), id)
          return {
            client,
            users: db.users.filter((u) => u.clientId === id).map((u) => toUserRow(db, u)),
            userLimit: db.settings.clientUserLimit,
            consignees: db.consignees.filter((c) => c.clientId === id),
            ordersCount: db.orders.filter((o) => o.clientId === id && o.status !== 'draft').length,
            refs: {
              regions: db.regions,
              paymentTerms: db.paymentTerms,
              deliveryTerms: db.deliveryTerms,
              businessTypes: db.businessTypes,
              groups: db.clientGroups,
              productGroups: db.productGroups,
              productLines: db.productLines,
              products: db.products,
              vatRates: db.vatRates,
            },
          }
        }),
      providesTags: (_r, _e, id) => [{ type: 'Client', id }],
    }),

    createClient: b.mutation<{ id: Id }, Requisites>({
      queryFn: (input, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            manageable(db, user)
            const v = clean(input)
            assertRequisites(v)
            assertUnique(db, v)
            const client: Client = {
              ...v,
              id: newId('cl'),
              paymentTermIds: [db.paymentTerms[0].id],
              defaultPaymentTermId: db.paymentTerms[0].id,
              businessTypeIds: [db.businessTypes[0].id],
              deliveryTermIds: db.deliveryTerms.map((d) => d.id),
              canChooseDelivery: false,
              availability: emptyAvailability(),
            }
            db.clients.push(client)
            // Создавший клиента должен его видеть, даже если регион вне его зоны.
            user.scope?.clientIds.push(client.id)
            rec(db, qa, { entity: 'client', entityId: client.id, entityName: client.name, action: 'Создан' })
            return { id: client.id }
          },
          { write: true },
        ),
      invalidatesTags: [{ type: 'Client', id: 'LIST' }],
    }),

    updateRequisites: b.mutation<void, Requisites & { id: Id }>({
      queryFn: ({ id, ...input }, qa) =>
        mock(
          (db) => {
            const client = clientOf(db, currentUser(db, qa), id)
            const v = clean(input)
            assertRequisites(v)
            assertUnique(db, v, id)
            const changes = diff(client, v, CLIENT_LABELS, {
              regionIds: (x) => (x as string[]).map((r) => db.regions.find((g) => g.id === r)?.name ?? r).join(', '),
            })
            Object.assign(client, v)
            if (changes.length)
              rec(db, qa, { entity: 'client', entityId: id, entityName: client.name, action: 'Изменён', changes })
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, a) => [{ type: 'Client', id: a.id }, { type: 'Client', id: 'LIST' }, 'Order'],
    }),

    setClientsActive: b.mutation<void, { ids: Id[]; active: boolean }>({
      queryFn: ({ ids, active }, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            ids.forEach((id) => {
              const c = clientOf(db, user, id)
              if (c.active === active) return
              c.active = active
              rec(db, qa, {
                entity: 'client',
                entityId: id,
                entityName: c.name,
                action: active ? 'Включён' : 'Отключён',
              })
            })
          },
          { write: true },
        ),
      invalidatesTags: [{ type: 'Client', id: 'LIST' }, 'Client'],
    }),

    updateConditions: b.mutation<void, { id: Id; conditions: ClientConditions }>({
      queryFn: ({ id, conditions }, qa) =>
        mock(
          (db) => {
            const client = clientOf(db, currentUser(db, qa), id)
            const first = Object.values(validateConditions(conditions))[0]
            if (first) throw new MockError('validation', first)
            Object.assign(client, structuredClone(conditions))
            if (conditions.vatRate === undefined) delete client.vatRate
            rec(db, qa, {
              entity: 'client',
              entityId: id,
              entityName: client.name,
              action: 'Изменены условия',
              summary: 'Оплата, типы бизнеса, поставка, НДС или ассортимент',
            })
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, a) => [{ type: 'Client', id: a.id }, 'Order'],
    }),

    updateClientGroup: b.mutation<void, { ids: Id[]; groupId: Id | null }>({
      queryFn: ({ ids, groupId }, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            if (groupId && !db.clientGroups.some((g) => g.id === groupId))
              throw new MockError('notFound', 'Группа не найдена')
            ids.forEach((id) => {
              const c = clientOf(db, user, id)
              if (groupId) c.groupId = groupId
              else delete c.groupId
            })
            rec(db, qa, {
              entity: 'client',
              entityName: `Клиентов: ${ids.length}`,
              action: groupId ? 'Назначена группа' : 'Снята группа',
              summary: db.clientGroups.find((g) => g.id === groupId)?.name,
            })
          },
          { write: true },
        ),
      invalidatesTags: ['Client'],
    }),

    // ---------- пользователи клиента ----------
    addClientUser: b.mutation<
      { inviteLink: string },
      { clientId: Id; email: string; firstName: string; lastName: string; phone: string }
    >({
      queryFn: ({ clientId, ...v }, qa) =>
        mock(
          (db) => {
            clientOf(db, currentUser(db, qa), clientId)
            const email = v.email.trim().toLowerCase()
            if (!isEmail(email)) throw new MockError('validation', 'Проверьте адрес почты')
            if (!v.firstName.trim() || !v.lastName.trim()) throw new MockError('validation', 'Укажите имя и фамилию')
            if (v.phone.trim() && !isPhone(v.phone)) throw new MockError('validation', 'Телефон: +7 900 123-45-67')
            if (db.users.some((u) => u.email.toLowerCase() === email)) {
              throw new MockError('validation', 'Пользователь с такой почтой уже есть — почта должна быть уникальной')
            }
            if (db.users.filter((u) => u.clientId === clientId).length >= db.settings.clientUserLimit) {
              throw new MockError(
                'validation',
                `Достигнут лимит пользователей на клиента: ${db.settings.clientUserLimit}`,
              )
            }
            const user: User = {
              id: newId('c'),
              email,
              password: '',
              firstName: v.firstName.trim(),
              lastName: v.lastName.trim(),
              phone: v.phone.trim(),
              roleId: 'role-client',
              kind: 'client',
              status: 'invited',
              clientId,
              notifyEmail: true,
            }
            db.users.push(user)
            rec(db, qa, {
              entity: 'client',
              entityId: clientId,
              entityName: db.clients.find((c) => c.id === clientId)?.name ?? '',
              action: 'Добавлен пользователь',
              summary: user.email,
            })
            return { inviteLink: sendInvite(db, user) }
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, a) => [
        { type: 'Client', id: a.clientId },
        { type: 'Client', id: 'LIST' },
      ],
    }),

    setClientUserBlocked: b.mutation<void, { userId: Id; blocked: boolean }>({
      queryFn: ({ userId, blocked }, qa) =>
        mock(
          (db) => {
            const target = db.users.find((u) => u.id === userId && u.clientId)
            if (!target) throw new MockError('notFound', 'Пользователь не найден')
            clientOf(db, currentUser(db, qa), target.clientId!)
            if (blocked) target.status = 'blocked'
            else target.status = target.password ? 'active' : 'invited'
            if (!blocked && target.status === 'invited') sendInvite(db, target)
            rec(db, qa, {
              entity: 'client',
              entityId: target.clientId,
              entityName: db.clients.find((c) => c.id === target.clientId)?.name ?? '',
              action: blocked ? 'Заблокирован пользователь' : 'Разблокирован пользователь',
              summary: target.email,
            })
          },
          { write: true },
        ),
      invalidatesTags: ['Client'],
    }),

    resendInvite: b.mutation<{ inviteLink: string }, { userId: Id }>({
      queryFn: ({ userId }, qa) =>
        mock(
          (db) => {
            const target = db.users.find((u) => u.id === userId && u.clientId)
            if (!target) throw new MockError('notFound', 'Пользователь не найден')
            clientOf(db, currentUser(db, qa), target.clientId!)
            if (target.status !== 'invited')
              throw new MockError('validation', 'Приглашение нужно только тем, кто ещё не задал пароль')
            return { inviteLink: sendInvite(db, target) }
          },
          { write: true },
        ),
      invalidatesTags: ['Client'],
    }),

    // ---------- грузополучатели ----------
    saveConsignee: b.mutation<void, { clientId: Id; id?: Id; code: string; name: string; address: string }>({
      queryFn: ({ clientId, id, ...v }, qa) =>
        mock(
          (db) => {
            clientOf(db, currentUser(db, qa), clientId)
            const row = { code: v.code.trim(), name: v.name.trim(), address: v.address.trim() }
            if (!row.code || !row.name || !row.address)
              throw new MockError('validation', 'Заполните код, наименование и адрес')
            if (db.consignees.some((c) => c.clientId === clientId && c.code === row.code && c.id !== id)) {
              throw new MockError('validation', 'У этого клиента уже есть грузополучатель с таким кодом')
            }
            const existing = id ? db.consignees.find((c) => c.id === id && c.clientId === clientId) : undefined
            if (id && !existing) throw new MockError('notFound', 'Грузополучатель не найден')
            if (existing) Object.assign(existing, row)
            else db.consignees.push({ id: newId('cs'), clientId, ...row })
            rec(db, qa, {
              entity: 'consignee',
              entityId: clientId,
              entityName: db.clients.find((c) => c.id === clientId)?.name ?? '',
              action: id ? 'Изменён грузополучатель' : 'Добавлен грузополучатель',
              summary: row.name,
            })
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, a) => [{ type: 'Client', id: a.clientId }],
    }),

    deleteConsignee: b.mutation<void, { clientId: Id; id: Id }>({
      queryFn: ({ clientId, id }, qa) =>
        mock(
          (db) => {
            clientOf(db, currentUser(db, qa), clientId)
            if (db.orders.some((o) => o.consigneeId === id)) {
              throw new MockError('validation', 'Грузополучатель указан в заказах — удалить его нельзя')
            }
            const gone = db.consignees.find((c) => c.id === id && c.clientId === clientId)
            db.consignees = db.consignees.filter((c) => !(c.id === id && c.clientId === clientId))
            if (gone)
              rec(db, qa, {
                entity: 'consignee',
                entityId: clientId,
                entityName: db.clients.find((c) => c.id === clientId)?.name ?? '',
                action: 'Удалён грузополучатель',
                summary: gone.name,
              })
          },
          { write: true },
        ),
      invalidatesTags: (_r, _e, a) => [{ type: 'Client', id: a.clientId }],
    }),

    // ---------- группы клиентов ----------
    listClientGroups: b.query<{ groups: GroupRow[]; clients: { id: Id; name: string; groupId?: Id }[] }, void>({
      queryFn: (_a, qa) =>
        mock((db) => {
          const ids = manageable(db, currentUser(db, qa))
          const visible = db.clients.filter((c) => ids.has(c.id))
          return {
            groups: db.clientGroups.map((g) => {
              const members = db.clients.filter((c) => c.groupId === g.id)
              return { ...g, memberIds: members.map((c) => c.id), memberNames: members.map((c) => c.name) }
            }),
            clients: visible.map((c) => ({ id: c.id, name: c.name, groupId: c.groupId })),
          }
        }),
      providesTags: [{ type: 'Client', id: 'GROUPS' }, 'Client'],
    }),

    saveClientGroup: b.mutation<{ id: Id }, GroupInput>({
      queryFn: (input, qa) =>
        mock(
          (db) => {
            const user = currentUser(db, qa)
            const ids = manageable(db, user)
            const name = input.name.trim()
            if (!name) throw new MockError('validation', 'Укажите название группы')
            if (db.clientGroups.some((g) => g.name.toLowerCase() === name.toLowerCase() && g.id !== input.id)) {
              throw new MockError('validation', 'Группа с таким названием уже есть')
            }
            const first = Object.values(validateConditions(input.template))[0]
            if (first) throw new MockError('validation', first)
            let group = db.clientGroups.find((g) => g.id === input.id)
            if (input.id && !group) throw new MockError('notFound', 'Группа не найдена')
            if (!group) {
              group = { id: newId('cg'), name, description: '', template: input.template }
              db.clientGroups.push(group)
            }
            Object.assign(group, {
              name,
              description: input.description.trim(),
              template: structuredClone(input.template),
            })
            // Состав: участники из видимых пользователю клиентов; чужих не трогаем.
            db.clients.forEach((c) => {
              if (!ids.has(c.id)) return
              if (input.memberIds.includes(c.id)) c.groupId = group!.id
              else if (c.groupId === group!.id) delete c.groupId
            })
            rec(db, qa, {
              entity: 'group',
              entityId: group.id,
              entityName: group.name,
              action: input.id ? 'Изменена' : 'Создана',
              summary: `Клиентов: ${input.memberIds.length}`,
            })
            return { id: group.id }
          },
          { write: true },
        ),
      invalidatesTags: ['Client'],
    }),

    deleteClientGroup: b.mutation<void, Id>({
      queryFn: (id, qa) =>
        mock(
          (db) => {
            manageable(db, currentUser(db, qa))
            const removed = db.clientGroups.find((g) => g.id === id)
            db.clientGroups = db.clientGroups.filter((g) => g.id !== id)
            if (removed) rec(db, qa, { entity: 'group', entityId: id, entityName: removed.name, action: 'Удалена' })
            db.clients.forEach((c) => c.groupId === id && delete c.groupId)
          },
          { write: true },
        ),
      invalidatesTags: ['Client'],
    }),

    /** Массовое назначение: копирует выбранные разделы шаблона группы всем её участникам. */
    applyGroupTemplate: b.mutation<{ applied: number }, { groupId: Id; sections: ConditionSection[] }>({
      queryFn: ({ groupId, sections }, qa) =>
        mock(
          (db) => {
            const ids = manageable(db, currentUser(db, qa))
            const group = db.clientGroups.find((g) => g.id === groupId)
            if (!group) throw new MockError('notFound', 'Группа не найдена')
            if (!sections.length) throw new MockError('validation', 'Выберите, что применить')
            const members = db.clients.filter((c) => c.groupId === groupId && ids.has(c.id))
            members.forEach((c) => sections.forEach((s) => SECTION_APPLY[s](c, group.template)))
            rec(db, qa, {
              entity: 'group',
              entityId: group.id,
              entityName: group.name,
              action: 'Применён шаблон',
              summary: `Разделы: ${sections.join(', ')}; клиентов: ${members.length}`,
            })
            return { applied: members.length }
          },
          { write: true },
        ),
      invalidatesTags: ['Client', 'Order'],
    }),

    // ---------- импорт ----------
    previewClientImport: b.mutation<ImportPreview, ImportInput>({
      queryFn: (input, qa) =>
        mock((db) => {
          manageable(db, currentUser(db, qa))
          return analyzeImport(db, input).preview
        }),
    }),

    applyClientImport: b.mutation<ImportPreview['counts'] & { invites: number }, ImportInput>({
      queryFn: (input, qa) =>
        mock(
          (db) => {
            manageable(db, currentUser(db, qa))
            const result = applyImport(db, input)
            rec(db, qa, {
              entity: 'import',
              entityName: 'Клиенты, пользователи, грузополучатели',
              action: 'Импорт из Excel',
              summary: `Создано: ${result.new}, обновлено: ${result.update}, с ошибками: ${result.error}`,
            })
            return result
          },
          { write: true },
        ),
      invalidatesTags: ['Client', 'Order'],
    }),
  }),
})

export const {
  useListClientsQuery,
  useGetClientQuery,
  useGetClientRefsQuery,
  useCreateClientMutation,
  useUpdateRequisitesMutation,
  useSetClientsActiveMutation,
  useUpdateConditionsMutation,
  useUpdateClientGroupMutation,
  useAddClientUserMutation,
  useSetClientUserBlockedMutation,
  useResendInviteMutation,
  useSaveConsigneeMutation,
  useDeleteConsigneeMutation,
  useListClientGroupsQuery,
  useSaveClientGroupMutation,
  useDeleteClientGroupMutation,
  useApplyGroupTemplateMutation,
  usePreviewClientImportMutation,
  useApplyClientImportMutation,
} = clientsApi
