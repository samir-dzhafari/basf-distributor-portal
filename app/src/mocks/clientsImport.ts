import type { Client, Consignee, User } from '@/shared/types/domain'
import {
  countLines,
  norm,
  yes,
  type ImportCounts,
  type ImportIssue as GenericIssue,
  type ImportLine,
  type ImportPreview as GenericPreview,
  type ImportRow,
} from './importTypes'
import { isEmail, isInn, isKpp } from '@/shared/lib/requisites'
import { emptyAvailability } from '@/shared/lib/availability'
import { newId } from './db'
import { sendInvite } from './invites'
import type { Db } from './seed'

/** Заголовки листов и колонок шаблона импорта. Структура фиксированная: файлы произвольного вида не поддерживаются. */
export const IMPORT_SHEETS = {
  clients: 'Клиенты',
  users: 'Пользователи',
  consignees: 'Грузополучатели',
} as const

export const IMPORT_HEADERS = {
  clients: ['Код 1С', 'Наименование', 'Email', 'ИНН', 'КПП', 'Юридический адрес', 'Телефон', 'Регионы', 'Активен'],
  users: ['Email', 'Имя', 'Фамилия', 'Телефон', 'Код клиента'],
  consignees: ['Код', 'Наименование', 'Адрес', 'Код клиента'],
} as const

export type { ImportRow }
export interface ImportInput {
  clients: ImportRow[]
  users: ImportRow[]
  consignees: ImportRow[]
}

export type ImportSheet = keyof typeof IMPORT_SHEETS

export type ImportIssue = GenericIssue<ImportSheet>
export type { ImportLine }
export type ImportPreview = GenericPreview<ImportSheet>

interface Plan {
  clients: { row: number; data: Omit<Client, 'id'> & { id?: string } }[]
  users: {
    row: number
    data: { email: string; firstName: string; lastName: string; phone: string; clientCode: string }
  }[]
  consignees: { row: number; data: { code: string; name: string; address: string; clientCode: string } }[]
}

