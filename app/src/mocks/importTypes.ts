/** Общие типы импорта из Excel: клиенты, продукты и цены, приложения. */
export type ImportRow = Record<string, string>

export interface ImportIssue<K extends string = string> {
  sheet: K
  /** Номер строки в Excel (с учётом заголовка). */
  row: number
  message: string
}

export interface ImportLine {
  row: number
  title: string
  action: 'new' | 'update' | 'error'
  /** Что именно изменится (для обновлений), например «Цена: 1 200 → 1 350». */
  detail?: string
}

export interface ImportCounts {
  new: number
  update: number
  error: number
}

export interface ImportPreview<K extends string = string> {
  lines: Record<K, ImportLine[]>
  issues: ImportIssue<K>[]
  counts: ImportCounts
}

export const norm = (v: unknown) => String(v ?? '').trim()
export const yes = (v: string) => !['нет', 'no', '0', 'false', 'n'].includes(v.trim().toLowerCase())

export function countLines<K extends string>(lines: Record<K, ImportLine[]>): ImportCounts {
  const all = (Object.values(lines) as ImportLine[][]).flat()
  const count = (a: ImportLine['action']) => all.filter((l) => l.action === a).length
  return { new: count('new'), update: count('update'), error: count('error') }
}
