import { App, Modal, Skeleton } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { SubscriptionsForm } from './SubscriptionsForm'
import { useGetUserSubscriptionsQuery, useSetUserSubscriptionsMutation } from './notificationsApi'

/** Администратор настраивает уведомления пользователя клиента (фич-лист 13.4). */
export function UserSubscriptionsModal({
  user,
  onClose,
}: {
  user: { id: string; name: string; email: string } | null
  onClose: () => void
}) {
  const { message } = App.useApp()
  const { data } = useGetUserSubscriptionsQuery(user?.id ?? '', { skip: !user })
  const [save, { isLoading }] = useSetUserSubscriptionsMutation()
  return (
    <Modal
      open={!!user}
      title={user ? ru.notifications.userSubs.title(user.name) : ''}
      footer={null}
      onCancel={onClose}
      destroyOnHidden
      width={560}
    >
      <p className="muted">{ru.notifications.userSubs.hint}</p>
      {!user || !data ? (
        <Skeleton active />
      ) : (
        <SubscriptionsForm
          key={JSON.stringify(data)}
          value={data}
          kind="client"
          email={user.email}
          saving={isLoading}
          onSave={async (s) => {
            const r = await save({ userId: user.id, ...s })
            if ('error' in r) return void message.error(errorMessage(r.error))
            message.success(ru.notifications.subs.saved)
            onClose()
          }}
        />
      )}
    </Modal>
  )
}
