import { IMPORT_HEADERS, IMPORT_SHEETS, type ImportInput, type ImportSheet } from '@/mocks/clientsImport'
import { ImportFileError, downloadTemplate as download, readImport, type SheetSpec } from '@/shared/lib/xlsxImport'

export { ImportFileError }

const SHEETS = Object.keys(IMPORT_SHEETS) as ImportSheet[]

const EXAMPLES: Record<ImportSheet, string[]> = {
  clients: [
    '1234567',
    'ООО «Пример»',
    'info@primer.ru',
    '7701234567',
    '770101001',
    'г. Москва, ул. Тверская, д. 1',
    '+7 495 123-45-67',
    'Юг, Север',
    'Да',
  ],
  users: ['ivan@primer.ru', 'Иван', 'Петров', '+7 900 123-45-67', '1234567'],
  consignees: ['G-001', 'ООО «Пример» — склад', 'г. Москва, Складской пр., д. 5', '1234567'],
}

const spec = (s: ImportSheet): SheetSpec => ({
  sheet: IMPORT_SHEETS[s],
  headers: IMPORT_HEADERS[s],
  example: EXAMPLES[s],
})

export const clientSpecs: Record<ImportSheet, SheetSpec> = {
  clients: spec('clients'),
  users: spec('users'),
  consignees: spec('consignees'),
}
export const downloadTemplate = () =>
  download(
    'shablon-importa-klientov.xlsx',
    SHEETS.map((s) => clientSpecs[s]),
  )

export const readImportFile = (file: File): Promise<ImportInput> => readImport(file, clientSpecs)
