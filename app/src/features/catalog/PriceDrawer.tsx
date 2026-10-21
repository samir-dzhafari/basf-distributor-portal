import { useState } from 'react'
import {
  App,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Skeleton,
  Statistic,
  Table,
  Tag,
} from 'antd'
import dayjs from 'dayjs'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { formatDate, formatMoney } from '@/shared/lib/format'
import type { PriceStatus } from '@/mocks/prices'
import {
  useAddProductPriceMutation,
  useDeletePriceEntryMutation,
  useGetPriceHistoryQuery,
  type PriceHistory,
} from './catalogApi'

const t = ru.catalog.priceDrawer
const STATUS: Record<PriceStatus, { label: string; color: string }> = {
  current: { label: t.statusCurrent, color: 'green' },
  scheduled: { label: t.statusScheduled, color: 'blue' },
  archive: { label: t.statusArchive, color: 'default' },
}

/** Цена с историей: новая цена действует с выбранной даты, прежние остаются в архиве. */
export function PriceDrawer({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  const { message } = App.useApp()
  const { data, isLoading } = useGetPriceHistoryQuery(productId ?? '', { skip: !productId })
  const [add, { isLoading: adding }] = useAddProductPriceMutation()
  const [remove] = useDeletePriceEntryMutation()
  const [form] = Form.useForm<{ price: number; validFrom: dayjs.Dayjs; comment?: string }>()
  const [, force] = useState(0)

  const onFinish = async (v: { price: number; validFrom: dayjs.Dayjs; comment?: string }) => {
    const r = await add({
      productId: productId!,
      price: v.price,
      validFrom: v.validFrom.format('YYYY-MM-DD'),
      comment: v.comment,
    })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.added)
    form.resetFields()
    force((n) => n + 1)
  }

  const entries = data?.entries ?? []
  return (
    <Drawer
      open={!!productId}
      onClose={onClose}
      destroyOnHidden
      width={Math.min(640, window.innerWidth)}
      title={data ? t.title(data.product.name) : ''}
    >
      {isLoading || !data ? (
        <Skeleton active />
      ) : (
        <>
          <Statistic title={t.current} value={formatMoney(data.product.price)} style={{ marginBottom: 16 }} />
          <h4>{t.newPrice}</h4>
          <p className="muted">{t.newPriceHint}</p>
          <Form
            form={form}
            layout="vertical"
            size="large"
            requiredMark={false}
            onFinish={onFinish}
            initialValues={{ validFrom: dayjs() }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item
                name="price"
                label={t.price}
                rules={[{ required: true, type: 'number', min: 0.01, message: ru.common.required }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
              <Form.Item name="validFrom" label={t.validFrom} rules={[{ required: true, message: ru.common.required }]}>
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" allowClear={false} />
              </Form.Item>
            </div>
            <Form.Item name="comment" label={t.comment}>
              <Input maxLength={120} autoComplete="off" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={adding}>
              {t.add}
            </Button>
          </Form>

          <h4 style={{ marginTop: 28 }}>{t.history}</h4>
          <Table<PriceHistory['entries'][number]>
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={entries}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: t.colFrom, render: (_, e) => formatDate(e.validFrom) },
              { title: t.colPrice, align: 'right', render: (_, e) => <strong>{formatMoney(e.price)}</strong> },
              {
                title: ru.catalog.columns.state,
                render: (_, e) => <Tag color={STATUS[e.status].color}>{STATUS[e.status].label}</Tag>,
              },
              { title: t.colWho, dataIndex: 'userName' },
              { title: t.colComment, dataIndex: 'comment', render: (v?: string) => v ?? '—' },
              {
                title: '',
                render: (_, e) =>
                  e.status === 'scheduled' ? (
                    <Popconfirm
                      title={t.cancelTitle}
                      okText={t.cancel}
                      cancelText={ru.common.cancel}
                      onConfirm={async () => {
                        const r = await remove({ productId: productId!, entryId: e.id })
                        if ('error' in r) message.error(errorMessage(r.error))
                        else message.success(t.cancelled)
                      }}
                    >
                      <Button type="link" danger>
                        {t.cancel}
                      </Button>
                    </Popconfirm>
                  ) : null,
              },
            ]}
          />
        </>
      )}
    </Drawer>
  )
}
