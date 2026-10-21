import { useEffect, useMemo, useState } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Empty,
  Grid,
  Input,
  Modal,
  Radio,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import { EditOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/format'
import type { Id } from '@/shared/types/domain'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useDebounced } from '../orders/list/useDebounced'
import {
  useGetProductRefsQuery,
  useListProductsQuery,
  useMassUpdateProductsMutation,
  type MassPatch,
  type ProductRow,
  type ProductsQuery,
} from './catalogApi'
import { PriceDrawer } from './PriceDrawer'
import { ProductDrawer } from './ProductDrawer'
import { parseProductQuery, toProductParams } from './productQuery'

const t = ru.catalog

export default function ProductsPage() {
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const isMobile = !Grid.useBreakpoint().lg
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => parseProductQuery(params), [params])
  const { data, isFetching, isError, error, refetch } = useListProductsQuery(query)
  const { data: refs } = useGetProductRefsQuery()
  const [mass, { isLoading: massing }] = useMassUpdateProductsMutation()

  const [selected, setSelected] = useState<Id[]>([])
  const [editing, setEditing] = useState<ProductRow | null | undefined>(undefined)
  const [pricing, setPricing] = useState<Id | null>(null)
  const [btModal, setBtModal] = useState(false)
  const [btIds, setBtIds] = useState<Id[]>([])
  const [btMode, setBtMode] = useState<'add' | 'replace'>('add')

  const patch = (p: Partial<ProductsQuery>) => {
    const filterChanged = Object.keys(p).some((k) => !['page', 'pageSize', 'sortBy', 'sortDir'].includes(k))
    setParams(toProductParams({ ...query, page: filterChanged ? 1 : query.page, ...p }), { replace: true })
  }

  const [text, setText] = useState(query.q)
  const debounced = useDebounced(text)
  useEffect(() => {
    if (debounced !== query.q) patch({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const run = async (change: Omit<MassPatch, 'ids'>) => {
    const r = await mass({ ids: selected, ...change })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.bulk.done(r.data.updated))
    setSelected([])
  }

  const confirmClose = () =>
    modal.confirm({
      title: t.bulk.closeTitle(selected.length),
      content: t.bulk.closeText,
      okText: t.bulk.close,
      cancelText: ru.common.cancel,
      okButtonProps: { danger: true },
      onOk: () => run({ closed: true }),
    })

  const sortOrder = (key: ProductsQuery['sortBy']) =>
    query.sortBy === key ? (query.sortDir === 'asc' ? ('ascend' as const) : ('descend' as const)) : null
  const rows = data?.rows ?? []
  const filtered = !!(
    query.q ||
    query.groupId ||
    query.lineId ||
    query.businessTypeId ||
    query.status !== 'all' ||
    query.priceList !== 'all'
  )

  const state = (p: ProductRow) =>
    p.closed ? (
      <Tag color="red">{t.closed}</Tag>
    ) : p.inPriceList ? (
      <Tag color="green">{t.open}</Tag>
    ) : (
      <Tag color="blue">{t.outsidePrice}</Tag>
    )
  const priceCell = (p: ProductRow) => (
    <>
      <strong>{formatMoney(p.price)}</strong>
      {p.nextPrice && (
        <small className="muted" style={{ display: 'block' }}>
          {t.nextPrice(formatMoney(p.nextPrice.price), formatDate(p.nextPrice.validFrom))}
        </small>
      )}
    </>
  )
  const actions = (p: ProductRow) => (
    <Space>
      <Button
        icon={<EditOutlined />}
        onClick={(e) => {
          e.stopPropagation()
          setEditing(p)
        }}
      >
        {t.edit}
      </Button>
      <Button
        onClick={(e) => {
          e.stopPropagation()
          setPricing(p.id)
        }}
      >
        {t.price}
      </Button>
    </Space>
  )

  const bulkBar = selected.length > 0 && refs && (
    <div className="bulk-bar" role="region" aria-label={t.selected(selected.length)}>
      <strong>{t.selected(selected.length)}</strong>
      <Space wrap>
        <Button danger loading={massing} onClick={confirmClose}>
          {t.bulk.close}
        </Button>
        <Button loading={massing} onClick={() => run({ closed: false })}>
          {t.bulk.open}
        </Button>
        <Select<string | null>
          placeholder={t.bulk.group}
          style={{ minWidth: 170 }}
          value={null}
          onChange={(v) => v && run({ groupId: v })}
          options={refs.groups.map((g) => ({ value: g.id, label: g.name }))}
        />
        <Select<string | null>
          placeholder={t.bulk.line}
          style={{ minWidth: 150 }}
          value={null}
          onChange={(v) => v && run({ lineId: v })}
          options={refs.lines.map((l) => ({ value: l.id, label: l.name }))}
        />
        <Button
          onClick={() => {
            setBtIds([])
            setBtMode('add')
            setBtModal(true)
          }}
        >
          {t.bulk.businessTypes}
        </Button>
        <Select<string | null>
          placeholder={t.bulk.priceList}
          style={{ minWidth: 190 }}
          value={null}
          onChange={(v) => run({ inPriceList: v === 'in' })}
          options={[
            { value: 'in', label: t.bulk.toPrice },
            { value: 'out', label: t.bulk.fromPrice },
          ]}
        />
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
            <Button size="large" icon={<UploadOutlined />} onClick={() => navigate('/catalog/products/import')}>
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
              {t.newProduct}
            </Button>
          </>
        }
      />
      <Alert type="info" showIcon message={t.noDelete} style={{ marginBottom: 16 }} />

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
          placeholder={t.filters.group}
          aria-label={t.filters.group}
          value={query.groupId || undefined}
          onChange={(v) => patch({ groupId: v ?? '' })}
          options={(refs?.groups ?? []).map((g) => ({ value: g.id, label: g.name }))}
        />
        <Select
          allowClear
          size="large"
          placeholder={t.filters.line}
          aria-label={t.filters.line}
          value={query.lineId || undefined}
          onChange={(v) => patch({ lineId: v ?? '' })}
          options={(refs?.lines ?? []).map((l) => ({ value: l.id, label: l.name }))}
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
          size="large"
          aria-label={t.priceList.all}
          value={query.priceList}
          onChange={(v) => patch({ priceList: v })}
          options={(['all', 'in', 'out'] as const).map((k) => ({ value: k, label: t.priceList[k] }))}
        />
        <Segmented
          size="large"
          value={query.status}
          onChange={(v) => patch({ status: v as ProductsQuery['status'] })}
          options={(['all', 'open', 'closed'] as const).map((k) => ({ value: k, label: t.status[k] }))}
        />
      </div>
      {data && (
        <p className="muted" style={{ marginTop: -4 }}>
          {t.counts(data.openCount, data.closedCount)}
        </p>
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
              {rows.map((p) => (
                <div key={p.id} className="order-card" style={p.closed ? { opacity: 0.7 } : undefined}>
                  <span className="order-card__top">
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onChange={(e) =>
                        setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))
                      }
                      aria-label={ru.order.products.check(p.name)}
                    >
                      <strong>{p.name}</strong>
                    </Checkbox>
                    {state(p)}
                  </span>
                  <span className="muted">
                    {ru.order.products.code(p.code)} · {p.groupName}, {p.lineName}
                  </span>
                  <span className="order-card__bottom">
                    <span>
                      {formatNumber(p.packSize)} {p.unit} · {t.columns.multiple.toLowerCase()}{' '}
                      {formatNumber(p.multiple)}
                    </span>
                    <span>{priceCell(p)}</span>
                  </span>
                  {actions(p)}
                </div>
              ))}
            </div>
          ) : (
            <Table<ProductRow>
              rowKey="id"
              dataSource={rows}
              loading={isFetching}
              scroll={{ x: 'max-content' }}
              rowSelection={{ selectedRowKeys: selected, onChange: (k) => setSelected(k as Id[]), columnWidth: 48 }}
              rowClassName={(p) => (p.closed ? 'row-closed' : '')}
              sortDirections={['ascend', 'descend']}
              onChange={(p, _f, s) => {
                const sorter = Array.isArray(s) ? s[0] : s
                const sortBy = sorter?.order ? (sorter.columnKey as ProductsQuery['sortBy']) : 'name'
                const sortDir = sorter?.order === 'descend' ? 'desc' : 'asc'
                const reset = p.pageSize !== query.pageSize || sortBy !== query.sortBy || sortDir !== query.sortDir
                patch({ page: reset ? 1 : (p.current ?? 1), pageSize: p.pageSize ?? query.pageSize, sortBy, sortDir })
              }}
              pagination={{
                current: query.page,
                pageSize: query.pageSize,
                total: data?.total ?? 0,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50, 100],
                showTotal: (n) => t.found(n),
                hideOnSinglePage: (data?.total ?? 0) <= 10,
              }}
              columns={[
                {
                  title: t.columns.code,
                  dataIndex: 'code',
                  key: 'code',
                  sorter: true,
                  sortOrder: sortOrder('code'),
                  width: 110,
                },
                {
                  title: t.columns.name,
                  dataIndex: 'name',
                  key: 'name',
                  sorter: true,
                  sortOrder: sortOrder('name'),
                  render: (v: string) => <strong>{v}</strong>,
                },
                {
                  title: t.columns.group,
                  dataIndex: 'groupName',
                  key: 'group',
                  sorter: true,
                  sortOrder: sortOrder('group'),
                },
                {
                  title: t.columns.line,
                  dataIndex: 'lineName',
                  key: 'line',
                  sorter: true,
                  sortOrder: sortOrder('line'),
                },
                {
                  title: t.columns.businessTypes,
                  render: (_, p) => p.businessTypeNames.map((n) => <Tag key={n}>{n}</Tag>),
                },
                {
                  title: t.columns.pack,
                  key: 'packSize',
                  sorter: true,
                  sortOrder: sortOrder('packSize'),
                  align: 'right',
                  render: (_, p) => `${formatNumber(p.packSize)} ${p.unit}`,
                },
                {
                  title: t.columns.minQty,
                  key: 'minQty',
                  sorter: true,
                  sortOrder: sortOrder('minQty'),
                  align: 'right',
                  render: (_, p) => `${formatNumber(p.minQty)} / ${formatNumber(p.multiple)}`,
                },
                {
                  title: t.columns.price,
                  key: 'price',
                  sorter: true,
                  sortOrder: sortOrder('price'),
                  align: 'right',
                  render: (_, p) => priceCell(p),
                },
                { title: t.columns.vat, align: 'right', render: (_, p) => `${p.vatRate}%` },
                { title: t.columns.state, render: (_, p) => state(p) },
                { title: '', render: (_, p) => actions(p) },
              ]}
            />
          )}
        </>
      )}

      {refs && editing !== undefined && (
        <ProductDrawer
          key={editing?.id ?? 'new'}
          product={editing}
          refs={refs}
          open
          onClose={() => setEditing(undefined)}
        />
      )}
      <PriceDrawer productId={pricing} onClose={() => setPricing(null)} />

      <Modal
        open={btModal}
        title={t.bulk.pickBt}
        okText={t.bulk.apply}
        cancelText={ru.common.cancel}
        okButtonProps={{ disabled: !btIds.length }}
        onOk={async () => {
          await run({ businessTypeIds: btIds, businessMode: btMode })
          setBtModal(false)
        }}
        onCancel={() => setBtModal(false)}
        destroyOnHidden
      >
        <Space direction="vertical" size={16}>
          <Checkbox.Group
            value={btIds}
            onChange={(v) => setBtIds(v as Id[])}
            options={(refs?.businessTypes ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
          <Radio.Group value={btMode} onChange={(e) => setBtMode(e.target.value)}>
            <Space direction="vertical">
              <Radio value="add">{t.bulk.addBt}</Radio>
              <Radio value="replace">{t.bulk.replaceBt}</Radio>
            </Space>
          </Radio.Group>
        </Space>
      </Modal>
    </>
  )
}
