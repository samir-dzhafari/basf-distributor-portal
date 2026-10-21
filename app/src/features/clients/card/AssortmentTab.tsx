import { useState } from 'react'
import { Alert, App, Button, Space } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import type { Client } from '@/shared/types/domain'
import { useUpdateConditionsMutation, type ClientDetail } from '../clientsApi'
import { AssortmentEditor } from './AssortmentEditor'
import { conditionsOf } from './ConditionsTab'

const t = ru.clients.assortment

const same = (a: Client['availability'], b: Client['availability']) => JSON.stringify(a) === JSON.stringify(b)

/** Ассортимент клиента: изменения копятся и сохраняются кнопкой. */
export function AssortmentTab({ detail }: { detail: ClientDetail }) {
  const { message } = App.useApp()
  const { client, refs } = detail
  const [value, setValue] = useState(client.availability)
  const [update, { isLoading }] = useUpdateConditionsMutation()
  const dirty = !same(value, client.availability)

  const onSave = async () => {
    const r = await update({ id: client.id, conditions: { ...conditionsOf(client), availability: value } })
    if ('error' in r) message.error(errorMessage(r.error))
    else message.success(t.saved)
  }

  return (
    <div>
      <AssortmentEditor value={value} refs={refs} businessTypeIds={client.businessTypeIds} onChange={setValue} />
      <div className="wizard-footer">
        <div className="wizard-footer__mid" style={{ textAlign: 'left' }}>
          {dirty ? (
            <Alert type="warning" showIcon message={t.dirty} banner style={{ background: 'transparent', padding: 0 }} />
          ) : null}
        </div>
        <Space>
          <Button size="large" disabled={!dirty} onClick={() => setValue(client.availability)}>
            {t.reset}
          </Button>
          <Button type="primary" size="large" disabled={!dirty} loading={isLoading} onClick={onSave}>
            {t.save}
          </Button>
        </Space>
      </div>
    </div>
  )
}
