import { useState } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { App, Button, Card, Checkbox, Empty, List, Modal, Popconfirm, Skeleton, Space, Tag, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import {
  useApplyGroupTemplateMutation,
  useDeleteClientGroupMutation,
  useGetClientRefsQuery,
  useListClientGroupsQuery,
  type ConditionSection,
  type GroupRow,
} from '../clientsApi'
import { GroupDrawer } from './GroupDrawer'

const t = ru.clients.groups
const SECTIONS: ConditionSection[] = ['payment', 'business', 'delivery', 'vat', 'assortment']

/** Группы клиентов: объединение клиентов и массовое назначение условий и ассортимента. */
export function GroupsTab() {
  const { message } = App.useApp()
  const { data, isLoading, isError, error, refetch } = useListClientGroupsQuery()
  const { data: refs } = useGetClientRefsQuery()
  const [editing, setEditing] = useState<GroupRow | null | undefined>(undefined)
  const [applying, setApplying] = useState<GroupRow | null>(null)
  const [sections, setSections] = useState<ConditionSection[]>(['payment'])
  const [remove] = useDeleteClientGroupMutation()
  const [apply, { isLoading: applyingNow }] = useApplyGroupTemplateMutation()

  if (isLoading) return <Skeleton active paragraph={{ rows: 5 }} />
  if (isError || !data) return <ErrorState error={error} onRetry={refetch} />

  const onApply = async () => {
    if (!applying) return
    const r = await apply({ groupId: applying.id, sections })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.applied(r.data.applied))
    setApplying(null)
  }

  return (
    <div>
      <div className="tab-head">
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          {t.hint}
        </Typography.Paragraph>
        <Button type="primary" size="large" icon={<PlusOutlined />} disabled={!refs} onClick={() => setEditing(null)}>
          {t.add}
        </Button>
      </div>

      {data.groups.length === 0 ? (
        <Card>
          <Empty description={t.empty} />
        </Card>
      ) : (
        <List
          grid={{ gutter: 16, xs: 1, lg: 2 }}
          dataSource={data.groups}
          renderItem={(g) => (
            <List.Item>
              <Card
                title={g.name}
                extra={<Tag>{t.membersCount(g.memberIds.length)}</Tag>}
                actions={[
                  <Button key="e" type="text" icon={<EditOutlined />} disabled={!refs} onClick={() => setEditing(g)}>
                    {t.edit}
                  </Button>,
                  <Button
                    key="a"
                    type="text"
                    icon={<ThunderboltOutlined />}
                    disabled={!g.memberIds.length}
                    title={g.memberIds.length ? t.apply : t.noMembers}
                    onClick={() => {
                      setSections(['payment'])
                      setApplying(g)
                    }}
                  >
                    {t.applyShort}
                  </Button>,
                  <Popconfirm
                    key="d"
                    title={t.removeTitle}
                    description={t.removeText}
                    okText={t.remove}
                    cancelText={ru.clients.cancel}
                    okButtonProps={{ danger: true }}
                    onConfirm={async () => {
                      await remove(g.id)
                      message.success(t.removed)
                    }}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} aria-label={`${t.remove}: ${g.name}`} />
                  </Popconfirm>,
                ]}
              >
                <p className="muted">{g.description || '—'}</p>
                <div style={{ overflowWrap: 'anywhere' }}>
                  {g.memberNames.slice(0, 5).join(', ') || <span className="muted">{t.noMembers}</span>}
                  {g.memberNames.length > 5 ? ` +${g.memberNames.length - 5}` : ''}
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}

      {refs && editing !== undefined && (
        <GroupDrawer
          key={editing?.id ?? 'new'}
          group={editing}
          open
          refs={refs}
          clients={data.clients}
          onClose={() => setEditing(undefined)}
        />
      )}

      <Modal
        open={!!applying}
        title={applying ? t.applyTitle(applying.name) : ''}
        okText={t.applyConfirm}
        cancelText={ru.clients.cancel}
        okButtonProps={{ size: 'large', loading: applyingNow, disabled: !sections.length }}
        cancelButtonProps={{ size: 'large' }}
        onOk={onApply}
        onCancel={() => setApplying(null)}
        destroyOnHidden
      >
        <p>{applying && t.applyHint(applying.memberIds.length)}</p>
        <Checkbox.Group value={sections} onChange={(v) => setSections(v as ConditionSection[])}>
          <Space direction="vertical">
            {SECTIONS.map((s) => (
              <Checkbox key={s} value={s}>
                {t.sections[s]}
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      </Modal>
    </div>
  )
}
