import type { Application, Id } from '@/shared/types/domain'
import { parseDate } from './productsImport'
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

export const APPLICATIONS_SHEET = 'Приложения'
export const APPLICATION_HEADERS = [
  'Номер приложения',
  'Код клиента',
  'Регион',
  'Тип бизнеса',
  'Действует с',
  'Действует по',
  'Активно',
  'Ответственные (почта)',
] as const

export type ApplicationsImportInput = { applications: ImportRow[] }
export type ApplicationsPreview = ImportPreview<'applications'>

interface PlanItem {
  row: number
  data: Omit<Application, 'id'>
  existingId?: Id
}

/** Проверка файла приложений и ответственных. Ничего не меняет. */
export function analyzeApplicationsImport(
  db: Db,
  input: ApplicationsImportInput,
  /** Клиенты, которыми вправе управлять пользователь. */
  allowedClientIds: Set<Id>,
): { preview: ApplicationsPreview; plan: PlanItem[] } {
  const issues: ImportIssue<'applications'>[] = []
  const lines: Record<'applications', ImportLine[]> = { applications: [] }
  const plan: PlanItem[] = []
  const seen = new Set<string>()
  const employees = db.users.filter((u) => u.kind === 'employee')

  input.applications.forEach((r, i) => {
    const row = i + 2
    const number = norm(r['Номер приложения'])
    const e: string[] = []
    if (!number) e.push('Не указан номер приложения')
    else if (seen.has(number.toLowerCase())) e.push(`Номер ${number} повторяется в файле`)
    seen.add(number.toLowerCase())
    const client = db.clients.find((c) => c.code === norm(r['Код клиента']))
    if (!client || !allowedClientIds.has(client.id)) e.push(`Клиент с кодом «${norm(r['Код клиента'])}» не найден`)
    const region = db.regions.find((x) => x.name.toLowerCase() === norm(r['Регион']).toLowerCase())
    if (!region) e.push(`Неизвестный регион «${norm(r['Регион'])}»`)
    else if (client && !client.regionIds.includes(region.id)) e.push('Регион не относится к этому клиенту')
    const bt = db.businessTypes.find((x) => x.name.toLowerCase() === norm(r['Тип бизнеса']).toLowerCase())
    if (!bt) e.push(`Неизвестный тип бизнеса «${norm(r['Тип бизнеса'])}»`)
    else if (client && !client.businessTypeIds.includes(bt.id)) e.push('Тип бизнеса не открыт этому клиенту')
    const from = parseDate(norm(r['Действует с']))
    const to = norm(r['Действует по']) ? parseDate(norm(r['Действует по'])) : null
    if (!norm(r['Действует с']) || !from) e.push('Дата «Действует с»: ДД.ММ.ГГГГ')
    if (!to) e.push('Дата «Действует по»: ДД.ММ.ГГГГ')
    else if (from && to < from) e.push('Дата окончания раньше начала')
    const emails = norm(r['Ответственные (почта)'])
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    const responsibleIds: Id[] = []
    emails.forEach((m) => {
      const u = employees.find((x) => x.email.toLowerCase() === m)
      if (u) responsibleIds.push(u.id)
      else e.push(`Сотрудник с почтой «${m}» не найден`)
    })
    if (e.length) {
      e.forEach((message) => issues.push({ sheet: 'applications', row, message }))
      lines.applications.push({ row, title: number || '—', action: 'error' })
      return
    }
    const existing = db.applications.find((a) => a.number.toLowerCase() === number.toLowerCase())
    plan.push({
      row,
      existingId: existing?.id,
      data: {
        number,
        clientId: client!.id,
        regionId: region!.id,
        businessTypeId: bt!.id,
        validFrom: from!,
        validTo: to!,
        active: norm(r['Активно']) ? yes(norm(r['Активно'])) : true,
        responsibleIds,
      },
    })
    lines.applications.push({
      row,
      title: `${number} · ${client!.name}`,
      action: existing ? 'update' : 'new',
      detail: `Ответственных: ${responsibleIds.length}`,
    })
  })
  return { preview: { lines, issues, counts: countLines(lines) }, plan }
}

export function applyApplicationsImport(db: Db, input: ApplicationsImportInput, allowed: Set<Id>): ImportCounts {
  const { preview, plan } = analyzeApplicationsImport(db, input, allowed)
  for (const item of plan) {
    const existing = item.existingId ? db.applications.find((a) => a.id === item.existingId) : undefined
    if (existing) Object.assign(existing, item.data)
    else db.applications.push({ ...item.data, id: newId('ap') })
  }
  return preview.counts
}
