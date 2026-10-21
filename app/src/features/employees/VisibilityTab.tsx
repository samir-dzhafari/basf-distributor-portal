import { useState } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { Link } from 'react-router-dom'
import { Alert, Card, Col, Empty, Input, Row, Select, Skeleton, Statistic, Table, Tabs, Tag } from 'antd'
import { errorMessage } from '@/app/api'
import type { VisibilityReason } from '@/mocks/access'
import { ru } from '@/shared/i18n/ru'
import { StatusTag } from '@/shared/ui/StatusTag'
import {
  useExplainOrderMutation,
  useGetVisibilityQuery,
  type OrderExplanation,
  type VisibilityReport,
} from './employeesApi'

const t = ru.employees.visibility
const KIND_COLOR: Record<VisibilityReason['kind'], string> = {
  admin: 'purple',
  creator: 'default',
  application: 'gold',
  client: 'green',
  region: 'blue',
  own: 'green',
}

function Reasons({ reasons }: { reasons: VisibilityReason[] }) {
  return (
    <ul className="reason-list">
      {reasons.map((r, i) => (
        <li key={i}>
          <Tag color={KIND_COLOR[r.kind]}>{t.kinds[r.kind]}</Tag>
          <span>{r.detail}</span>
        </li>
      ))}
    </ul>
  )
}

function Check({ employeeId }: { employeeId: string }) {
  const [number, setNumber] = useState('')
  const [explain, { isLoading }] = useExplainOrderMutation()
  const [result, setResult] = useState<OrderExplanation>()
  const [error, setError] = useState<string>()

  const run = async () => {
    if (!number.trim()) return
    setError(undefined)
    const r = await explain({ employeeId, number })
    if ('error' in r) setError(errorMessage(r.error))
    else setResult(r.data)
  }

  return (
    <Card title={t.checkTitle} size="small" style={{ marginBottom: 16 }}>
      <p className="muted">{t.checkHint}</p>
      <Input.Search
        size="large"
        enterButton={t.check}
        loading={isLoading}
        placeholder={t.checkPlaceholder}
        aria-label={t.checkTitle}
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        onSearch={run}
        style={{ maxWidth: 520 }}
      />
      {error && <Alert type="error" showIcon message={error} style={{ marginTop: 12 }} />}
      {result && !result.found && <Alert type="warning" showIcon message={t.notFound} style={{ marginTop: 12 }} />}
      {result?.found && (
        <Alert
          style={{ marginTop: 12 }}
          type={result.visible ? 'success' : 'error'}
          showIcon
          message={result.visible ? t.visibleYes(result.number!) : t.visibleNo(result.number!)}
          description={
            result.visible ? (
              <>
                <strong>{t.because}</strong>
                <Reasons reasons={result.reasons ?? []} />
              </>
            ) : (
              <>
                <strong>{t.missing}</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {result.missing?.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </>
            )
          }
        />
      )}
    </Card>
  )
}

/** «Что видит сотрудник и почему»: клиенты и заказы с основаниями, проверка конкретного заказа. Только просмотр. */
export function VisibilityTab({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError, error, refetch } = useGetVisibilityQuery(employeeId)
  const [kind, setKind] = useState<VisibilityReason['kind']>()

  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />
  if (isError || !data) return <ErrorState error={error} onRetry={refetch} />

  const orders = data.orders.filter((o) => !kind || o.reasons.some((r) => r.kind === kind))

  return (
    <div>
      <Alert type="info" showIcon message={t.readOnly} style={{ marginBottom: 16 }} />
      {data.employee.fullAccess && <Alert type="success" showIcon message={t.admin} style={{ marginBottom: 16 }} />}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title={ru.employees.zone.clients} value={data.totals.clients} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title={t.tabOrders} value={`${data.totals.orders} из ${data.totals.ordersAll}`} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title={ru.employees.zone.regions} value={data.zone.regions} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title={ru.employees.columns.subs} value={data.zone.subordinates} />
          </Card>
        </Col>
      </Row>

      <Check employeeId={employeeId} />

      {!data.totals.clients && !data.employee.fullAccess ? (
        <Card>
          <Empty description={t.empty} />
        </Card>
      ) : (
        <Tabs
          items={[
            {
              key: 'clients',
              label: `${t.tabClients} (${data.clients.length})`,
              children: (
                <Table<VisibilityReport['clients'][number]>
                  rowKey="id"
                  size="middle"
                  pagination={data.clients.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
                  dataSource={data.clients}
                  scroll={{ x: 'max-content' }}
                  columns={[
                    { title: t.colClient, render: (_, c) => <strong>{c.name}</strong> },
                    { title: t.colRegion, render: (_, c) => c.regionNames.join(', ') },
                    { title: t.colVisible, align: 'right', render: (_, c) => `${c.ordersVisible} / ${c.ordersTotal}` },
                    { title: t.colWhy, render: (_, c) => <Reasons reasons={c.reasons} /> },
                  ]}
                />
              ),
            },
            {
              key: 'orders',
              label: `${t.tabOrders} (${data.totals.orders})`,
              children: (
                <>
                  <Select
                    allowClear
                    placeholder={t.filterKind}
                    aria-label={t.filterKind}
                    style={{ minWidth: 220, marginBottom: 12 }}
                    value={kind}
                    onChange={setKind}
                    options={(Object.keys(t.kinds) as (keyof typeof t.kinds)[]).map((k) => ({
                      value: k,
                      label: t.kinds[k],
                    }))}
                  />
                  <Table<VisibilityReport['orders'][number]>
                    rowKey="id"
                    size="middle"
                    pagination={orders.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
                    dataSource={orders}
                    scroll={{ x: 'max-content' }}
                    columns={[
                      {
                        title: t.colOrder,
                        render: (_, o) => (
                          <Link to={`/orders/${o.id}`}>
                            <strong>{o.number}</strong>
                          </Link>
                        ),
                      },
                      { title: t.colClient, dataIndex: 'clientName' },
                      { title: t.colRegion, dataIndex: 'regionName' },
                      { title: t.colType, dataIndex: 'businessTypeName' },
                      { title: t.colStatus, render: (_, o) => <StatusTag status={o.status} /> },
                      { title: t.colWhy, render: (_, o) => <Reasons reasons={o.reasons} /> },
                    ]}
                  />
                  {data.totals.orders > 300 && <p className="muted">{t.limit}</p>}
                </>
              ),
            },
          ]}
        />
      )}
    </div>
  )
}
