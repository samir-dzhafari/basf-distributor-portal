import { useEffect, useMemo, useState } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { clickableRow } from '@/shared/lib/tableRow'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Empty, Grid, Input, Segmented, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { ru } from '@/shared/i18n/ru'
import type { Id } from '@/shared/types/domain'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useDebounced } from '../orders/list/useDebounced'
import { parseEmployeeQuery, toEmployeeParams } from './employeeQuery'
import { MassZoneModal } from './MassZoneModal'
import { useListEmployeesQuery, type EmployeeRow, type EmployeesQuery } from './employeesApi'

const t = ru.employees
const STATUS_COLOR = { active: 'green', invited: 'gold', blocked: 'red' } as const

export default function EmployeesListPage() {
  const navigate = useNavigate()
  const isMobile = !Grid.useBreakpoint().lg
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => parseEmployeeQuery(params), [params])
  const { data, isFetching, isError, error, refetch } = useListEmployeesQuery(query)
  const [selected, setSelected] = useState<Id[]>([])
  const [mass, setMass] = useState(false)

  const patch = (p: Partial<EmployeesQuery>) => {
    const filterChanged = Object.keys(p).some((k) => !['page', 'pageSize', 'sortBy', 'sortDir'].includes(k))
    setParams(toEmployeeParams({ ...query, page: filterChanged ? 1 : query.page, ...p }), { replace: true })
  }
  const [text, setText] = useState(query.q)
  const debounced = useDebounced(text)
  useEffect(() => {
    if (debounced !== query.q) patch({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const rows = data?.rows ?? []
  const open = (e: EmployeeRow) => navigate(`/admin/employees/${e.id}`)
  const regions = (e: EmployeeRow) => (e.fullAccess ? t.allRegions : e.regionNames.join(', ') || '—')
  const tag = (e: EmployeeRow) => <Tag color={STATUS_COLOR[e.status]}>{t.statusTag[e.status]}</Tag>

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        extra={
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/admin/employees/new')}>
            {t.newEmployee}
          </Button>
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
          size="large"
          placeholder={t.filters.role}
          aria-label={t.filters.role}
          value={query.roleId || undefined}
          onChange={(v) => patch({ roleId: v ?? '' })}
          options={(data?.refs.roles ?? []).map((r) => ({ value: r.id, label: r.name }))}
        />
        <Select
          allowClear
          size="large"
          placeholder={t.filters.region}
          aria-label={t.filters.region}
          value={query.regionId || undefined}
          onChange={(v) => patch({ regionId: v ?? '' })}
          options={(data?.refs.regions ?? []).map((r) => ({ value: r.id, label: r.name }))}
        />
        <Select
          allowClear
          size="large"
          placeholder={t.filters.manager}
          aria-label={t.filters.manager}
          value={query.managerId || undefined}
          onChange={(v) => patch({ managerId: v ?? '' })}
          options={[
            { value: 'none', label: t.filters.noManager },
            ...(data?.refs.managers ?? []).map((m) => ({ value: m.id, label: m.name })),
          ]}
        />
        <Segmented
          size="large"
          value={query.status}
          onChange={(v) => patch({ status: v as EmployeesQuery['status'] })}
          options={(['all', 'active', 'invited', 'blocked'] as const).map((k) => ({ value: k, label: t.status[k] }))}
        />
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data && !rows.length ? (
        <Card>
          <Empty description={<strong>{t.empty}</strong>} />
        </Card>
      ) : (
        <>
          {selected.length > 0 && data && (
            <div className="bulk-bar" role="region" aria-label={t.selected(selected.length)}>
              <strong>{t.selected(selected.length)}</strong>
              <Space wrap>
                <Button type="primary" ghost onClick={() => setMass(true)}>
                  {t.bulkZone}
                </Button>
                <Button type="link" onClick={() => setSelected([])}>
                  {t.bulkClear}
                </Button>
              </Space>
            </div>
          )}
          {isMobile ? (
            <div className="order-cards" aria-busy={isFetching}>
              {rows.map((e) => (
                <button key={e.id} type="button" className="order-card" onClick={() => open(e)}>
                  <span className="order-card__top">
                    <strong>{e.name}</strong>
                    {tag(e)}
                  </span>
                  <span>{e.roleName}</span>
                  <span className="muted">{e.email}</span>
                  <span className="muted">{regions(e)}</span>
                </button>
              ))}
            </div>
          ) : (
            <Table<EmployeeRow>
              rowKey="id"
              dataSource={rows}
              loading={isFetching}
              rowClassName="order-row"
              onRow={(e) => clickableRow(() => open(e))}
              rowSelection={{
                selectedRowKeys: selected,
                onChange: (k) => setSelected(k as Id[]),
                columnWidth: 48,
                getCheckboxProps: (e) => ({ disabled: e.fullAccess }),
              }}
              scroll={{ x: 'max-content' }}
              sortDirections={['ascend', 'descend']}
              onChange={(p, _f, s) => {
                const sorter = Array.isArray(s) ? s[0] : s
                const sortBy = sorter?.order ? (sorter.columnKey as EmployeesQuery['sortBy']) : 'name'
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
                  title: t.columns.name,
                  dataIndex: 'name',
                  key: 'name',
                  sorter: true,
                  sortOrder: query.sortBy === 'name' ? (query.sortDir === 'asc' ? 'ascend' : 'descend') : null,
                  render: (v: string) => <strong>{v}</strong>,
                },
                { title: t.columns.email, dataIndex: 'email' },
                {
                  title: t.columns.role,
                  dataIndex: 'roleName',
                  key: 'role',
                  sorter: true,
                  sortOrder: query.sortBy === 'role' ? (query.sortDir === 'asc' ? 'ascend' : 'descend') : null,
                },
                { title: t.columns.regions, render: (_, e) => regions(e) },
                { title: t.columns.manager, render: (_, e) => e.managerName ?? <span className="muted">—</span> },
                { title: t.columns.clients, align: 'right', render: (_, e) => (e.fullAccess ? '∞' : e.clientsCount) },
                { title: t.columns.subs, dataIndex: 'subordinatesCount', align: 'right' },
                { title: t.columns.status, render: (_, e) => tag(e) },
              ]}
            />
          )}
        </>
      )}

      {data && (
        <MassZoneModal
          ids={selected}
          refs={data.refs}
          open={mass}
          onClose={() => setMass(false)}
          onDone={() => {
            setMass(false)
            setSelected([])
          }}
        />
      )}
    </>
  )
}
