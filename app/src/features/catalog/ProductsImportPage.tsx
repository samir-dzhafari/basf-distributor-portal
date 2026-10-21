import { errorMessage } from '@/app/api'
import { PRODUCTS_SHEET, PRODUCT_HEADERS, type ProductsImportInput } from '@/mocks/productsImport'
import { ru } from '@/shared/i18n/ru'
import { downloadTemplate, readImport, type SheetSpec } from '@/shared/lib/xlsxImport'
import { ImportFlow } from '@/shared/ui/ImportFlow'
import { useApplyProductsImportMutation, usePreviewProductsImportMutation } from './catalogApi'

const t = ru.catalog.importPage

const spec: SheetSpec = {
  sheet: PRODUCTS_SHEET,
  headers: PRODUCT_HEADERS,
  example: [
    '5890001',
    'Пример Плюс 10 л',
    'Фунгициды',
    'Зерновые',
    'Регулярный, СЗР',
    '10',
    'л',
    '20',
    '10',
    'Да',
    '2 450',
    '01.12.2026',
  ],
}

/** Импорт продуктов и цен: предпросмотр с ценами «было → станет» и отчёт об ошибках. */
export default function ProductsImportPage() {
  const [check] = usePreviewProductsImportMutation()
  const [apply] = useApplyProductsImportMutation()
  return (
    <ImportFlow<ProductsImportInput, 'products'>
      title={t.title}
      subtitle={t.subtitle}
      backLabel={t.back}
      backPath="/catalog/products"
      templateHint={`${t.hint} ${ru.importFlow.templateNote}`}
      sheets={{ products: PRODUCTS_SHEET }}
      downloadTemplate={() => downloadTemplate('shablon-produktov-i-cen.xlsx', [spec])}
      readFile={(f) => readImport(f, { products: spec })}
      check={check}
      apply={apply}
      doneText={(r) => t.done(r.new, r.update)}
      errorMessage={errorMessage}
    />
  )
}
