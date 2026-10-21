import { useState } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { Alert, App, Button, Card, Form, Input, InputNumber, Skeleton, Space, Switch, Typography } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import type { SystemSettings } from '@/shared/types/domain'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useGetSettingsQuery, useUpdateSettingsMutation } from './settingsApi'

const t = ru.settings

function SettingsForm({ initial, over }: { initial: SystemSettings; over: number }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<SystemSettings>()
  const [save, { isLoading }] = useUpdateSettingsMutation()
  const [overLimit, setOver] = useState(over)
  const [dirty, setDirty] = useState(false)

  const onFinish = async (v: SystemSettings) => {
    const r = await save(v)
    if ('error' in r) return void message.error(errorMessage(r.error))
    setOver(r.data.clientsOverLimit)
    setDirty(false)
    message.success(t.saved)
  }

  return (
    <Form
      form={form}
      layout="vertical"
      size="large"
      requiredMark={false}
      initialValues={initial}
      onFinish={onFinish}
      onValuesChange={() => setDirty(true)}
    >
      <Card style={{ maxWidth: 760 }}>
        <Form.Item
          name="clientUserLimit"
          label={t.clientUserLimit}
          extra={t.clientUserLimitHint}
          rules={[{ required: true, type: 'number', min: 1, max: 100, message: '1–100' }]}
        >
          <InputNumber min={1} max={100} precision={0} style={{ width: 140 }} />
        </Form.Item>
        {overLimit > 0 && (
          <Alert type="warning" showIcon message={t.overLimit(overLimit)} style={{ marginBottom: 24 }} />
        )}

        <Form.Item label={t.separate} extra={t.separateHint}>
          <Form.Item name="separateCreateApprove" valuePropName="checked" noStyle>
            <Switch aria-label={t.separate} />
          </Form.Item>
        </Form.Item>

        <Form.Item
          name="sessionHours"
          label={t.sessionHours}
          extra={t.sessionHoursHint}
          rules={[{ required: true, type: 'number', min: 1, max: 72, message: '1–72' }]}
        >
          <InputNumber min={1} max={72} precision={0} style={{ width: 140 }} />
        </Form.Item>

        <Form.Item
          name="senderEmail"
          label={t.senderEmail}
          extra={t.senderEmailHint}
          rules={[{ required: true, type: 'email', message: ru.common.emailInvalid }]}
        >
          <Input inputMode="email" autoComplete="off" />
        </Form.Item>

        <Form.Item label={t.multiLevel} extra={t.multiLevelHint}>
          <Form.Item name="multiLevelApproval" valuePropName="checked" noStyle>
            <Switch aria-label={t.multiLevel} />
          </Form.Item>
        </Form.Item>

        <Space wrap>
          <Button type="primary" htmlType="submit" loading={isLoading} disabled={!dirty}>
            {t.save}
          </Button>
          <Button
            disabled={!dirty}
            onClick={() => {
              form.resetFields()
              setDirty(false)
            }}
          >
            {t.reset}
          </Button>
          {dirty && <Typography.Text type="warning">{t.dirty}</Typography.Text>}
        </Space>
      </Card>
    </Form>
  )
}

/** Системные настройки (фич-лист 14.2): лимит пользователей, разделение полномочий, сессии, адрес отправителя. */
export default function SettingsPage() {
  const { data, isLoading, isError, error, refetch } = useGetSettingsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  })
  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <SettingsForm key={JSON.stringify(data.settings)} initial={data.settings} over={data.clientsOverLimit} />
      )}
    </>
  )
}
