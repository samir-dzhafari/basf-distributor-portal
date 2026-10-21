import { App, Form, Input, Modal } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { useRejectOrderMutation } from './approvalsApi'

const t = ru.approvals.page

/** Отклонение: причина обязательна, клиент увидит её в истории заказа. */
export function RejectModal({
  orderId,
  number,
  open,
  onClose,
  onDone,
}: {
  orderId: string
  number: string
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ comment: string }>()
  const [reject, { isLoading }] = useRejectOrderMutation()

  const submit = async () => {
    const { comment } = await form.validateFields()
    const r = await reject({ id: orderId, comment })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.rejected(number))
    form.resetFields()
    onDone()
  }

  return (
    <Modal
      open={open}
      title={`${t.rejectTitle} ${number}`}
      okText={t.rejectConfirm}
      cancelText={t.rejectKeep}
      okButtonProps={{ danger: true, size: 'large', loading: isLoading }}
      cancelButtonProps={{ size: 'large' }}
      onOk={submit}
      onCancel={onClose}
      destroyOnHidden
    >
      <p>{t.rejectHint}</p>
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="comment"
          label={t.rejectReason}
          rules={[
            { required: true, whitespace: true, message: t.rejectRequired },
            { min: 3, message: t.rejectRequired },
          ]}
        >
          <Input.TextArea autoFocus rows={3} maxLength={300} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}
