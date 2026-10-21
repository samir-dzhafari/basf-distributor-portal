import { useState } from 'react'
import { Alert, App, Button, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Typography } from 'antd'
import { BellOutlined, MailOutlined, PlusOutlined, StopOutlined, UnlockOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { UserSubscriptionsModal } from '@/features/notifications/UserSubscriptionsModal'
import { useSetCommonEmailMutation } from '@/features/notifications/notificationsApi'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { isEmail, isPhone } from '@/shared/lib/requisites'
import type { UserStatus } from '@/shared/types/domain'
import {
  useAddClientUserMutation,
  useResendInviteMutation,
  useSetClientUserBlockedMutation,
  type ClientDetail,
  type ClientUserRow,
} from '../clientsApi'

const t = ru.clients.users

const STATUS: Record<UserStatus, { label: string; color: string }> = {
  active: { label: t.active, color: 'green' },
  invited: { label: t.invited, color: 'gold' },
  blocked: { label: t.blocked, color: 'red' },
}

/** Пользователи компании: добавить, заблокировать, повторно пригласить. Лимит задаёт администратор. */
export function UsersTab({ detail }: { detail: ClientDetail }) {
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [lastInvite, setLastInvite] = useState<string>()
  const [form] = Form.useForm()
  const [add, { isLoading: adding }] = useAddClientUserMutation()
  const [setBlocked] = useSetClientUserBlockedMutation()
  const [resend] = useResendInviteMutation()
  const { users, userLimit, client } = detail
  const full = users.length >= userLimit
  const [subsFor, setSubsFor] = useState<ClientUserRow | null>(null)
  const [setCommon] = useSetCommonEmailMutation()

  const onAdd = async (v: { email: string; firstName: string; lastName: string; phone: string }) => {
    const r = await add({ clientId: client.id, ...v, phone: v.phone ?? '' })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.added)
    setLastInvite(r.data.inviteLink)
    form.resetFields()
    setOpen(false)
  }

  const onResend = async (u: ClientUserRow) => {
    const r = await resend({ userId: u.id })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.sent)
    setLastInvite(r.data.inviteLink)
  }

  const onBlock = async (u: ClientUserRow, blocked: boolean) => {
    const r = await setBlocked({ userId: u.id, blocked })
    if ('error' in r) message.error(errorMessage(r.error))
    else message.success(blocked ? t.blockedDone : t.unblockedDone)
  }

  const actions = (u: ClientUserRow) => (
    <Space wrap>
      {u.status === 'blocked' ? (
        <Button icon={<UnlockOutlined />} onClick={() => onBlock(u, false)}>
          {t.unblock}
        </Button>
      ) : (
        <Popconfirm
          title={t.blockTitle}
          description={t.blockText}
          okText={t.block}
          cancelText={ru.clients.cancel}
          okButtonProps={{ danger: true }}
          onConfirm={() => onBlock(u, true)}
        >
          <Button danger icon={<StopOutlined />}>
            {t.block}
          </Button>
        </Popconfirm>
      )}
      <Button icon={<BellOutlined />} onClick={() => setSubsFor(u)}>
        {ru.notifications.userSubs.button}
      </Button>
      {u.status === 'invited' && (
        <Button icon={<MailOutlined />} onClick={() => onResend(u)}>
          {t.resend}
        </Button>
      )}
    </Space>
  )

  return (
    <div>
      <div className="tab-head">
        <div>
          <strong>{t.limit(users.length, userLimit)}</strong>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            {t.hint}
          </Typography.Paragraph>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} disabled={full} onClick={() => setOpen(true)}>
          {t.add}
        </Button>
      </div>
      <label className="cond-switch" style={{ marginBottom: 16 }}>
        <Switch
          checked={client.notifyCommonEmail !== false}
          aria-label={ru.notifications.commonEmail.label}
          onChange={async (enabled) => {
            const r = await setCommon({ clientId: client.id, enabled })
            if ('error' in r) message.error(errorMessage(r.error))
            else message.success(ru.notifications.commonEmail.saved)
          }}
        />
        <span>
          {ru.notifications.commonEmail.label}
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
            {ru.notifications.commonEmail.hint(client.email)}
          </Typography.Text>
        </span>
      </label>
      {full && <Alert type="info" showIcon message={t.limitReached} style={{ marginBottom: 16 }} />}
      {lastInvite && (
        <Alert
          type="success"
          showIcon
          closable
          onClose={() => setLastInvite(undefined)}
          style={{ marginBottom: 16 }}
          message={t.sent}
          description={
            <>
              {t.sentDemo} <Link to={lastInvite}>{t.openInvite}</Link>
            </>
          }
        />
      )}

      <Table<ClientUserRow>
        rowKey="id"
        dataSource={users}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: t.empty }}
        columns={[
          { title: t.name, render: (_, u) => <strong>{`${u.lastName} ${u.firstName}`}</strong> },
          { title: t.email, dataIndex: 'email' },
          { title: t.phone, dataIndex: 'phone', render: (v: string) => v || '—' },
          { title: t.status, render: (_, u) => <Tag color={STATUS[u.status].color}>{STATUS[u.status].label}</Tag> },
          { title: '', render: (_, u) => actions(u) },
        ]}
      />

      <UserSubscriptionsModal
        user={subsFor && { id: subsFor.id, name: ` ${subsFor.firstName}`, email: subsFor.email }}
        onClose={() => setSubsFor(null)}
      />
      <Modal open={open} title={t.addTitle} footer={null} onCancel={() => setOpen(false)} destroyOnHidden>
        <p className="muted">{t.addHint}</p>
        <Form form={form} layout="vertical" size="large" requiredMark={false} onFinish={onAdd}>
          <Form.Item
            name="lastName"
            label={t.lastName}
            rules={[{ required: true, whitespace: true, message: ru.common.required }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="firstName"
            label={t.firstName}
            rules={[{ required: true, whitespace: true, message: ru.common.required }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="email"
            label={t.email}
            rules={[
              { required: true, message: ru.common.required },
              {
                validator: (_, v) =>
                  !v || isEmail(v) ? Promise.resolve() : Promise.reject(new Error(ru.common.emailInvalid)),
              },
            ]}
          >
            <Input inputMode="email" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="phone"
            label={t.phone}
            rules={[
              {
                validator: (_, v) =>
                  !v || isPhone(v) ? Promise.resolve() : Promise.reject(new Error(ru.common.phoneInvalid)),
              },
            ]}
          >
            <Input inputMode="tel" placeholder="+7 900 123-45-67" autoComplete="off" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={adding}>
              {t.add}
            </Button>
            <Button onClick={() => setOpen(false)}>{ru.clients.cancel}</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
