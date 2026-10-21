import { useState } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { App, Button, Skeleton, Space, Table, Tag } from 'antd'
import { CopyOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { PageHeader } from '@/shared/ui/PageHeader'
import { RoleDrawer, type RoleDraft } from './RoleDrawer'
import { useListRolesQuery, useSaveRoleMutation, type RoleRow } from './rolesApi'

const t = ru.roles

export default function RolesPage() {
  const { message } = App.useApp()
  const { data, isLoading, isError, error, refetch } = useListRolesQuery()
  const [save] = useSaveRoleMutation()
  const [editing, setEditing] = useState<{ role: RoleRow | null; draft?: RoleDraft } | undefined>()

  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />
  if (isError || !data) return <ErrorState error={error} onRetry={refetch} />

  const toggleActive = async (r: RoleRow) => {
    const res = await save({
      id: r.id,
      name: r.name,
      type: r.type,
      description: r.description,
      permissions: r.permissions,
      active: !r.active,
    })
    if ('error' in res) message.error(errorMessage(res.error), 6)
    else message.success(t.drawer.saved)
  }

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        extra={
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setEditing({ role: null })}>
            {t.newRole}
          </Button>
        }
      />
      <Table<RoleRow>
        rowKey="id"
        dataSource={data}
        pagination={false}
        scroll={{ x: 'max-content' }}
        rowClassName={(r) => (r.active ? '' : 'row-closed')}
        columns={[
          {
            title: t.columns.name,
            render: (_, r) => (
              <>
                <strong>{r.name}</strong> {r.fullAccess && <Tag color="purple">{t.system}</Tag>}
                <div className="muted" style={{ fontSize: 13 }}>
                  {r.description}
                </div>
              </>
            ),
          },
          { title: t.columns.type, render: (_, r) => t.type[r.type] },
          { title: t.columns.perms, render: (_, r) => (r.fullAccess ? t.all : t.permsCount(r.permissions.length)) },
          { title: t.columns.users, dataIndex: 'usersCount', align: 'right' },
          {
            title: t.columns.status,
            render: (_, r) => <Tag color={r.active ? 'green' : 'default'}>{r.active ? t.active : t.inactive}</Tag>,
          },
          {
            title: '',
            render: (_, r) => (
              <Space wrap>
                <Button icon={<EditOutlined />} onClick={() => setEditing({ role: r })}>
                  {t.edit}
                </Button>
                {!r.fullAccess && (
                  <>
                    <Button
                      icon={<CopyOutlined />}
                      onClick={() =>
                        setEditing({
                          role: null,
                          draft: {
                            name: t.copyName(r.name),
                            type: r.type,
                            description: r.description,
                            permissions: r.permissions,
                            active: true,
                          },
                        })
                      }
                    >
                      {t.copy}
                    </Button>
                    <Button onClick={() => toggleActive(r)}>{r.active ? t.disable : t.enable}</Button>
                  </>
                )}
              </Space>
            ),
          },
        ]}
      />
      {editing && (
        <RoleDrawer
          key={editing.role?.id ?? editing.draft?.name ?? 'new'}
          role={editing.role}
          draft={editing.draft}
          open
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  )
}
