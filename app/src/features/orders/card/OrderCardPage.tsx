import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, App, Button, Card, Col, Descriptions, Result, Row, Skeleton, Space, Tooltip } from 'antd'
import { ArrowLeftOutlined, CloseCircleOutlined, EditOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { useMe } from '@/features/auth/useMe'
import { ru } from '@/shared/i18n/ru'
import { formatDate, formatDateTime } from '@/shared/lib/format'
import { PageHeader } from '@/shared/ui/PageHeader'
import { StatusTag } from '@/shared/ui/StatusTag'
import { useRetryExchangeMutation } from '@/features/exchange/exchangeApi'
import { CANCELLABLE, useGetOrderQuery } from '../ordersViewApi'
import { CancelOrderModal } from './CancelOrderModal'
import { EditHeaderDrawer } from './EditHeaderDrawer'
import { OrderComments } from './OrderComments'
import { OrderDocuments } from './OrderDocuments'
import { OrderHistory } from './OrderHistory'
import { OrderItems } from './OrderItems'

const t = ru.orders.card

export default function OrderCardPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data, isLoading, isError, error, refetch } = useGetOrderQuery(id, { pollingInterval: 5000 })
  const [editing, setEditing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const { message } = App.useApp()
  const [retry, { isLoading: retrying }] = useRetryExchangeMutation()

  const back = (
    <Button
      type="link"
      icon={<ArrowLeftOutlined />}
      style={{ paddingLeft: 0, marginBottom: 8 }}
      onClick={() => navigate('/orders')}
    >
      {t.back}
    </Button>
  )

  if (isLoading || !me) return <Skeleton active paragraph={{ rows: 10 }} />
  if (isError || !data) {
    return (
      <>
        {back}
        <Result
          status="404"
          title={t.notFoundTitle}
          subTitle={t.notFoundText}
          extra={<Button onClick={() => refetch()}>{ru.orders.list.retry}</Button>}
        />
        <Alert type="info" message={errorMessage(error)} />
      </>
    )
  }

  const { order, names, items, totals, history, documents, can, exchange } = data
  const rejection = history.find((h) => h.action === 'Заказ отклонён')
  const onRetry = async () => {
    const r = await retry({ orderId: order.id })
    if ('error' in r) message.error(errorMessage(r.error))
    else message.success(ru.exchange.retried(r.data.retried))
  }
  const isDraft = order.status === 'draft'
  const number = order.number || ru.orders.draft
  const sent = !CANCELLABLE.includes(order.status) && !['cancelled', 'rejected', 'draft'].includes(order.status)

  return (
    <>
      {back}
      <PageHeader
        title={isDraft ? t.draftTitle : t.title(number)}
        subtitle={`${t.created} ${formatDateTime(order.createdAt)} · ${names.creator}`}
        extra={
          <Space wrap size={8}>
            <StatusTag status={order.status} />
            {can.approve && (
              <Link to={`/approvals/${order.id}`}>
                <Button type="primary" size="large">
                  {ru.approvals.card.review}
                </Button>
              </Link>
            )}
            {can.resume && (
              <Link to={`/orders/${order.id}/edit`}>
                <Button type="primary" size="large">
                  {t.resume}
                </Button>
              </Link>
            )}
            {can.edit && (
              <Button size="large" icon={<EditOutlined />} onClick={() => setEditing(true)}>
                {t.edit}
              </Button>
            )}
            {can.cancel && (
              <Button size="large" danger icon={<CloseCircleOutlined />} onClick={() => setCancelling(true)}>
                {t.cancel}
              </Button>
            )}
            {!can.cancel && sent && me.user.kind === 'employee' && (
              <Tooltip title={t.cantCancelHint}>
                <Button size="large" disabled icon={<CloseCircleOutlined />}>
                  {t.cancel}
                </Button>
              </Tooltip>
            )}
          </Space>
        }
      />

      {can.approveBlocked && <Alert type="info" showIcon message={can.approveBlocked} style={{ marginBottom: 16 }} />}
      {order.status === 'rejected' && rejection && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={ru.approvals.card.rejectedTitle}
          description={
            <>
              <div style={{ overflowWrap: 'anywhere' }}>{rejection.details}</div>
              <div className="muted">{ru.approvals.card.rejectedBy(rejection.userName)}</div>
            </>
          }
        />
      )}
      {order.status === 'error' && exchange && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            me.user.kind === 'employee'
              ? ru.exchange.errorAlert(exchange.lastError ?? '')
              : ru.exchange.errorAlertClient
          }
          action={
            can.retry && (
              <Button danger loading={retrying} onClick={onRetry}>
                {ru.exchange.retry}
              </Button>
            )
          }
        />
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={15}>
          <Card title={t.details} style={{ marginBottom: 24 }}>
            <Descriptions column={{ xs: 1, md: 2 }} layout="vertical" size="small" colon={false}>
              {me.user.kind === 'employee' && <Descriptions.Item label={t.client}>{names.client}</Descriptions.Item>}
              <Descriptions.Item label={t.consignee}>
                <div>
                  {names.consignee}
                  {names.consigneeAddress && <div className="muted">{names.consigneeAddress}</div>}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label={t.region}>{names.region}</Descriptions.Item>
              <Descriptions.Item label={t.city}>{order.city || '—'}</Descriptions.Item>
              <Descriptions.Item label={t.businessType}>{names.businessType}</Descriptions.Item>
              <Descriptions.Item label={t.application}>{names.application}</Descriptions.Item>
              <Descriptions.Item label={t.payment}>{names.payment}</Descriptions.Item>
              <Descriptions.Item label={t.delivery}>{names.delivery}</Descriptions.Item>
              <Descriptions.Item label={t.desiredDate}>{formatDate(order.desiredDate)}</Descriptions.Item>
              {!isDraft && (
                <Descriptions.Item label={t.erp}>
                  {order.erpNumber ?? <span className="muted">{t.erpNone}</span>}
                </Descriptions.Item>
              )}
              {names.responsible && <Descriptions.Item label={t.responsible}>{names.responsible}</Descriptions.Item>}
            </Descriptions>
          </Card>
          <Card title={t.items(items.length)}>
            <OrderItems items={items} totals={totals} />
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Card title={t.comments} style={{ marginBottom: 24 }}>
            <OrderComments order={order} editable={can.comment} />
          </Card>
          {!isDraft && (
            <Card title={t.documents} style={{ marginBottom: 24 }}>
              <OrderDocuments orderId={order.id} documents={documents} canUpload={can.upload} />
            </Card>
          )}
          <Card title={t.history}>
            <OrderHistory history={history} />
          </Card>
        </Col>
      </Row>

      <EditHeaderDrawer order={order} open={editing} onClose={() => setEditing(false)} />
      <CancelOrderModal orderId={order.id} number={number} open={cancelling} onClose={() => setCancelling(false)} />
    </>
  )
}
