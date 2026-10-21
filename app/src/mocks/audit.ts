import type { AuditChange, AuditEntity, Id, User } from '@/shared/types/domain'
import { newId } from './db'
import type { Db } from './seed'

export interface AuditInput {
  entity: AuditEntity
  entityId?: Id
  entityName: string
  /** Короткое действие: «Создан», «Изменён», «Удалён», «Деактивирован»… */
  action: string
  summary?: string
  changes?: AuditChange[]
}

/** Записывает действие в журнал (фич-лист 14.1): автор, время, объект, что изменено. */
export function audit(db: Db, user: Pick<User, 'id'> | Id, input: AuditInput) {
  db.audit.unshift({
    id: newId('au'),
    at: new Date().toISOString(),
    userId: typeof user === 'string' ? user : user.id,
    entity: input.entity,
    entityId: input.entityId,
    entityName: input.entityName,
    action: input.action,
    summary: input.summary,
    changes: input.changes ?? [],
  })
  if (db.audit.length > 3000) db.audit.length = 3000
}

const show = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'да' : 'нет'
  if (Array.isArray(v)) return v.length ? v.map(String).join(', ') : '—'
  return String(v)
}

/** Сравнивает два состояния объекта и возвращает только изменившиеся поля с понятными названиями. */
export function diff<T extends object>(
  before: T,
  after: Partial<T>,
  labels: Partial<Record<keyof T, string>>,
  format: Partial<Record<keyof T, (v: unknown) => string>> = {},
): AuditChange[] {
  const out: AuditChange[] = []
  for (const key of Object.keys(labels) as (keyof T)[]) {
    if (!(key in after)) continue
    const a = before[key]
    const b = after[key]
    if (JSON.stringify(a) === JSON.stringify(b)) continue
    const f = format[key] ?? show
    out.push({ field: labels[key] as string, from: f(a), to: f(b) })
  }
  return out
}
