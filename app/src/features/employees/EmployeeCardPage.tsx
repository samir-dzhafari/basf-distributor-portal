import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Alert, App, Button, Result, Skeleton, Space, Tabs, Tag } from 'antd'
import { ArrowLeftOutlined, MailOutlined, StopOutlined, UndoOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { PageHeader } from '@/shared/ui/PageHeader'
import { DeactivateModal } from './DeactivateModal'
import { EmployeeForm, InviteAlert } from './EmployeeForm'
import { SubordinatesTab } from './SubordinatesTab'
import { VisibilityTab } from './VisibilityTab'
import { ZoneTab } from './ZoneTab'
import {
  useActivateEmployeeMutation,
  useGetEmployeeQuery,
  useSaveEmployeeMutation,
  useSendEmployeeInviteMutation,
} from './employeesApi'

const t = ru.employees
const TABS = ['data', 'zone', 'subs', 'visibility'] as const
type Tab = (typeof TABS)[number]
const STATUS_COLOR = { active: 'green', invited: 'gold', blocked: 'red' } as const

export default function EmployeeCardPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [params, setParams] = useSearchParams()
  const { data, isLoading, isError, error } = useGetEmployeeQuery(id)
  const [save, { isLoading: saving }] = useSaveEmployeeMutation()
  const [sendInvite] = useSendEmployeeInviteMutation()
  const [activate] = useActivateEmployeeMutation()
  const [deactivating, setDeactivating] = useState(false)
  const [invite, setInvite] = useState<string>()

  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'data'
  const goTab = (k: string) => setParams(k === 'data' ? {} : { tab: k }, { replace: true })

  const back = (
    <Button
      type="link"
      icon={<ArrowLeftOutlined />}
      style={{ paddingLeft: 0, marginBottom: 8 }}
      onClick={() => navigate('/admin/employees')}
    >
      {t.card.back}
    </Button>
  )

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />
  if (isError || !data) {
    return (
      <>
        {back}
        <Result status="404" title={t.card.notFound} />
        <Alert type="info" message={errorMessage(error)} />
      </>
    )
  }

  const { user, role, refs } = data
  const blocked = user.status === 'blocked'
  const subIds = new Set(data.subordinates.map((s) => s.id))
  const managers = refs.employees.filter((e) => e.status !== 'blocked' && e.id !== user.id && !subIds.has(e.id))
  // Текущий руководитель остаётся в списке, даже если он деактивирован, чтобы форма его показывала.
  if (data.manager && !managers.some((m) => m.id === data.manager!.id))
    managers.push({ id: data.manager.id, name: data.manager.name, status: 'blocked' })

  const onInvite = async () => {
    const r = await sendInvite(user.id)
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.invite.sent)
    setInvite(r.data.inviteLink)
  }
  const onActivate = async () => {
    const r = await activate(user.id)
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.deactivate.activated)
    if (r.data.inviteLink) setInvite(r.data.inviteLink)
  }

  return (
    <>
      {back}
      <PageHeader
        title={`${user.lastName} ${user.firstName}`}
        subtitle={`${role.name} · ${user.email}`}
        extra={
          <Space wrap>
            <Tag color={STATUS_COLOR[user.status]} style={{ fontSize: 14, padding: '2px 10px' }}>
              {t.statusTag[user.status]}
            </Tag>
            {user.status === 'invited' && (
              <Button icon={<MailOutlined />} onClick={onInvite}>
                {t.invite.send}
              </Button>
            )}
            {blocked ? (
              <Button icon={<UndoOutlined />} onClick={onActivate}>
                {t.deactivate.activate}
              </Button>
            ) : (
              <Button
                danger
                icon={<StopOutlined />}
                disabled={data.isSelf}
                title={data.isSelf ? t.deactivate.self : undefined}
                onClick={() => setDeactivating(true)}
              >
                {t.deactivate.button}
              </Button>
            )}
          </Space>
        }
      />
      {invite && <InviteAlert link={invite} onClose={() => setInvite(undefined)} />}
      {!invite && data.inviteLink && user.status === 'invited' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t.invite.demo}
          description={<Link to={data.inviteLink}>{t.invite.open}</Link>}
        />
      )}

      <Tabs
        activeKey={tab}
        onChange={goTab}
        items={[
          {
            key: 'data',
            label: t.card.tabs.data,
            children: (
              <div style={{ maxWidth: 860 }}>
                <EmployeeForm
                  key={`${user.id}-${user.roleId}-${user.managerId}-${user.email}-${user.firstName}`}
                  initial={{
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phone,
                    roleId: user.roleId,
                    managerId: user.managerId,
                  }}
                  roles={refs.roles}
                  managers={managers}
                  roleLocked={data.isSelf}
                  submitLabel={ru.common.save}
                  submitting={saving}
                  onSubmit={async (v) => {
                    const r = await save({ ...v, id: user.id })
                    if ('error' in r) message.error(errorMessage(r.error))
                    else message.success(t.form.saved)
                  }}
                />
              </div>
            ),
          },
          {
            key: 'zone',
            label: t.card.tabs.zone,
            children: (
              <ZoneTab key={JSON.stringify(data.zone)} detail={data} onShowVisibility={() => goTab('visibility')} />
            ),
          },
          {
            key: 'subs',
            label: `${t.card.tabs.subs} (${data.subordinates.length})`,
            children: <SubordinatesTab detail={data} />,
          },
          {
            key: 'visibility',
            label: t.card.tabs.visibility,
            children: tab === 'visibility' ? <VisibilityTab employeeId={user.id} /> : null,
          },
        ]}
      />
      <DeactivateModal detail={data} open={deactivating} onClose={() => setDeactivating(false)} />
    </>
  )
}
