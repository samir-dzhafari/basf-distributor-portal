import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, App, Button, Card, Descriptions, Input, Result, Skeleton, Typography } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format'
import { calcOrder } from '@/shared/lib/money'
import { PageHeader } from '@/shared/ui/PageHeader'
import { StatusTag } from '@/shared/ui/StatusTag'
import { useGetOrderQuery } from '../orders/ordersViewApi'
import { OrderComments } from '../orders/card/OrderComments'
import { useApproveOrderMutation } from './approvalsApi'
import { ApprovalItems, effectiveQty, type Changes } from './ApprovalItems'
import { RejectModal } from './RejectModal'

const t = ru.approvals.page

export default function ApprovalPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const { data, isLoading, isError, error } = useGetOrderQuery(id)
  const [approve, { isLoading: approving }] = useApproveOrderMutation()
  const [changes, setChanges] = useState<Changes>({})
  const [comment, setComment] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const items = useMemo(() => data?.items ?? [], [data])
  const totals = useMemo(
    () =>
      calcOrder(
        items.flatMap((i) => {
          const qty = effectiveQty(i, changes)
          return qty > 0 ? [{ price: i.price, qty, vatRate: i.vatRate }] : []
        }),
      ),
    [items, changes],
  )

  const back = (
    <Button
      type="link"
      icon={<ArrowLeftOutlined />}
      style={{ paddingLeft: 0, marginBottom: 8 }}
      onClick={() => navigate('/approvals')}
    >
      {t.back}
    </Button>
  )

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />
  if (isError || !data) {
    return (
      <>
        {back}
        <Result status="404" title={ru.orders.card.notFoundTitle} subTitle={errorMessage(error)} />
      </>
    )
  }

  const { order, names, can } = data
  const changeCount = Object.keys(changes).length
  const remaining = items.filter((i) => effectiveQty(i, changes) > 0).length

  const onChange = (itemId: string, qty: number | null) =>
    setChanges((prev) => {
      const next = { ...prev }
      const original = items.find((i) => i.id === itemId)?.qty
      if (qty === null || qty === original) delete next[itemId]
      else next[itemId] = qty
      return next
    })

  const doApprove = () => {
    if (remaining === 0) return void message.warning(t.nothingLeft)
    modal.confirm({
      title: t.approveTitle,
      content: t.approveText(formatMoney(totals.gross)),
      okText: t.approveOk,
      cancelText: t.approveCancel,
      okButtonProps: { size: 'large' },
      cancelButtonProps: { size: 'large' },
      onOk: async () => {
        const r = await approve({ id: order.id, changes, comment })
        if ('error' in r) return void message.error(errorMessage(r.error))
        message.success(t.approved(r.data.number))
        navigate('/approvals')
      },
    })
  }

  if (!can.approve) {
    return (
      <>
        {back}
        <Result
          status={can.approveBlocked ? 'warning' : 'info'}
          title={can.approveBlocked ? t.blockedTitle : t.notPendingTitle}
          subTitle={can.approveBlocked ?? t.notPendingText}
          extra={
            <Link to={`/orders/${order.id}`}>
              <Button type="primary" size="large">
                {t.openCard}
              </Button>
            </Link>
          }
        />
      </>
    )
  }

  return (
    <>
      {back}
      <PageHeader
        title={t.title(order.number)}
        subtitle={`${ru.orders.card.created} ${formatDateTime(order.createdAt)} · ${names.creator}`}
        extra={
          <>
            <StatusTag status={order.status} />
            <Link to={`/orders/${order.id}`} style={{ marginLeft: 12 }}>
              {t.openCard}
            </Link>
          </>
        }
      />

      <Card title={t.header} style={{ marginBottom: 24 }}>
        <Descriptions column={{ xs: 1, md: 2, xl: 3 }} layout="vertical" size="small" colon={false}>
          <Descriptions.Item label={ru.orders.card.client}>{names.client}</Descriptions.Item>
          <Descriptions.Item label={ru.orders.card.consignee}>
            <div>
              {names.consignee}
              <div className="muted">{names.consigneeAddress}</div>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label={ru.orders.card.region}>{names.region}</Descriptions.Item>
          <Descriptions.Item label={ru.orders.card.businessType}>{names.businessType}</Descriptions.Item>
          <Descriptions.Item label={ru.orders.card.application}>{names.application}</Descriptions.Item>
          <Descriptions.Item label={ru.orders.card.payment}>{names.payment}</Descriptions.Item>
          <Descriptions.Item label={ru.orders.card.delivery}>{names.delivery}</Descriptions.Item>
          <Descriptions.Item label={ru.orders.card.desiredDate}>{formatDate(order.desiredDate)}</Descriptions.Item>
        </Descriptions>
        {(order.comments.client || order.comments.manager || order.comments.admin) && (
          <div style={{ marginTop: 16 }}>
            <OrderComments order={order} editable={null} />
          </div>
        )}
      </Card>

      <Card title={t.items} style={{ marginBottom: 24 }}>
        <Typography.Paragraph type="secondary">{t.itemsHint}</Typography.Paragraph>
        <ApprovalItems items={items} changes={changes} onChange={onChange} />
        <dl className="totals">
          <div className="totals__grand">
            <dt>{ru.orders.card.grand}</dt>
            <dd>{formatMoney(totals.gross)}</dd>
          </div>
        </dl>
      </Card>

      <Card title={t.comment}>
        <Input.TextArea
          rows={3}
          maxLength={500}
          showCount
          value={comment}
          aria-label={t.comment}
          placeholder={t.commentHint}
          onChange={(e) => setComment(e.target.value)}
        />
      </Card>

      {remaining === 0 && <Alert type="warning" showIcon message={t.nothingLeft} style={{ marginTop: 16 }} />}

      <div className="wizard-footer">
        <div className="wizard-footer__mid" style={{ textAlign: 'left' }}>
          {changeCount ? t.summaryChanges(changeCount) : <span className="muted">{t.summaryNone}</span>}
        </div>
        <Button size="large" danger icon={<CloseOutlined />} onClick={() => setRejecting(true)}>
          {t.reject}
        </Button>
        <Button type="primary" size="large" icon={<CheckOutlined />} loading={approving} onClick={doApprove}>
          {t.approve}
        </Button>
      </div>

      <RejectModal
        orderId={order.id}
        number={order.number}
        open={rejecting}
        onClose={() => setRejecting(false)}
        onDone={() => navigate('/approvals')}
      />
    </>
  )
}
