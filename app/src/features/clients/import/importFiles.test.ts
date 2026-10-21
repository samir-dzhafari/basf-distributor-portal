import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { IMPORT_HEADERS, IMPORT_SHEETS } from '@/mocks/clientsImport'
import { ImportFileError, readImportFile } from './importFiles'

const book = (sheets: Record<string, unknown[][]>) => {
  const wb = XLSX.utils.book_new()
  Object.entries(sheets).forEach(([name, aoa]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name))
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buf], 'import.xlsx')
}

describe('чтение файла импорта', () => {
  it('читает три листа, приводит значения к тексту и пропускает пустые строки', async () => {
    const file = book({
      [IMPORT_SHEETS.clients]: [
        [...IMPORT_HEADERS.clients],
        ['1234567', ' ООО «Тест» ', 't@t.ru', 7701234567, '770101001', 'г. Москва', '+7 900 111-22-33', 'Юг', 'Да'],
        ['', '', '', '', '', '', '', '', ''],
      ],
      [IMPORT_SHEETS.users]: [[...IMPORT_HEADERS.users], ['a@b.ru', 'Иван', 'Петров', '', '1234567']],
    })
    const input = await readImportFile(file)
    expect(input.clients).toHaveLength(1)
    expect(input.clients[0]['Наименование']).toBe('ООО «Тест»')
    expect(input.clients[0]['ИНН']).toBe('7701234567')
    expect(input.users).toHaveLength(1)
    expect(input.consignees).toEqual([])
  })

  it('отклоняет файл без нужных колонок и файл не из шаблона', async () => {
    const wrongHeaders = book({
      [IMPORT_SHEETS.users]: [
        ['Почта', 'ФИО'],
        ['a@b.ru', 'Иван'],
      ],
    })
    await expect(readImportFile(wrongHeaders)).rejects.toThrow(/не хватает колонок/)
    const noSheets = book({ Лист1: [['x']] })
    await expect(readImportFile(noSheets)).rejects.toBeInstanceOf(ImportFileError)
  })
})
