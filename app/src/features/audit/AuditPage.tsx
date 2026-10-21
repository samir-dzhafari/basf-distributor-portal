import { useState } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { DatePicker, Empty, Grid, Input, Select, Table, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { ru } from '@/shared/i18n/ru'
import { formatDateTime } from '@/shared/lib/format'
import type { AuditEntity } from '@/shared/types/domain'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useDebounced } from '../orders/list/useDebounced'
import { useListAuditQuery, type AuditRow } from './auditApi'

const t = ru.audit
const ENTITY_COLOR: Partial<Record<AuditEntity, string>> = {
  client: 'green',
  employee: 'blue',
  role: 'purple',
  product: 'gold',
  price: 'gold',
  settings: 'red',
  import: 'cyan',
}

function Changes({ row }: { row: AuditRow }) {
  if (!row.changes.length && !row.summary) return <span className="muted">—</span>
  return (
    <div className="audit-changes">
      {row.summary && <div>{row.summary}</div>}
      {row.changes.map((c, i) => (
        <div key={i}>
          <strong>{c.field}</strong>
          {c.from !== undefined && (
            <>
              {': '}
              <span className="audit-from">{c.from}</span>
            </>
          )}
          {c.to !== undefined && (
            <>
              {c.from !== undefined ? ' → ' : ': '}
              <span className="audit-to">{c.to}</span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

/** Журнал действий: автор, время, объект и изменения (фич-лист 14.1). */
export default function AuditPage() {
  const isMobile = !Grid.useBreakpoint().lg
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [entity, setEntity] = useState<AuditEntity | ''>('')
  const [userId, setUserId] = useState('')
  const [range, setRange] = useState<[string, string]>(['', ''])
  const [page, setPage] = useState(1)
  const { data, isFetching, isError, error, refetch } = useListAuditQuery(
    { q: dq, entity, userId, from: range[0], to: range[1], page, pageSize: 20 },
    { refetchOnMountOrArgChange: true },
  )

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <div className="list-toolbar products-toolbar" style={{ gridTemplateColumns: '2fr 1fr 1fr 1.4fr' }}>
        <Input
          allowClear
          size="large"
          prefix={<SearchOutlined />}
          placeholder={t.search}
          aria-label={t.search}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <Select
          allowClear
          size="large"
          placeholder={t.allEntities}
          aria-label={t.allEntities}
          value={entity || undefined}
          onChange={(v) => {
            setEntity(v ?? '')
            setPage(1)
          }}
          options={(Object.keys(t.entities) as AuditEntity[]).map((k) => ({ value: k, label: t.entities[k] }))}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          size="large"
          placeholder={t.allUsers}
          aria-label={t.allUsers}
          value={userId || undefined}
          onChange={(v) => {
            setUserId(v ?? '')
            setPage(1)
          }}
          options={(data?.users ?? []).map((u) => ({ value: u.id, label: u.name }))}
        />
        <DatePicker.RangePicker
          size="large"
          format="DD.MM.YYYY"
          placeholder={[t.period, '']}
          allowEmpty={[true, true]}
          onChange={(r) => {
            setRange([r?.[0]?.format('YYYY-MM-DD') ?? '', r?.[1]?.format('YYYY-MM-DD') ?? ''])
            setPage(1)
          }}
          disabledDate={(d) => d.isAfter(dayjs())}
        />
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isMobile ? (
        <div className="order-cards" aria-busy={isFetching}>
          {data && !data.rows.length && <Empty description={t.empty} />}
          {data?.rows.map((r) => (
            <div key={r.id} className="order-card">
              <span className="order-card__top">
                <strong>{r.entityName}</strong>
                <Tag color={ENTITY_COLOR[r.entity]}>{t.entities[r.entity]}</Tag>
              </span>
              <span>{r.action}</span>
              <Changes row={r} />
              <span className="muted">
                {formatDateTime(r.at)} · {r.userName}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Table<AuditRow>
          rowKey="id"
          dataSource={data?.rows ?? []}
          loading={isFetching}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description={t.empty} /> }}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
            showTotal: t.found,
            hideOnSinglePage: (data?.total ?? 0) <= 20,
          }}
          columns={[
            {
              title: t.colTime,
              render: (_, r) => <span style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.at)}</span>,
              width: 160,
            },
            { title: t.colAuthor, dataIndex: 'userName' },
            {
              title: t.colObject,
              render: (_, r) => (
                <>
                  <Tag color={ENTITY_COLOR[r.entity]}>{t.entities[r.entity]}</Tag>
                  <strong>{r.entityName}</strong>
                </>
              ),
            },
            { title: t.colAction, dataIndex: 'action' },
            { title: t.colDetails, render: (_, r) => <Changes row={r} /> },
          ]}
        />
      )}
    </>
  )
}
