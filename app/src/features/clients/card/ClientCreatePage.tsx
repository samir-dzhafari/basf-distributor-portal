import { useNavigate } from 'react-router-dom'
import { App, Button, Card } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useCreateClientMutation } from '../clientsApi'
import { useRegions } from './useRegions'
import { RequisitesForm, emptyRequisites } from './RequisitesForm'

const t = ru.clients.create

export default function ClientCreatePage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [create, { isLoading }] = useCreateClientMutation()
  const regions = useRegions()

  return (
    <>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        style={{ paddingLeft: 0, marginBottom: 8 }}
        onClick={() => navigate('/clients')}
      >
        {ru.clients.card.back}
      </Button>
      <PageHeader title={t.title} subtitle={t.hint} />
      <Card style={{ maxWidth: 900 }}>
        <RequisitesForm
          initial={emptyRequisites()}
          regions={regions}
          submitLabel={t.submit}
          submitting={isLoading}
          onSubmit={async (v) => {
            const r = await create(v)
            if ('error' in r) return void message.error(errorMessage(r.error))
            message.success(t.created)
            navigate(`/clients/${r.data.id}?tab=conditions`)
          }}
        />
      </Card>
    </>
  )
}
