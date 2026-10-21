import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { ImportFlow } from '@/shared/ui/ImportFlow'
import type { ImportInput, ImportSheet } from '@/mocks/clientsImport'
import { useApplyClientImportMutation, usePreviewClientImportMutation } from '../clientsApi'
import { downloadTemplate, readImportFile } from './importFiles'

const t = ru.clients.import

/** Импорт клиентов, пользователей и грузополучателей из Excel. */
export default function ClientsImportPage() {
  const [check] = usePreviewClientImportMutation()
  const [apply] = useApplyClientImportMutation()
  return (
    <ImportFlow<ImportInput, ImportSheet>
      title={t.title}
      subtitle={t.subtitle}
      backLabel={ru.clients.card.back}
      backPath="/clients"
      templateHint={t.templateHint}
      sheets={t.sheets}
      downloadTemplate={downloadTemplate}
      readFile={readImportFile}
      check={check}
      apply={apply}
      doneText={(r) => t.doneText(r.new, r.update, r.invites ?? 0)}
      doneNote={t.newDefaults}
      errorMessage={errorMessage}
    />
  )
}
