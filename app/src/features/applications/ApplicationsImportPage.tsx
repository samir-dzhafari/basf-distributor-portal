import { errorMessage } from '@/app/api'
import { APPLICATIONS_SHEET, APPLICATION_HEADERS, type ApplicationsImportInput } from '@/mocks/applicationsImport'
import { ru } from '@/shared/i18n/ru'
import { downloadTemplate, readImport, type SheetSpec } from '@/shared/lib/xlsxImport'
import { ImportFlow } from '@/shared/ui/ImportFlow'
import { useApplyApplicationsImportMutation, usePreviewApplicationsImportMutation } from './applicationsApi'

const t = ru.applications.importPage

const spec: SheetSpec = {
  sheet: APPLICATIONS_SHEET,
  headers: APPLICATION_HEADERS,
  example: [
    '138-ДС1-ОСН_ЮГ',
    '1234567',
    'Юг',
    'Регулярный',
    '01.01.2026',
    '31.12.2026',
    'Да',
    'i.voronova@basf-demo.ru, s.alekhin@basf-demo.ru',
  ],
}

/** Массовая загрузка приложений и ответственных. */
export default function ApplicationsImportPage() {
  const [check] = usePreviewApplicationsImportMutation()
  const [apply] = useApplyApplicationsImportMutation()
  return (
    <ImportFlow<ApplicationsImportInput, 'applications'>
      title={t.title}
      subtitle={t.subtitle}
      backLabel={t.back}
      backPath="/applications"
      templateHint={`${t.hint} ${ru.importFlow.templateNote}`}
      sheets={{ applications: APPLICATIONS_SHEET }}
      downloadTemplate={() => downloadTemplate('shablon-prilozheniy.xlsx', [spec])}
      readFile={(f) => readImport(f, { applications: spec })}
      check={check}
      apply={apply}
      doneText={(r) => t.done(r.new, r.update)}
      errorMessage={errorMessage}
    />
  )
}
