import { useEffect, useMemo, useState } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Input, Segmented, Select } from 'antd'
import { PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { ru } from '@/shared/i18n/ru'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useDebounced } from '../../orders/list/useDebounced'
import { useListClientsQuery, type ClientsQuery } from '../clientsApi'
import { GroupsTab } from '../groups/GroupsTab'
import { ClientsTable } from './ClientsList'
import { parseClientQuery, toClientParams } from './clientQuery'

const t = ru.clients

export default function ClientsListPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'groups' ? 'groups' : 'list'
  const query = useMemo(() => parseClientQuery(params), [params])
  const { data, isFetching, isError, error, refetch } = useListClientsQuery(query, { skip: tab !== 'list' })

  const patch = (p: Partial<ClientsQuery>) => {
    const filterChanged = Object.keys(p).some((k) => !['page', 'pageSize', 'sortBy', 'sortDir'].includes(k))
    setParams(toClientParams({ ...query, page: filterChanged ? 1 : query.page, ...p }), { replace: true })
  }

  const [text, setText] = useState(query.q)
  const debounced = useDebounced(text)
  useEffect(() => {
    if (debounced !== query.q) patch({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const filtered = !!(query.q || query.regionId || query.groupId || query.status !== 'all')

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        extra={
          <>
            <Button size="large" icon={<UploadOutlined />} onClick={() => navigate('/clients/import')}>
              {t.importButton}
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={() => navigate('/clients/new')}
              style={{ marginLeft: 8 }}
            >
              {t.newClient}
            </Button>
          </>
        }
      />

      <Segmented
        size="large"
        value={tab}
        onChange={(v) => setParams(v === 'groups' ? { tab: 'groups' } : {}, { replace: true })}
        options={[
          { value: 'list', label: t.tabs.list },
          { value: 'groups', label: t.tabs.groups },
        ]}
        style={{ marginBottom: 20 }}
      />

      {tab === 'groups' ? (
        <GroupsTab />
      ) : (
        <>
          <div className="list-toolbar clients-toolbar">
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
              placeholder={t.filters.anyRegion}
              aria-label={t.filters.region}
              value={query.regionId || undefined}
              onChange={(v) => patch({ regionId: v ?? '' })}
              options={(data?.regions ?? []).map((r) => ({ value: r.id, label: r.name }))}
            />
            <Select
              allowClear
              size="large"
              placeholder={t.filters.anyGroup}
              aria-label={t.filters.group}
              value={query.groupId || undefined}
              onChange={(v) => patch({ groupId: v ?? '' })}
              options={[
                { value: 'none', label: t.filters.noGroup },
                ...(data?.groups ?? []).map((g) => ({ value: g.id, label: g.name })),
              ]}
            />
            <Segmented
              size="large"
              value={query.status}
              onChange={(v) => patch({ status: v as ClientsQuery['status'] })}
              options={[
                { value: 'all', label: t.status.all },
                { value: 'active', label: t.status.active },
                { value: 'inactive', label: t.status.inactive },
              ]}
            />
          </div>
          {isError ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : (
            <ClientsTable data={data} loading={isFetching} query={query} onQuery={patch} filtered={filtered} />
          )}
        </>
      )}
    </>
  )
}
