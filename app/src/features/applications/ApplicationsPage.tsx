import { useEffect, useMemo, useState } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { clickableRow } from '@/shared/lib/tableRow'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { App, Button, Card, Empty, Grid, Input, Select, Space, Table, Tag } from 'antd'
import { EditOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { formatDate } from '@/shared/lib/format'
import type { Id } from '@/shared/types/domain'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useDebounced } from '../orders/list/useDebounced'
import { ApplicationDrawer } from './ApplicationDrawer'
import { parseApplicationQuery, toApplicationParams } from './applicationQuery'
import {
  useGetApplicationRefsQuery,
  useListApplicationsQuery,
  useMassUpdateApplicationsMutation,
  type ApplicationRow,
  type ApplicationState,
  type ApplicationsQuery,
  type MassApplicationPatch,
} from './applicationsApi'

const t = ru.applications
const STATE_COLOR: Record<ApplicationState, string> = {
  active: 'green',
  future: 'blue',
  expired: 'default',
  inactive: 'red',
}
const STATES: ApplicationState[] = ['active', 'future', 'expired', 'inactive']

export default function ApplicationsPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const isMobile = !Grid.useBreakpoint().lg
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => parseApplicationQuery(params), [params])
  const { data, isFetching, isError, error, refetch } = useListApplicationsQuery(query)
  const { data: refs } = useGetApplicationRefsQuery()
  const [mass] = useMassUpdateApplicationsMutation()
  const [selected, setSelected] = useState<Id[]>([])
  const [editing, setEditing] = useState<ApplicationRow | null | undefined>(undefined)

  const patch = (p: Partial<ApplicationsQuery>) => {
    const filterChanged = Object.keys(p).some((k) => !['page', 'pageSize', 'sortBy', 'sortDir'].includes(k))
    setParams(toApplicationParams({ ...query, page: filterChanged ? 1 : query.page, ...p }), { replace: true })
  }

  const [text, setText] = useState(query.q)
  const debounced = useDebounced(text)
  useEffect(() => {
    if (debounced !== query.q) patch({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const run = async (change: Omit<MassApplicationPatch, 'ids'>) => {
    const r = await mass({ ids: selected, ...change })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.bulk.done(r.data.updated))
    setSelected([])
  }

  const sortOrder = (k: ApplicationsQuery['sortBy']) =>
    query.sortBy === k ? (query.sortDir === 'asc' ? ('ascend' as const) : ('descend' as const)) : null
  const rows = data?.rows ?? []
  const employees = (refs?.employees ?? []).map((e) => ({ value: e.id, label: e.name }))
  const filtered = !!(
    query.q ||
    query.clientId ||
    query.regionId ||
    query.businessTypeId ||
    query.responsibleId ||
    query.status !== 'all'
  )
  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0

  const period = (a: ApplicationRow) => `${formatDate(a.validFrom)} — ${formatDate(a.validTo)}`
  const responsible = (a: ApplicationRow) =>
    a.responsibleNames.length ? a.responsibleNames.join(', ') : <span className="muted">{t.noResponsible}</span>
  const edit = (a: ApplicationRow) => (
    <Button
      icon={<EditOutlined />}
      onClick={(e) => {
        e.stopPropagation()
        setEditing(a)
      }}
    >
      {t.edit}
    </Button>
  )

  const bulkBar = selected.length > 0 && (
    <div className="bulk-bar" role="region" aria-label={t.selected(selected.length)}>
      <strong>{t.selected(selected.length)}</strong>
      <Space wrap>
        <Select<string | null>
          showSearch
          optionFilterProp="label"
          placeholder={t.bulk.addResponsible}
          style={{ minWidth: 240 }}
          value={null}
          onChange={(v) => v && run({ addResponsibleIds: [v] })}
          options={employees}
        />
        <Select<string | null>
          showSearch
          optionFilterProp="label"
          placeholder={t.bulk.removeResponsible}
          style={{ minWidth: 240 }}
          value={null}
          onChange={(v) => v && run({ removeResponsibleIds: [v] })}
          options={employees}
        />
        <Button onClick={() => run({ active: true })}>{t.bulk.enable}</Button>
        <Button danger onClick={() => run({ active: false })}>
          {t.bulk.disable}
        </Button>
        <Button type="link" onClick={() => setSelected([])}>
          {t.bulk.clear}
        </Button>
      </Space>
    </div>
  )

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        extra={
          <>
            <Button size="large" icon={<UploadOutlined />} onClick={() => navigate('/applications/import')}>
              {t.import}
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              disabled={!refs}
              onClick={() => setEditing(null)}
              style={{ marginLeft: 8 }}
            >
              {t.newApplication}
            </Button>
          </>
        }
      />

      <div className="list-toolbar products-toolbar">
        <Input
          allowClear
          size="large"
          prefix={<SearchOutlined />}
          placeholder={t.search}
          aria-label={t.search}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          size="large"
          placeholder={t.filters.client}
          aria-label={t.filters.client}
          value={query.clientId || undefined}
          onChange={(v) => patch({ clientId: v ?? '' })}
          options={(refs?.clients ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select
          allowClear
          size="large"
          placeholder={t.filters.region}
          aria-label={t.filters.region}
          value={query.regionId || undefined}
          onChange={(v) => patch({ regionId: v ?? '' })}
          options={(refs?.regions ?? []).map((r) => ({ value: r.id, label: r.name }))}
        />
        <Select
          allowClear
          size="large"
          placeholder={t.filters.businessType}
          aria-label={t.filters.businessType}
          value={query.businessTypeId || undefined}
          onChange={(v) => patch({ businessTypeId: v ?? '' })}
          options={(refs?.businessTypes ?? []).map((b) => ({ value: b.id, label: b.name }))}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          size="large"
          placeholder={t.filters.responsible}
          aria-label={t.filters.responsible}
          value={query.responsibleId || undefined}
          onChange={(v) => patch({ responsibleId: v ?? '' })}
          options={employees}
        />
      </div>

      {data && (
        <div className="chips" role="group" aria-label={t.columns.state}>
          <button
            type="button"
            className={`chip${query.status === 'all' ? ' chip--on' : ''}`}
            aria-pressed={query.status === 'all'}
            onClick={() => patch({ status: 'all' })}
          >
            {t.state.all} <span className="chip__n">{total}</span>
          </button>
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip${query.status === s ? ' chip--on' : ''}`}
              aria-pressed={query.status === s}
              onClick={() => patch({ status: s })}
            >
              {t.state[s]} <span className="chip__n">{data.counts[s]}</span>
            </button>
          ))}
        </div>
      )}

      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data && !rows.length ? (
        <Card>
          <Empty description={<strong>{filtered ? ru.clients.emptyFiltered : t.title}</strong>} />
        </Card>
      ) : (
        <>
          {bulkBar}
          {isMobile ? (
            <div className="order-cards" aria-busy={isFetching}>
              {rows.map((a) => (
                <button key={a.id} type="button" className="order-card" onClick={() => setEditing(a)}>
                  <span className="order-card__top">
                    <strong>{a.number}</strong>
                    <Tag color={STATE_COLOR[a.state]}>{t.stateTag[a.state]}</Tag>
                  </span>
                  <span>{a.clientName}</span>
                  <span className="muted">
                    {a.regionName} · {a.businessTypeName}
                  </span>
                  <span className="muted">{period(a)}</span>
                  <span>{responsible(a)}</span>
                </button>
              ))}
            </div>
          ) : (
            <Table<ApplicationRow>
              rowKey="id"
              dataSource={rows}
              loading={isFetching}
              rowClassName="order-row"
              onRow={(a) => clickableRow(() => setEditing(a))}
              rowSelection={{ selectedRowKeys: selected, onChange: (k) => setSelected(k as Id[]), columnWidth: 48 }}
              scroll={{ x: 'max-content' }}
              sortDirections={['ascend', 'descend']}
              onChange={(p, _f, s) => {
                const sorter = Array.isArray(s) ? s[0] : s
                const sortBy = sorter?.order ? (sorter.columnKey as ApplicationsQuery['sortBy']) : 'number'
                const sortDir = sorter?.order === 'descend' ? 'desc' : 'asc'
                const reset = p.pageSize !== query.pageSize || sortBy !== query.sortBy || sortDir !== query.sortDir
                patch({ page: reset ? 1 : (p.current ?? 1), pageSize: p.pageSize ?? query.pageSize, sortBy, sortDir })
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
                  title: t.columns.number,
                  dataIndex: 'number',
                  key: 'number',
                  sorter: true,
                  sortOrder: sortOrder('number'),
                  render: (v: string) => <strong style={{ whiteSpace: 'nowrap' }}>{v}</strong>,
                },
                {
                  title: t.columns.client,
                  dataIndex: 'clientName',
                  key: 'client',
                  sorter: true,
                  sortOrder: sortOrder('client'),
                },
                { title: t.columns.region, dataIndex: 'regionName' },
                { title: t.columns.businessType, dataIndex: 'businessTypeName' },
                {
                  title: t.columns.period,
                  key: 'validTo',
                  sorter: true,
                  sortOrder: sortOrder('validTo'),
                  render: (_, a) => <span style={{ whiteSpace: 'nowrap' }}>{period(a)}</span>,
                },
                { title: t.columns.responsible, render: (_, a) => responsible(a) },
                {
                  title: t.columns.state,
                  render: (_, a) => <Tag color={STATE_COLOR[a.state]}>{t.stateTag[a.state]}</Tag>,
                },
                { title: '', render: (_, a) => edit(a) },
              ]}
            />
          )}
        </>
      )}

      {refs && editing !== undefined && (
        <ApplicationDrawer
          key={editing?.id ?? 'new'}
          application={editing}
          refs={refs}
          open
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  )
}
