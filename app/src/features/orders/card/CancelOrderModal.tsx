import { App, Form, Input, Modal } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { useCancelOrderMutation } from '../ordersViewApi'

const t = ru.orders.card

/** Отмена заказа: причина обязательна и сохраняется в истории. */
export function CancelOrderModal({
  orderId,
  number,
  open,
  onClose,
}: {
  orderId: string
  number: string
  open: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ comment: string }>()
  const [cancel, { isLoading }] = useCancelOrderMutation()

  const submit = async () => {
    const { comment } = await form.validateFields()
    const r = await cancel({ id: orderId, comment })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.cancelled)
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      open={open}
      title={`${t.cancelTitle} ${number}`}
      okText={t.cancelConfirm}
      cancelText={t.cancelKeep}
      okButtonProps={{ danger: true, size: 'large', loading: isLoading }}
      cancelButtonProps={{ size: 'large' }}
      onOk={submit}
      onCancel={onClose}
      destroyOnHidden
    >
      <p>{t.cancelHint}</p>
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="comment"
          label={t.cancelReason}
          rules={[
            { required: true, whitespace: true, message: t.cancelReasonRequired },
            { min: 3, message: t.cancelReasonRequired },
          ]}
        >
          <Input.TextArea autoFocus rows={3} maxLength={300} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}
