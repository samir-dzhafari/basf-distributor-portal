import { useState } from 'react'
import { App, Button, Input } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { useSaveOrderCommentMutation, type CommentKey, type OrderView } from '../ordersViewApi'

const t = ru.orders.card
const LABEL: Record<CommentKey, string> = { client: t.commentClient, manager: t.commentManager, admin: t.commentAdmin }
const KEYS: CommentKey[] = ['client', 'manager', 'admin']

/** Три отдельных поля: клиента, сотрудника, администратора. Править можно только своё и только сотруднику. */
export function OrderComments({ order, editable }: { order: OrderView['order']; editable: CommentKey | null }) {
  const { message } = App.useApp()
  const [save, { isLoading }] = useSaveOrderCommentMutation()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')

  const shown = KEYS.filter((k) => order.comments[k] || k === editable)

  const onSave = async () => {
    const r = await save({ id: order.id, text })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.commentSaved)
    setEditing(false)
  }

  if (!shown.length) return <span className="muted">{t.commentNone}</span>

  return (
    <div>
      {shown.map((k) => (
        <div key={k} className="comment-block">
          <span className="comment-block__label">{LABEL[k]}</span>
          {k === editable && editing ? (
            <>
              <Input.TextArea
                autoFocus
                rows={3}
                maxLength={500}
                showCount
                value={text}
                placeholder={t.commentPlaceholder}
                aria-label={LABEL[k]}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="card-actions" style={{ marginTop: 8 }}>
                <Button type="primary" loading={isLoading} onClick={onSave}>
                  {ru.common.save}
                </Button>
                <Button onClick={() => setEditing(false)}>{ru.common.cancel}</Button>
              </div>
            </>
          ) : (
            <div style={{ overflowWrap: 'anywhere' }}>
              {order.comments[k] ?? <span className="muted">{t.commentNone}</span>}
              {k === editable && (
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setText(order.comments[k] ?? '')
                    setEditing(true)
                  }}
                >
                  {t.commentEdit}
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
