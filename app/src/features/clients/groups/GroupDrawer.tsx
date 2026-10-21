import { useState } from 'react'
import { App, Button, Drawer, Form, Input, Select, Tabs } from 'antd'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { emptyAvailability } from '@/shared/lib/availability'
import { validateConditions } from '@/shared/lib/requisites'
import type { ClientConditions, Id } from '@/shared/types/domain'
import { AssortmentEditor, type AssortmentRefs } from '../card/AssortmentEditor'
import { ConditionsFields, type ConditionRefs } from '../card/ConditionsFields'
import { useSaveClientGroupMutation, type GroupRow } from '../clientsApi'

const t = ru.clients.groups

export type GroupRefs = ConditionRefs & AssortmentRefs

export const defaultTemplate = (refs: ConditionRefs): ClientConditions => ({
  paymentTermIds: refs.paymentTerms.slice(0, 1).map((p) => p.id),
  defaultPaymentTermId: refs.paymentTerms[0]?.id ?? '',
  businessTypeIds: refs.businessTypes.slice(0, 1).map((b) => b.id),
  deliveryTermIds: refs.deliveryTerms.map((d) => d.id),
  canChooseDelivery: false,
  availability: emptyAvailability(),
})

/** Создание и правка группы: название, участники и шаблон условий (оплата, типы бизнеса, поставка, НДС, ассортимент). */
export function GroupDrawer({
  group,
  open,
  refs,
  clients,
  onClose,
}: {
  group: GroupRow | null
  open: boolean
  refs: GroupRefs
  clients: { id: Id; name: string }[]
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [save, { isLoading }] = useSaveClientGroupMutation()
  const [form] = Form.useForm<{ name: string; description: string; memberIds: Id[] }>()
  const [template, setTemplate] = useState<ClientConditions>(group?.template ?? defaultTemplate(refs))
  const [showErrors, setShowErrors] = useState(false)

  const submit = async () => {
    const v = await form.validateFields()
    if (Object.keys(validateConditions(template)).length) {
      setShowErrors(true)
      return void message.warning(t.templateHint)
    }
    const r = await save({
      id: group?.id,
      name: v.name,
      description: v.description ?? '',
      memberIds: v.memberIds ?? [],
      template,
    })
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.saved)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      destroyOnHidden
      width={Math.min(860, window.innerWidth)}
      title={group ? group.name : t.add}
      footer={
        <div className="card-actions">
          <Button type="primary" size="large" loading={isLoading} onClick={submit}>
            {ru.common.save}
          </Button>
          <Button size="large" onClick={onClose}>
            {ru.clients.cancel}
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        size="large"
        requiredMark={false}
        initialValues={{
          name: group?.name ?? '',
          description: group?.description ?? '',
          memberIds: group?.memberIds ?? [],
        }}
      >
        <Form.Item
          name="name"
          label={t.name}
          rules={[{ required: true, whitespace: true, message: ru.common.required }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="description" label={t.description}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="memberIds" label={t.members}>
          <Select
            mode="multiple"
            optionFilterProp="label"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>
      </Form>
      <h4>{t.template}</h4>
      <p className="muted">{t.templateHint}</p>
      <Tabs
        items={[
          {
            key: 'cond',
            label: ru.clients.card.tabs.conditions,
            children: (
              <ConditionsFields
                value={template}
                refs={refs}
                showErrors={showErrors}
                onChange={(p) => setTemplate((v) => ({ ...v, ...p }))}
              />
            ),
          },
          {
            key: 'assort',
            label: ru.clients.card.tabs.assortment,
            children: (
              <AssortmentEditor
                value={template.availability}
                refs={refs}
                businessTypeIds={template.businessTypeIds}
                onChange={(availability) => setTemplate((v) => ({ ...v, availability }))}
              />
            ),
          },
        ]}
      />
    </Drawer>
  )
}
