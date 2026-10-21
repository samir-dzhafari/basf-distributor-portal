import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Alert, App, Button, Popconfirm, Result, Skeleton, Space, Switch, Tabs, Tag } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useGetClientQuery, useSetClientsActiveMutation, useUpdateRequisitesMutation } from '../clientsApi'
import { AssortmentTab } from './AssortmentTab'
import { ConditionsTab } from './ConditionsTab'
import { ConsigneesTab } from './ConsigneesTab'
import { RequisitesForm } from './RequisitesForm'
import { UsersTab } from './UsersTab'

const t = ru.clients
const TABS = ['requisites', 'users', 'consignees', 'conditions', 'assortment'] as const
type Tab = (typeof TABS)[number]

export default function ClientCardPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [params, setParams] = useSearchParams()
  const { data, isLoading, isError, error } = useGetClientQuery(id)
  const [updateRequisites, { isLoading: saving }] = useUpdateRequisitesMutation()
  const [setActive] = useSetClientsActiveMutation()

  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'requisites'

  const back = (
    <Button
      type="link"
      icon={<ArrowLeftOutlined />}
      style={{ paddingLeft: 0, marginBottom: 8 }}
      onClick={() => navigate('/clients')}
    >
      {t.card.back}
    </Button>
  )

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />
  if (isError || !data) {
    return (
      <>
        {back}
        <Result status="404" title={t.card.notFoundTitle} subTitle={t.card.notFoundText} />
        <Alert type="info" message={errorMessage(error)} />
      </>
    )
  }

  const { client } = data

  const toggleActive = async (active: boolean) => {
    const r = await setActive({ ids: [client.id], active })
    if ('error' in r) message.error(errorMessage(r.error))
    else message.success(t.activeChanged(1, active))
  }

  const labels = t.card.tabs
  return (
    <>
      {back}
      <PageHeader
        title={client.name}
        subtitle={`${ru.clients.columns.code}: ${client.code} · ${t.card.orders(data.ordersCount)}`}
        extra={
          <Space size={12}>
            <Tag color={client.active ? 'green' : 'default'} style={{ fontSize: 14, padding: '2px 10px' }}>
              {client.active ? t.activeTag : t.inactiveTag}
            </Tag>
            {client.active ? (
              <Popconfirm
                title={t.disableTitle}
                description={t.disableText}
                okText={t.disableOk}
                cancelText={t.cancel}
                okButtonProps={{ danger: true }}
                onConfirm={() => toggleActive(false)}
              >
                <Switch checked aria-label={t.requisites.active} />
              </Popconfirm>
            ) : (
              <Switch checked={false} onChange={() => toggleActive(true)} aria-label={t.requisites.active} />
            )}
          </Space>
        }
      />
      <Tabs
        activeKey={tab}
        onChange={(k) => setParams(k === 'requisites' ? {} : { tab: k }, { replace: true })}
        items={[
          {
            key: 'requisites',
            label: labels.requisites,
            children: (
              <div style={{ maxWidth: 860 }}>
                <RequisitesForm
                  key={client.id}
                  initial={client}
                  regions={data.refs.regions}
                  submitLabel={ru.common.save}
                  submitting={saving}
                  onSubmit={async (v) => {
                    const r = await updateRequisites({ id: client.id, ...v })
                    if ('error' in r) message.error(errorMessage(r.error))
                    else message.success(t.requisites.saved)
                  }}
                />
              </div>
            ),
          },
          { key: 'users', label: `${labels.users} (${data.users.length})`, children: <UsersTab detail={data} /> },
          {
            key: 'consignees',
            label: `${labels.consignees} (${data.consignees.length})`,
            children: <ConsigneesTab detail={data} />,
          },
          {
            key: 'conditions',
            label: labels.conditions,
            children: (
              <ConditionsTab
                key={JSON.stringify([
                  client.paymentTermIds,
                  client.businessTypeIds,
                  client.deliveryTermIds,
                  client.vatRate,
                  client.groupId,
                ])}
                detail={data}
              />
            ),
          },
          {
            key: 'assortment',
            label: labels.assortment,
            children: <AssortmentTab key={JSON.stringify(client.availability)} detail={data} />,
          },
        ]}
      />
    </>
  )
}
