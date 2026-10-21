import { useNavigate } from 'react-router-dom'
import { clickableRow } from '@/shared/lib/tableRow'
import { App, Button, Card, Empty, Grid, Popconfirm, Select, Space, Switch, Table, Tag } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import type { Id } from '@/shared/types/domain'
import {
  useSetClientsActiveMutation,
  useUpdateClientGroupMutation,
  type ClientRow,
  type ClientsList,
  type ClientsQuery,
} from '../clientsApi'
import { useState } from 'react'

const t = ru.clients

/** Таблица клиентов с массовыми действиями; на телефоне — карточки. */
export function ClientsTable({
  data,
  loading,
  query,
  onQuery,
  filtered,
}: {
  data?: ClientsList
  loading: boolean
  query: ClientsQuery
  onQuery: (patch: Partial<ClientsQuery>) => void
  filtered: boolean
}) {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const isMobile = !Grid.useBreakpoint().lg
  const [selected, setSelected] = useState<Id[]>([])
  const [setActive] = useSetClientsActiveMutation()
  const [setGroup] = useUpdateClientGroupMutation()

  const rows = data?.rows ?? []
  const open = (c: ClientRow) => navigate(`/clients/${c.id}`)

  const changeActive = async (ids: Id[], active: boolean) => {
    const r = await setActive({ ids, active })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.activeChanged(ids.length, active))
    setSelected([])
  }

  const changeGroup = async (groupId: string | null) => {
    const r = await setGroup({ ids: selected, groupId })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.groupAssigned)
    setSelected([])
  }

  if (data && !rows.length) {
    return (
      <Card>
        <Empty description={<strong>{filtered ? t.emptyFiltered : t.empty}</strong>}>
          {!filtered && <p className="muted">{t.emptyText}</p>}
        </Empty>
      </Card>
    )
  }

  const activeSwitch = (c: ClientRow) =>
    c.active ? (
      <Popconfirm
        title={t.disableTitle}
        description={t.disableText}
        okText={t.disableOk}
        cancelText={t.cancel}
        okButtonProps={{ danger: true }}
        onConfirm={() => changeActive([c.id], false)}
      >
        <Switch checked aria-label={`${t.columns.active}: ${c.name}`} onClick={(_, e) => e.stopPropagation()} />
      </Popconfirm>
    ) : (
      <Switch
        checked={false}
        aria-label={`${t.columns.active}: ${c.name}`}
        onChange={() => changeActive([c.id], true)}
        onClick={(_, e) => e.stopPropagation()}
      />
    )

  const bulkBar = selected.length > 0 && (
    <div className="bulk-bar" role="region" aria-label={t.selected(selected.length)}>
      <strong>{t.selected(selected.length)}</strong>
      <Space wrap>
        <Button onClick={() => changeActive(selected, true)}>{t.bulkEnable}</Button>
        <Button danger onClick={() => changeActive(selected, false)}>
          {t.bulkDisable}
        </Button>
        <Select
          placeholder={t.bulkGroup}
          style={{ minWidth: 220 }}
          value={null}
          onChange={(v) => changeGroup(v === 'none' ? null : v)}
          options={[
            { value: 'none', label: t.filters.noGroup },
            ...(data?.groups ?? []).map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
        <Button type="link" onClick={() => setSelected([])}>
          {t.bulkClear}
        </Button>
      </Space>
    </div>
  )

  if (isMobile) {
    return (
      <>
        {bulkBar}
        <div className="order-cards" aria-busy={loading}>
          {rows.map((c) => (
            <button key={c.id} type="button" className="order-card" onClick={() => open(c)}>
              <span className="order-card__top">
                <strong>{c.name}</strong>
                <Tag color={c.active ? 'green' : 'default'}>{c.active ? t.activeTag : t.inactiveTag}</Tag>
              </span>
              <span className="muted">
                {t.columns.code}: {c.code} · {t.columns.inn}: {c.inn}
              </span>
              <span className="muted">{c.regionNames.join(', ')}</span>
              {c.groupName && <span>{c.groupName}</span>}
            </button>
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      {bulkBar}
      <Table<ClientRow>
        rowKey="id"
        dataSource={rows}
        loading={loading}
        rowClassName="order-row"
        onRow={(c) => clickableRow(() => open(c))}
        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as Id[]), columnWidth: 48 }}
        scroll={{ x: 'max-content' }}
        sortDirections={['ascend', 'descend']}
        onChange={(p, _f, s) => {
          const sorter = Array.isArray(s) ? s[0] : s
          const sortBy = sorter?.order ? (sorter.columnKey as ClientsQuery['sortBy']) : 'name'
          const sortDir = sorter?.order === 'descend' ? 'desc' : 'asc'
          const reset = p.pageSize !== query.pageSize || sortBy !== query.sortBy || sortDir !== query.sortDir
          onQuery({ page: reset ? 1 : (p.current ?? 1), pageSize: p.pageSize ?? query.pageSize, sortBy, sortDir })
        }}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (n) => t.found(n),
          hideOnSinglePage: (data?.total ?? 0) <= 10,
        }}
        columns={[
          {
            title: t.columns.code,
            dataIndex: 'code',
            key: 'code',
            sorter: true,
            sortOrder: query.sortBy === 'code' ? (query.sortDir === 'asc' ? 'ascend' : 'descend') : null,
            width: 120,
          },
          {
            title: t.columns.name,
            dataIndex: 'name',
            key: 'name',
            sorter: true,
            sortOrder: query.sortBy === 'name' ? (query.sortDir === 'asc' ? 'ascend' : 'descend') : null,
            render: (v: string) => <strong>{v}</strong>,
          },
          { title: t.columns.email, dataIndex: 'email' },
          { title: t.columns.inn, dataIndex: 'inn', width: 130 },
          { title: t.columns.region, render: (_, c) => c.regionNames.join(', ') },
          { title: t.columns.group, render: (_, c) => c.groupName ?? <span className="muted">—</span> },
          { title: t.columns.users, dataIndex: 'usersCount', align: 'right', width: 80 },
          { title: t.columns.active, render: (_, c) => activeSwitch(c), width: 100 },
        ]}
      />
    </>
  )
}
