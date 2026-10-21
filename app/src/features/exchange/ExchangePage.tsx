import { useState } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { Link } from 'react-router-dom'
import {
  App,
  Button,
  Card,
  Col,
  Collapse,
  Empty,
  Radio,
  Row,
  Skeleton,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { formatDateTime, formatMoney } from '@/shared/lib/format'
import { PageHeader } from '@/shared/ui/PageHeader'
import { StatusTag } from '@/shared/ui/StatusTag'
import type { ExchangeMode } from '@/shared/types/domain'
import {
  useGetExchangeQuery,
  useRetryExchangeMutation,
  useSetExchangeModeMutation,
  type ExchangeRow,
} from './exchangeApi'

const t = ru.exchange

export default function ExchangePage() {
  const { message } = App.useApp()
  const { data, isLoading, isError, error, refetch } = useGetExchangeQuery(undefined, { pollingInterval: 4000 })
  const [setMode] = useSetExchangeModeMutation()
  const [retry, { isLoading: retrying }] = useRetryExchangeMutation()
  const [onlyErrors, setOnlyErrors] = useState(false)

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />
  if (isError || !data) return <ErrorState error={error} onRetry={refetch} />

  const rows = onlyErrors ? data.rows.filter((r) => r.job.status === 'error') : data.rows

  const doRetry = async (orderId?: string) => {
    const r = await retry({ orderId })
    if ('error' in r) message.error(errorMessage(r.error))
    else message.success(t.retried(r.data.retried))
  }

  const onMode = async (mode: ExchangeMode) => {
    const r = await setMode(mode)
    if ('error' in r) message.error(errorMessage(r.error))
    else message.success(t.modeSaved)
  }

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        extra={
          <Button
            size="large"
            type={data.counts.error ? 'primary' : 'default'}
            icon={<ReloadOutlined />}
            disabled={!data.counts.error}
            loading={retrying}
            onClick={() => doRetry()}
          >
            {t.retryAll}
          </Button>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {(['error', 'sent', 'accepted', 'completed'] as const).map((k) => (
          <Col key={k} xs={12} md={6}>
            <Card size="small">
              <Statistic
                title={t.stats[k]}
                value={data.counts[k]}
                valueStyle={k === 'error' && data.counts.error ? { color: '#C50022' } : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" title={t.modeTitle} style={{ marginBottom: 24 }}>
        <Typography.Paragraph type="secondary">{t.modeHint}</Typography.Paragraph>
        <Radio.Group
          value={data.mode}
          onChange={(e) => onMode(e.target.value as ExchangeMode)}
          optionType="button"
          buttonStyle="solid"
          size="large"
        >
          {(Object.keys(t.modes) as ExchangeMode[]).map((m) => (
            <Radio.Button key={m} value={m}>
              {t.modes[m]}
            </Radio.Button>
          ))}
        </Radio.Group>
      </Card>

      <Card
        title={ru.exchange.title}
        extra={
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <Switch checked={onlyErrors} onChange={setOnlyErrors} /> {t.onlyErrors}
          </label>
        }
        style={{ marginBottom: 24 }}
      >
        <Table<ExchangeRow>
          rowKey={(r) => r.job.id}
          dataSource={rows}
          pagination={rows.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description={onlyErrors ? t.emptyErrors : t.empty} /> }}
          columns={[
            {
              title: t.colOrder,
              render: (_, r) => (
                <Link to={`/orders/${r.job.orderId}`}>
                  <strong>{r.orderNumber}</strong>
                </Link>
              ),
            },
            { title: t.colClient, dataIndex: 'clientName' },
            {
              title: t.colStatus,
              render: (_, r) => <StatusTag status={r.job.status === 'cancelled' ? 'cancelled' : r.job.status} />,
            },
            { title: t.colErp, render: (_, r) => r.job.erpNumber ?? '—' },
            { title: t.colAttempts, align: 'right', render: (_, r) => r.job.attempts },
            { title: t.colUpdated, render: (_, r) => formatDateTime(r.job.updatedAt) },
            {
              title: t.colError,
              render: (_, r) => (r.job.lastError ? <span style={{ color: '#C50022' }}>{r.job.lastError}</span> : '—'),
            },
            { title: ru.orders.list.columns.total, align: 'right', render: (_, r) => formatMoney(r.total) },
            {
              title: '',
              render: (_, r) =>
                r.job.status === 'error' ? (
                  <Button
                    type="primary"
                    ghost
                    icon={<ReloadOutlined />}
                    loading={retrying}
                    onClick={() => doRetry(r.job.orderId)}
                  >
                    {t.retry}
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>

      <Collapse
        items={[
          {
            key: 'log',
            label: t.log,
            children: data.log.length ? (
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {data.log.map((l) => (
                  <li key={l.id} style={{ padding: '4px 0' }}>
                    <Tag color={l.level === 'error' ? 'red' : 'default'}>{formatDateTime(l.at)}</Tag>
                    {l.message}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="muted">{t.logEmpty}</span>
            ),
          },
        ]}
      />
    </>
  )
}