/** Проверка файла целиком: ничего не меняет, возвращает предпросмотр и список ошибок по строкам. */
export function analyzeImport(db: Db, input: ImportInput): { preview: ImportPreview; plan: Plan } {
  const issues: ImportIssue[] = []
  const lines: ImportPreview['lines'] = { clients: [], users: [], consignees: [] }
  const plan: Plan = { clients: [], users: [], consignees: [] }
  const fail = (sheet: ImportSheet, row: number, title: string, errors: string[]) => {
    errors.forEach((message) => issues.push({ sheet, row, message }))
    lines[sheet].push({ row, title, action: 'error' })
  }
  const regionByName = new Map(db.regions.map((r) => [r.name.toLowerCase(), r.id]))

  // --- Клиенты ---
  const seenCodes = new Set<string>()
  input.clients.forEach((r, i) => {
    const row = i + 2
    const code = norm(r['Код 1С'])
    const e: string[] = []
    if (!code) e.push('Не указан код 1С')
    else if (seenCodes.has(code)) e.push(`Код ${code} повторяется в файле`)
    seenCodes.add(code)
    const name = norm(r['Наименование'])
    if (!name) e.push('Не указано наименование')
    const email = norm(r['Email'])
    if (!isEmail(email)) e.push('Некорректный Email')
    const inn = norm(r['ИНН'])
    if (!isInn(inn)) e.push('ИНН должен содержать 10 или 12 цифр')
    const kpp = norm(r['КПП'])
    if ((inn.length === 10 && !isKpp(kpp)) || (kpp && !isKpp(kpp))) e.push('КПП должен содержать 9 цифр')
    const address = norm(r['Юридический адрес'])
    if (!address) e.push('Не указан юридический адрес')
    const regionNames = norm(r['Регионы'])
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const regionIds = regionNames.map((n) => regionByName.get(n.toLowerCase()))
    if (!regionNames.length) e.push('Не указан регион')
    regionNames.forEach((n, k) => !regionIds[k] && e.push(`Неизвестный регион «${n}»`))
    const existing = db.clients.find((c) => c.code === code)
    if (e.length) return fail('clients', row, `${code || '—'} ${name}`, e)
    const base = {
      code,
      name,
      email,
      inn,
      kpp,
      legalAddress: address,
      phone: norm(r['Телефон']),
      regionIds: regionIds as string[],
      active: yes(norm(r['Активен'])),
    }
    plan.clients.push({
      row,
      data: existing
        ? { ...existing, ...base }
        : {
            ...base,
            businessTypeIds: ['bt-regular'],
            paymentTermIds: [db.paymentTerms[0].id],
            defaultPaymentTermId: db.paymentTerms[0].id,
            deliveryTermIds: db.deliveryTerms.map((d) => d.id),
            canChooseDelivery: false,
            availability: emptyAvailability(),
          },
    })
    lines.clients.push({ row, title: `${code} · ${name}`, action: existing ? 'update' : 'new' })
  })
  const knownCodes = new Set([...db.clients.map((c) => c.code), ...plan.clients.map((c) => c.data.code)])

  // --- Пользователи ---
  const seenEmails = new Set<string>()
  const newUsersByClient = new Map<string, number>()
  input.users.forEach((r, i) => {
    const row = i + 2
    const email = norm(r['Email']).toLowerCase()
    const clientCode = norm(r['Код клиента'])
    const first = norm(r['Имя'])
    const last = norm(r['Фамилия'])
    const e: string[] = []
    if (!isEmail(email)) e.push('Некорректный Email')
    else if (seenEmails.has(email)) e.push('Этот Email повторяется в файле')
    else if (db.users.some((u) => u.email.toLowerCase() === email))
      e.push('Пользователь с таким Email уже есть в системе')
    seenEmails.add(email)
    if (!first || !last) e.push('Укажите имя и фамилию')
    if (!clientCode || !knownCodes.has(clientCode)) e.push(`Клиент с кодом «${clientCode}» не найден`)
    else {
      const client = db.clients.find((c) => c.code === clientCode)
      const existingCount = client ? db.users.filter((u) => u.clientId === client.id).length : 0
      const n = (newUsersByClient.get(clientCode) ?? 0) + 1
      if (existingCount + n > db.settings.clientUserLimit)
        e.push(`Превышен лимит пользователей на клиента (${db.settings.clientUserLimit})`)
      else newUsersByClient.set(clientCode, n)
    }
    if (e.length) return fail('users', row, `${email || '—'}`, e)
    plan.users.push({ row, data: { email, firstName: first, lastName: last, phone: norm(r['Телефон']), clientCode } })
    lines.users.push({ row, title: `${last} ${first} · ${email}`, action: 'new' })
  })

  // --- Грузополучатели ---
  const seenKeys = new Set<string>()
  input.consignees.forEach((r, i) => {
    const row = i + 2
    const code = norm(r['Код'])
    const clientCode = norm(r['Код клиента'])
    const name = norm(r['Наименование'])
    const address = norm(r['Адрес'])
    const e: string[] = []
    if (!code) e.push('Не указан код грузополучателя')
    if (!name) e.push('Не указано наименование')
    if (!address) e.push('Не указан адрес')
    if (!clientCode || !knownCodes.has(clientCode)) e.push(`Клиент с кодом «${clientCode}» не найден`)
    const key = `${clientCode}|${code}`
    if (code && seenKeys.has(key)) e.push('Код грузополучателя повторяется у этого клиента')
    seenKeys.add(key)
    if (e.length) return fail('consignees', row, `${code || '—'} ${name}`, e)
    const client = db.clients.find((c) => c.code === clientCode)
    const existing = client && db.consignees.find((c) => c.clientId === client.id && c.code === code)
    plan.consignees.push({ row, data: { code, name, address, clientCode } })
    lines.consignees.push({ row, title: `${code} · ${name}`, action: existing ? 'update' : 'new' })
  })

  return {
    preview: { lines, issues, counts: countLines(lines) },
    plan,
  }
}

/** Применяет только корректные строки. Возвращает, сколько записей создано и обновлено. */
export function applyImport(db: Db, input: ImportInput): ImportCounts & { invites: number } {
  const { preview, plan } = analyzeImport(db, input)
  let invites = 0

  for (const { data } of plan.clients) {
    const idx = db.clients.findIndex((c) => c.code === data.code)
    if (idx >= 0) db.clients[idx] = { ...db.clients[idx], ...data, id: db.clients[idx].id } as Client
    else db.clients.push({ ...data, id: newId('cl') } as Client)
  }

  for (const { data } of plan.users) {
    const client = db.clients.find((c) => c.code === data.clientCode)!
    const user: User = {
      id: newId('c'),
      email: data.email,
      password: '',
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      roleId: 'role-client',
      kind: 'client',
      status: 'invited',
      clientId: client.id,
      notifyEmail: true,
    }
    db.users.push(user)
    sendInvite(db, user)
    invites++
  }

  for (const { data } of plan.consignees) {
    const client = db.clients.find((c) => c.code === data.clientCode)!
    const existing = db.consignees.find((c) => c.clientId === client.id && c.code === data.code)
    if (existing) Object.assign(existing, { name: data.name, address: data.address })
    else {
      const row: Consignee = {
        id: newId('cs'),
        clientId: client.id,
        code: data.code,
        name: data.name,
        address: data.address,
      }
      db.consignees.push(row)
    }
  }
  return { ...preview.counts, invites }
}
