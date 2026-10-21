import { useState } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { clickableRow } from '@/shared/lib/tableRow'
import { Card, Col, Descriptions, Drawer, Empty, Input, Row, Select, Table, Tabs, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { ru } from '@/shared/i18n/ru'
import { SAMPLE_EMAIL_DATA, renderEmail } from '@/shared/lib/emailTemplates'
import { formatDateTime } from '@/shared/lib/format'
import { NOTIFICATION_META } from '@/shared/lib/notificationMeta'
import { NOTIFICATION_TYPES, type NotificationType } from '@/shared/types/domain'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useGetSettingsQuery } from '../settings/settingsApi'
import { useDebounced } from '../orders/list/useDebounced'
import { useGetEmailQuery, useListEmailsQuery, type EmailRow } from './notificationsApi'

const t = ru.notifications.admin

const STATUS_BY_TYPE: Record<NotificationType, string> = {
  'order.submitted': 'На одобрении',
  'order.approved': 'Передан в 1С',
  'order.rejected': 'Отклонён',
  'order.changed': 'Передан в 1С',
  'order.cancelled': 'Отменён',
  'exchange.sent': 'Передан в 1С',
  'exchange.error': 'Ошибка передачи',
  'exchange.accepted': 'Принят в 1С',
  'exchange.completed': 'Выполнен',
  'document.uploaded': 'Выполнен',
}

/** Письмо в изолированной рамке: скрипты и внешние ресурсы в нём не выполняются. */
function MailFrame({ html, height = 560 }: { html: string; height?: number }) {
  return (
    <iframe
      title="Просмотр письма"
      sandbox=""
      srcDoc={html}
      style={{ width: '100%', height, border: '1px solid #DDE0E0', borderRadius: 8, background: '#fff' }}
    />
  )
}

function Templates() {
  const [type, setType] = useState<NotificationType>('order.submitted')
  const { data } = useGetSettingsQuery()
  const meta = NOTIFICATION_META[type]
  const mail = renderEmail(type, {
    number: 'P-001040',
    clientName: 'ООО «Агро Комплект»',
    applicationNumber: '114-ДС1-СЗР_ДВ',
    total: '123 769,00 ₽',
    status: STATUS_BY_TYPE[type],
    link: '#/orders/or-1',
    senderEmail: data?.settings.senderEmail ?? 'noreply@basf-demo.ru',
    ...SAMPLE_EMAIL_DATA[type],
  })
  return (
    <Row gutter={[24, 24]}>
      <Col xs={24} lg={9}>
        <Card size="small">
          <label className="field__label" htmlFor="mail-type">
            {t.event}
          </label>
          <Select
            id="mail-type"
            size="large"
            style={{ width: '100%', marginBottom: 16 }}
            value={type}
            onChange={setType}
            options={NOTIFICATION_TYPES.map((x) => ({ value: x, label: NOTIFICATION_META[x].label }))}
          />
          <Descriptions column={1} size="small" layout="vertical" colon={false}>
            <Descriptions.Item label={t.recipients}>{meta.audience}</Descriptions.Item>
            <Descriptions.Item label={t.subject}>
              <strong>{mail.subject}</strong>
            </Descriptions.Item>
          </Descriptions>
          <p className="muted" style={{ marginBottom: 0 }}>
            {t.sample}
          </p>
        </Card>
      </Col>
      <Col xs={24} lg={15}>
        <MailFrame html={mail.html} />
      </Col>
    </Row>
  )
}

function Sent() {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const { data, isError, error, refetch } = useListEmailsQuery(
    { q: dq, kind, page, pageSize: 15 },
    { refetchOnMountOrArgChange: true },
  )
  const [openId, setOpenId] = useState<string | null>(null)
  const { data: mail } = useGetEmailQuery(openId ?? '', { skip: !openId })

  if (isError) return <ErrorState error={error} onRetry={refetch} />
  const kindLabel = (k?: string) =>
    k && k in NOTIFICATION_META ? NOTIFICATION_META[k as NotificationType].label : t.invite

  return (
    <>
      <p className="muted">{t.demoNote}</p>
      <div className="list-toolbar" style={{ gridTemplateColumns: '2fr 1fr' }}>
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
          placeholder={t.anyKind}
          aria-label={t.colKind}
          value={kind || undefined}
          onChange={(v) => {
            setKind(v ?? '')
            setPage(1)
          }}
          options={(data?.kinds ?? []).map((k) => ({ value: k, label: kindLabel(k) }))}
        />
      </div>
      <Table<EmailRow>
        rowKey="id"
        dataSource={data?.rows ?? []}
        rowClassName="order-row"
        onRow={(e) => clickableRow(() => setOpenId(e.id))}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description={t.empty} /> }}
        pagination={{
          current: page,
          pageSize: 15,
          total: data?.total ?? 0,
          showSizeChanger: false,
          onChange: setPage,
          showTotal: t.found,
          hideOnSinglePage: (data?.total ?? 0) <= 15,
        }}
        columns={[
          { title: t.colTime, render: (_, e) => formatDateTime(e.at), width: 160 },
          { title: t.colTo, dataIndex: 'to' },
          { title: t.colSubject, dataIndex: 'subject', render: (v: string) => <strong>{v}</strong> },
          { title: t.colKind, render: (_, e) => <Tag>{kindLabel(e.kind)}</Tag> },
        ]}
      />
      <Drawer
        open={!!openId}
        onClose={() => setOpenId(null)}
        destroyOnHidden
        width={Math.min(680, window.innerWidth)}
        title={mail?.subject ?? ''}
      >
        {mail && (
          <>
            <Descriptions column={1} size="small" colon={false} style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t.from}>{mail.from}</Descriptions.Item>
              <Descriptions.Item label={t.colTo}>{mail.to}</Descriptions.Item>
              <Descriptions.Item label={t.colTime}>{formatDateTime(mail.at)}</Descriptions.Item>
            </Descriptions>
            {mail.html ? (
              <MailFrame html={mail.html} height={520} />
            ) : (
              <pre style={{ whiteSpace: 'pre-wrap' }}>{mail.body}</pre>
            )}
          </>
        )}
      </Drawer>
    </>
  )
}

/** Письма: просмотр шаблонов по событиям и журнал отправленных писем (фич-лист 13.2). */
export default function MailPage() {
  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <Tabs
        items={[
          { key: 'templates', label: t.tabTemplates, children: <Templates /> },
          { key: 'sent', label: t.tabSent, children: <Sent /> },
        ]}
      />
    </>
  )
}
