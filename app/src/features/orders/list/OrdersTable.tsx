import { Link } from 'react-router-dom'
import { clickableRow } from '@/shared/lib/tableRow'
import { Grid, Table, type TableColumnsType } from 'antd'
import { ru } from '@/shared/i18n/ru'
import { formatDateTime, formatMoney } from '@/shared/lib/format'
import { StatusTag } from '@/shared/ui/StatusTag'
import type { OrderRow } from '../ordersViewApi'
import type { OrderQuery, SortField } from './orderFilters'

const t = ru.orders.list.columns

export interface ColumnVisibility {
  client: boolean
  responsible: boolean
}

/** Путь к заказу: черновик открывается в мастере, остальные — в карточке. */
export const orderPath = (o: Pick<OrderRow, 'id' | 'status'>) =>
  o.status === 'draft' ? `/orders/${o.id}/edit` : `/orders/${o.id}`
const numberLabel = (o: OrderRow) => o.number || ru.orders.draft

function useColumns(vis: ColumnVisibility, query: OrderQuery): TableColumnsType<OrderRow> {
  const sortOrder = (key: SortField) =>
    query.sortBy === key ? (query.sortDir === 'asc' ? ('ascend' as const) : ('descend' as const)) : null
  const cols: (TableColumnsType<OrderRow>[number] & { show?: boolean })[] = [
    {
      title: t.date,
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
      sortOrder: sortOrder('createdAt'),
      width: 150,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: t.number,
      dataIndex: 'number',
      key: 'number',
      sorter: true,
      sortOrder: sortOrder('number'),
      width: 120,
      render: (_: unknown, o) => (
        <Link to={orderPath(o)} aria-label={ru.orders.list.open(numberLabel(o))} onClick={(e) => e.stopPropagation()}>
          <strong>{numberLabel(o)}</strong>
        </Link>
      ),
    },
    { title: t.erp, dataIndex: 'erpNumber', key: 'erp', width: 130, render: (v?: string) => v ?? '—' },
    { title: t.client, dataIndex: 'clientName', key: 'client', show: vis.client },
    { title: t.region, dataIndex: 'regionName', key: 'region', width: 160 },
    { title: t.city, dataIndex: 'city', key: 'city', width: 120 },
    { title: t.application, dataIndex: 'applicationNumber', key: 'application', width: 170 },
    { title: t.creator, dataIndex: 'creatorName', key: 'creator', width: 160 },
    {
      title: t.responsible,
      dataIndex: 'responsibleName',
      key: 'responsible',
      width: 160,
      show: vis.responsible,
      render: (v?: string) => v ?? '—',
    },
    {
      title: t.status,
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      sortOrder: sortOrder('status'),
      width: 170,
      render: (_: unknown, o) => <StatusTag status={o.status} />,
    },
    {
      title: t.total,
      dataIndex: 'total',
      key: 'total',
      sorter: true,
      sortOrder: sortOrder('total'),
      align: 'right',
      width: 150,
      render: (v: number) => formatMoney(v),
    },
  ]
  return cols.filter((c) => c.show !== false)
}

/** Список заказов: таблица на компьютере, карточки на телефоне. */
export function OrdersTable({
  rows,
  total,
  loading,
  query,
  visibility,
  onQuery,
  onOpen,
}: {
  rows: OrderRow[]
  total: number
  loading: boolean
  query: OrderQuery
  visibility: ColumnVisibility
  onQuery: (patch: Partial<OrderQuery>) => void
  onOpen: (o: OrderRow) => void
}) {
  const isMobile = !Grid.useBreakpoint().lg
  const columns = useColumns(visibility, query)

  const pagination = {
    current: query.page,
    pageSize: query.pageSize,
    total,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50],
    showTotal: (n: number) => ru.orders.list.found(n),
    hideOnSinglePage: total <= 10,
  }

  if (isMobile) {
    return (
      <>
        <div className="order-cards" aria-busy={loading}>
          {rows.map((o) => (
            <button key={o.id} type="button" className="order-card" onClick={() => onOpen(o)}>
              <span className="order-card__top">
                <strong>{numberLabel(o)}</strong>
                <StatusTag status={o.status} />
              </span>
              {visibility.client && <span>{o.clientName}</span>}
              <span className="muted">
                {formatDateTime(o.createdAt)} · {o.applicationNumber}
              </span>
              <span className="order-card__bottom">
                <span className="muted">{[o.regionName, o.city].filter(Boolean).join(', ')}</span>
                <strong>{formatMoney(o.total)}</strong>
              </span>
            </button>
          ))}
        </div>
        <Table
          size="small"
          rowKey="id"
          columns={[]}
          dataSource={[]}
          showHeader={false}
          locale={{ emptyText: ' ' }}
          pagination={{
            ...pagination,
            align: 'center',
            simple: true,
            showSizeChanger: false,
            hideOnSinglePage: total <= query.pageSize,
          }}
          onChange={(p) => onQuery({ page: p.current ?? 1 })}
        />
      </>
    )
  }

  return (
    <Table<OrderRow>
      rowKey="id"
      columns={columns}
      dataSource={rows}
      loading={loading}
      scroll={{ x: 'max-content' }}
      pagination={pagination}
      rowClassName="order-row"
      onRow={(o) => clickableRow(() => onOpen(o))}
      sortDirections={['descend', 'ascend']}
      onChange={(p, _f, sorter) => {
        const s = Array.isArray(sorter) ? sorter[0] : sorter
        // Третье нажатие на заголовок снимает сортировку — возвращаемся к «новые сверху».
        const sortBy = s?.order ? (s.columnKey as SortField) : 'createdAt'
        const sortDir = s?.order === 'ascend' ? 'asc' : 'desc'
        const sizeChanged = p.pageSize !== query.pageSize
        const sortChanged = sortBy !== query.sortBy || sortDir !== query.sortDir
        onQuery({
          page: sizeChanged || sortChanged ? 1 : (p.current ?? 1),
          pageSize: p.pageSize ?? query.pageSize,
          sortBy,
          sortDir,
        })
      }}
    />
  )
}
