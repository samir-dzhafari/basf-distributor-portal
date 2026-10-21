import dayjs from 'dayjs'
import type { ImportIssue, ImportRow } from '@/mocks/importTypes'
import { ru } from '@/shared/i18n/ru'

/** Описание листа шаблона: название, колонки (фиксированные) и строка-пример. */
export interface SheetSpec {
  sheet: string
  headers: readonly string[]
  example?: string[]
}

export class ImportFileError extends Error {}

/** Скачивает шаблон: листы с заголовками и строкой-примером. */
export async function downloadTemplate(fileName: string, specs: SheetSpec[]) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  specs.forEach((s) => {
    const ws = XLSX.utils.aoa_to_sheet([[...s.headers], ...(s.example ? [s.example] : [])])
    ws['!cols'] = s.headers.map((h) => ({ wch: Math.max(h.length, 18) + 4 }))
    XLSX.utils.book_append_sheet(wb, ws, s.sheet)
  })
  XLSX.writeFile(wb, fileName)
}

/**
 * Читает файл по шаблону. Структура фиксированная: нужный лист и все колонки должны быть на месте.
 * Значения приводятся к тексту, пустые строки пропускаются.
 */
export async function readImport<K extends string>(
  file: File,
  specs: Record<K, SheetSpec>,
): Promise<Record<K, ImportRow[]>> {
  const XLSX = await import('xlsx')
  let wb
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  } catch {
    throw new ImportFileError(ru.importFlow.fileError)
  }
  const keys = Object.keys(specs) as K[]
  const result = Object.fromEntries(keys.map((k) => [k, [] as ImportRow[]])) as Record<K, ImportRow[]>
  let found = 0
  for (const k of keys) {
    const spec = specs[k]
    const ws = wb.Sheets[spec.sheet]
    if (!ws) continue
    found++
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })
    if (rows.length) {
      const present = Object.keys(rows[0])
      const missing = spec.headers.filter((h) => !present.includes(h))
      if (missing.length) throw new ImportFileError(ru.importFlow.headersError(spec.sheet, missing.join(', ')))
    }
    result[k] = rows
      .map((r): ImportRow => Object.fromEntries(Object.entries(r).map(([key, v]) => [key, String(v ?? '').trim()])))
      .filter((r) => Object.values(r).some(Boolean))
  }
  if (!found) throw new ImportFileError(ru.importFlow.noSheets)
  return result
}

/** Отчёт об ошибках — файл Excel с листом «Ошибки». */
export async function downloadErrorReport(issues: ImportIssue[], labels: Record<string, string>) {
  const XLSX = await import('xlsx')
  const rows = issues.map((i) => ({ Лист: labels[i.sheet] ?? i.sheet, Строка: i.row, Ошибка: i.message }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 70 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ошибки')
  XLSX.writeFile(wb, `oshibki-importa_${dayjs().format('YYYY-MM-DD_HHmm')}.xlsx`)
}
