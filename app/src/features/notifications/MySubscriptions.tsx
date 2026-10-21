import { App, Skeleton } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { SubscriptionsForm } from './SubscriptionsForm'
import { useGetMySubscriptionsQuery, useSetMySubscriptionsMutation } from './notificationsApi'

/** Мои уведомления в профиле. */
export function MySubscriptions({ kind, email }: { kind: 'client' | 'employee'; email: string }) {
  const { message } = App.useApp()
  const { data } = useGetMySubscriptionsQuery()
  const [save, { isLoading }] = useSetMySubscriptionsMutation()
  if (!data) return <Skeleton active paragraph={{ rows: 4 }} />
  return (
    <SubscriptionsForm
      key={JSON.stringify(data)}
      value={data}
      kind={kind}
      email={email}
      saving={isLoading}
      onSave={async (s) => {
        const r = await save(s)
        if ('error' in r) message.error(errorMessage(r.error))
        else message.success(ru.notifications.subs.saved)
      }}
    />
  )
}
