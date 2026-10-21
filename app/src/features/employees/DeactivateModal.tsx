import { useState } from 'react'
import { Alert, App, Modal, Select } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import type { Id } from '@/shared/types/domain'
import { useDeactivateEmployeeMutation, type EmployeeDetail } from './employeesApi'

const t = ru.employees.deactivate

/** Деактивация одним шагом: блокировка и перенос клиентов, приложений, подчинённых и заказов на другого сотрудника. */
export function DeactivateModal({
  detail,
  open,
  onClose,
}: {
  detail: EmployeeDetail
  open: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [target, setTarget] = useState<Id>()
  const [run, { isLoading }] = useDeactivateEmployeeMutation()
  const name = `${detail.user.lastName} ${detail.user.firstName}`
  const a = detail.assets
  const lines = (
    [
      a.clients && t.assets.clients(a.clients),
      a.regions && t.assets.regions(a.regions),
      a.businessTypes && t.assets.businessTypes(a.businessTypes),
      a.applications && t.assets.applications(a.applications),
      a.subordinates && t.assets.subordinates(a.subordinates),
      a.pendingOrders && t.assets.pendingOrders(a.pendingOrders),
    ] as (string | 0)[]
  ).filter(Boolean) as string[]
  const needsTarget = lines.length > 0

  const submit = async () => {
    const r = await run({ id: detail.user.id, transferToId: target })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.done)
    onClose()
  }

  return (
    <Modal
      open={open}
      title={t.title(name)}
      okText={t.confirm}
      cancelText={ru.common.cancel}
      okButtonProps={{ danger: true, size: 'large', loading: isLoading, disabled: needsTarget && !target }}
      cancelButtonProps={{ size: 'large' }}
      onOk={submit}
      onCancel={onClose}
      destroyOnHidden
    >
      <p>{t.hint}</p>
      {needsTarget ? (
        <>
          <p>
            <strong>{t.transferTitle}</strong>
          </p>
          <ul>
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="muted">{t.transferHint}</p>
          <Select
            size="large"
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            placeholder={t.transferTo}
            aria-label={t.transferTo}
            value={target}
            onChange={setTarget}
            options={detail.refs.employees
              .filter((e) => e.id !== detail.user.id && e.status !== 'blocked')
              .map((e) => ({ value: e.id, label: e.name }))}
          />
        </>
      ) : (
        <Alert type="info" showIcon message={t.nothing} />
      )}
    </Modal>
  )
}
