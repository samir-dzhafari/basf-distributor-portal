import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { App, Alert, Badge, Button, Card, Empty, Input } from 'antd'
import { DownloadOutlined, FilterOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { can, isClient } from '@/features/auth/permissions'
import { useMe } from '@/features/auth/useMe'
import { ru } from '@/shared/i18n/ru'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useExportOrdersMutation, useGetOrderFilterOptionsQuery, useListOrdersQuery } from '../ordersViewApi'
import { exportOrdersXlsx } from './exportXlsx'
import { FiltersPanel } from './FiltersPanel'
import {
  activeFilterCount,
  emptyFilters,
  parseQuery,
  toSearchParams,
  type OrderFilters,
  type OrderQuery,
} from './orderFilters'
import { OrdersTable, orderPath } from './OrdersTable'
import { StatusChips } from './StatusChips'
import { useDebounced } from './useDebounced'

const t = ru.orders.list

export default function OrdersListPage() {
  const { data: me } = useMe()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => parseQuery(params), [params])
  const client = !!me && isClient(me)

  const patchQuery = (patch: Partial<OrderQuery>) => {
    const filterChanged = Object.keys(patch).some((k) => !['page', 'pageSize', 'sortBy', 'sortDir'].includes(k))
    setParams(toSearchParams({ ...query, page: filterChanged ? 1 : query.page, ...patch }), { replace: true })
  }

  // Поиск по тексту применяется с задержкой, чтобы не дёргать список на каждую букву.
  const [text, setText] = useState(query.q)
  const debouncedText = useDebounced(text)
  useEffect(() => {
    if (debouncedText !== query.q) patchQuery({ q: debouncedText })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText])

  const { data, isFetching, isError, refetch } = useListOrdersQuery(query)
  const { data: options } = useGetOrderFilterOptionsQuery()
  const [exportOrders, { isLoading: exporting }] = useExportOrdersMutation()
  const [showFilters, setShowFilters] = useState(false)

  const filtersCount = activeFilterCount(query)
  const canExport = can(me, 'orders.export')
  const visibility = { client: !client, responsible: !client }

  const reset = () => {
    setText('')
    setParams(toSearchParams({ ...query, ...emptyFilters(), statuses: query.statuses, page: 1 }), { replace: true })
  }

  const onExport = async () => {
    const r = await exportOrders(query as OrderFilters)
    if ('error' in r) return void message.error(errorMessage(r.error))
    if (!r.data.orders.length) return void message.info(t.exportEmpty)
    await exportOrdersXlsx(r.data, { showClient: visibility.client, showResponsible: visibility.responsible })
    message.success(t.exportDone(r.data.orders.length))
  }

  if (!me) return null

  const noOrders = !!data && data.countsTotal === 0 && !filtersCount && !query.statuses.length
  const nothingFound = !!data && data.total === 0 && !noOrders

  return (
    <>
      <PageHeader
        title={client ? ru.nav.myOrders : ru.nav.orders}
        extra={
          <>
            {canExport && (
              <Button icon={<DownloadOutlined />} size="large" loading={exporting} onClick={onExport}>
                {t.export}
              </Button>
            )}
          </>
        }
      />

      <div className="list-toolbar">
        <Input
          allowClear
          size="large"
          prefix={<SearchOutlined />}
          placeholder={t.search}
          aria-label={t.search}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Badge count={filtersCount} color="#00793A" offset={[-6, 6]}>
          <Button
            size="large"
            icon={<FilterOutlined />}
            aria-expanded={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            {t.moreFilters}
          </Button>
        </Badge>
      </div>

      {showFilters && (
        <FiltersPanel
          value={query}
          options={options}
          showClient={!client}
          showCreator={!client || (options?.creators.length ?? 0) > 1}
          onChange={patchQuery}
          onReset={reset}
        />
      )}

      {data && (
        <StatusChips
          counts={data.counts}
          total={data.countsTotal}
          selected={query.statuses}
          onSelect={(s) => patchQuery({ statuses: s })}
        />
      )}

      {isError ? (
        <Alert
          type="error"
          showIcon
          message={t.loadError}
          action={<Button onClick={() => refetch()}>{t.retry}</Button>}
        />
      ) : noOrders ? (
        <Card>
          <Empty description={<strong>{t.emptyAll}</strong>}>
            {can(me, 'orders.create') && (
              <>
                <p className="muted">{t.emptyAllClient}</p>
                <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/orders/new')}>
                  {ru.nav.newOrder}
                </Button>
              </>
            )}
          </Empty>
        </Card>
      ) : nothingFound ? (
        <Card>
          <Empty description={<strong>{t.emptyFiltered}</strong>}>
            <p className="muted">{t.emptyFilteredHint}</p>
            <Button
              size="large"
              onClick={() => {
                reset()
                patchQuery({ statuses: [] })
              }}
            >
              {t.reset}
            </Button>
          </Empty>
        </Card>
      ) : (
        <OrdersTable
          rows={data?.rows ?? []}
          total={data?.total ?? 0}
          loading={isFetching}
          query={query}
          visibility={visibility}
          onQuery={patchQuery}
          onOpen={(o) => navigate(orderPath(o))}
        />
      )}
    </>
  )
}
