import { useNavigate } from 'react-router-dom'
import { clickableRow } from '@/shared/lib/tableRow'
import { Alert, Button, Card, Empty, Grid, Skeleton, Table } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { formatDateTime, formatMoney } from '@/shared/lib/format'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useGetApprovalQueueQuery, type QueueRow } from './approvalsApi'

const t = ru.approvals

/** Сколько ждёт: после суток подсвечиваем, чтобы заказ не залежался. */
function Waiting({ hours }: { hours: number }) {
  return <span style={hours >= 24 ? { color: '#A85F00', fontWeight: 600 } : undefined}>{t.waitingHours(hours)}</span>
}

export default function ApprovalQueuePage() {
  const navigate = useNavigate()
  const isMobile = !Grid.useBreakpoint().lg
  const { data, isLoading, isError, error, refetch } = useGetApprovalQueueQuery(undefined, { pollingInterval: 15000 })
  const open = (o: QueueRow) => navigate(`/approvals/${o.id}`)

  return (
    <>
      <PageHeader
        title={t.title}
        subtitle={data?.length ? `${t.subtitle} ${t.queueCount(data.length)}.` : t.subtitle}
      />
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : isError ? (
        <Alert
          type="error"
          showIcon
          message={errorMessage(error)}
          action={<Button onClick={() => refetch()}>{ru.orders.list.retry}</Button>}
        />
      ) : !data?.length ? (
        <Card>
          <Empty
            image={<CheckCircleOutlined style={{ fontSize: 56, color: '#00793A' }} />}
            description={<strong>{t.emptyTitle}</strong>}
          >
            <p className="muted">{t.emptyText}</p>
          </Empty>
        </Card>
      ) : isMobile ? (
        <div className="order-cards">
          {data.map((o) => (
            <button key={o.id} type="button" className="order-card" onClick={() => open(o)}>
              <span className="order-card__top">
                <strong>{o.number}</strong>
                <span>
                  {t.waiting}: <Waiting hours={o.waitingHours} />
                </span>
              </span>
              <span>{o.clientName}</span>
              <span className="muted">
                {formatDateTime(o.createdAt)} · {o.applicationNumber}
              </span>
              <span className="order-card__bottom">
                <span className="muted">{o.creatorName}</span>
                <strong>{formatMoney(o.total)}</strong>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Table<QueueRow>
          rowKey="id"
          dataSource={data}
          pagination={false}
          rowClassName="order-row"
          onRow={(o) => clickableRow(() => open(o))}
          columns={[
            {
              title: t.colNumber,
              dataIndex: 'number',
              render: (v: string) => <strong style={{ whiteSpace: 'nowrap' }}>{v}</strong>,
            },
            { title: t.colCreated, dataIndex: 'createdAt', render: (v: string) => formatDateTime(v) },
            { title: t.waiting, dataIndex: 'waitingHours', render: (h: number) => <Waiting hours={h} /> },
            { title: t.colClient, dataIndex: 'clientName' },
            { title: t.colApplication, dataIndex: 'applicationNumber' },
            { title: t.colCreator, dataIndex: 'creatorName' },
            { title: t.colTotal, dataIndex: 'total', align: 'right', render: (v: number) => formatMoney(v) },
            {
              title: '',
              render: (_, o) => (
                <Button
                  type="primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    open(o)
                  }}
                >
                  {t.review}
                </Button>
              ),
            },
          ]}
        />
      )}
    </>
  )
}
