import { useState } from 'react'
import { App, Button, Form, Input, Modal, Popconfirm, Space, Table, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import type { Consignee } from '@/shared/types/domain'
import { useDeleteConsigneeMutation, useSaveConsigneeMutation, type ClientDetail } from '../clientsApi'

const t = ru.clients.consignees

/** Грузополучатели клиента: код, наименование, адрес доставки. */
export function ConsigneesTab({ detail }: { detail: ClientDetail }) {
  const { message } = App.useApp()
  const [editing, setEditing] = useState<Partial<Consignee> | null>(null)
  const [form] = Form.useForm()
  const [save, { isLoading }] = useSaveConsigneeMutation()
  const [remove] = useDeleteConsigneeMutation()
  const clientId = detail.client.id

  const open = (c: Partial<Consignee>) => {
    setEditing(c)
    form.setFieldsValue({ code: c.code ?? '', name: c.name ?? '', address: c.address ?? '' })
  }

  const onSave = async (v: { code: string; name: string; address: string }) => {
    const r = await save({ clientId, id: editing?.id, ...v })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.saved)
    setEditing(null)
  }

  const onRemove = async (c: Consignee) => {
    const r = await remove({ clientId, id: c.id })
    if ('error' in r) message.error(errorMessage(r.error))
    else message.success(t.removed)
  }

  return (
    <div>
      <div className="tab-head">
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          {t.hint}
        </Typography.Paragraph>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => open({})}>
          {t.add}
        </Button>
      </div>
      <Table<Consignee>
        rowKey="id"
        dataSource={detail.consignees}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: t.empty }}
        columns={[
          { title: t.code, dataIndex: 'code', width: 130 },
          { title: t.name, dataIndex: 'name', render: (v: string) => <strong>{v}</strong> },
          { title: t.address, dataIndex: 'address' },
          {
            title: '',
            render: (_, c) => (
              <Space>
                <Button icon={<EditOutlined />} onClick={() => open(c)} aria-label={`${t.edit}: ${c.name}`}>
                  {t.edit}
                </Button>
                <Popconfirm
                  title={t.removeTitle}
                  okText={t.remove}
                  cancelText={ru.clients.cancel}
                  okButtonProps={{ danger: true }}
                  onConfirm={() => onRemove(c)}
                >
                  <Button danger type="text" icon={<DeleteOutlined />} aria-label={`${t.remove}: ${c.name}`} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={!!editing}
        title={t.addTitle}
        footer={null}
        onCancel={() => setEditing(null)}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" size="large" requiredMark={false} onFinish={onSave}>
          <Form.Item
            name="code"
            label={t.code}
            rules={[{ required: true, whitespace: true, message: ru.common.required }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="name"
            label={t.name}
            rules={[{ required: true, whitespace: true, message: ru.common.required }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="address"
            label={t.address}
            rules={[{ required: true, whitespace: true, message: ru.common.required }]}
          >
            <Input.TextArea rows={2} autoComplete="off" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={isLoading}>
              {ru.common.save}
            </Button>
            <Button onClick={() => setEditing(null)}>{ru.clients.cancel}</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
