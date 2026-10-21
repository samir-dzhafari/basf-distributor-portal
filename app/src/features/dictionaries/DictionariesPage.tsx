import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ErrorState } from '@/shared/ui/ErrorState'
import { useSearchParams } from 'react-router-dom'
import {
  App,
  Button,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { formatDate } from '@/shared/lib/format'
import { PageHeader } from '@/shared/ui/PageHeader'
import {
  useDeleteDictionaryItemMutation,
  useGetDictionariesQuery,
  useSaveDictionaryItemMutation,
  type DictKind,
  type DictionariesData,
} from './dictionariesApi'

const t = ru.dictionaries
type Item = Record<string, unknown> & { id: string }
type Option = { value: string | number; label: string }

interface FieldDef {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'multi'
  options?: (d: DictionariesData) => Option[]
  hint?: string
  optional?: boolean
}

interface KindDef {
  list: (d: DictionariesData) => Item[]
  fields: FieldDef[]
  /** Колонки с данными записи (кроме использования и действий). */
  columns: (d: DictionariesData) => { title: string; render: (i: Item) => ReactNode }[]
  newItem?: (d: DictionariesData) => Partial<Item>
}

const nameOf = (list: { id: string; name: string }[], id: unknown) => list.find((x) => x.id === id)?.name ?? '—'
const NAME: FieldDef = { name: 'name', label: t.fields.name, type: 'text' }
const CODE: FieldDef = { name: 'code', label: t.fields.code, type: 'text' }
const nameCol = { title: t.fields.name, render: (i: Item) => <strong>{String(i.name)}</strong> }

const KINDS: Record<DictKind, KindDef> = {
  productGroup: {
    list: (d) => d.productGroups as unknown as Item[],
    fields: [
      NAME,
      {
        name: 'vatRate',
        label: t.fields.vatRate,
        type: 'select',
        options: (d) => d.vatRates.map((v) => ({ value: v.rate, label: t.percent(v.rate) })),
      },
    ],
    columns: () => [nameCol, { title: t.fields.vatRate, render: (i) => t.percent(Number(i.vatRate)) }],
  },
  productLine: { list: (d) => d.productLines as unknown as Item[], fields: [NAME], columns: () => [nameCol] },
  vatRate: {
    list: (d) => d.vatRates as unknown as Item[],
    fields: [{ name: 'rate', label: t.fields.rate, type: 'number' }],
    columns: () => [{ title: t.fields.rate, render: (i) => <strong>{t.percent(Number(i.rate))}</strong> }],
  },
  businessType: {
    list: (d) => d.businessTypes as unknown as Item[],
    fields: [
      NAME,
      { name: 'validFrom', label: t.fields.validFrom, type: 'date' },
      { name: 'validTo', label: t.fields.validTo, type: 'date', hint: t.fields.validToHint, optional: true },
      {
        name: 'paymentTermIds',
        label: t.fields.paymentTerms,
        type: 'multi',
        options: (d) => d.paymentTerms.map((p) => ({ value: p.id, label: p.name })),
      },
    ],
    columns: (d) => [
      nameCol,
      {
        title: t.fields.validFrom,
        render: (i) => `${formatDate(String(i.validFrom))}${i.validTo ? ` — ${formatDate(String(i.validTo))}` : ''}`,
      },
      {
        title: t.fields.paymentTerms,
        render: (i) => (i.paymentTermIds as string[]).map((id) => <Tag key={id}>{nameOf(d.paymentTerms, id)}</Tag>),
      },
    ],
    newItem: (d) => ({
      validFrom: dayjs().format('YYYY-MM-DD'),
      paymentTermIds: d.paymentTerms.slice(0, 1).map((p) => p.id),
    }),
  },
  region: { list: (d) => d.regions as unknown as Item[], fields: [NAME], columns: () => [nameCol] },
  paymentMethod: { list: (d) => d.paymentMethods as unknown as Item[], fields: [NAME], columns: () => [nameCol] },
  paymentTerm: {
    list: (d) => d.paymentTerms as unknown as Item[],
    fields: [
      CODE,
      NAME,
      {
        name: 'methodId',
        label: t.fields.method,
        type: 'select',
        options: (d) => d.paymentMethods.map((m) => ({ value: m.id, label: m.name })),
      },
    ],
    columns: (d) => [
      { title: t.fields.code, render: (i) => String(i.code) },
      nameCol,
      { title: t.fields.method, render: (i) => nameOf(d.paymentMethods, i.methodId) },
    ],
    newItem: (d) => ({ methodId: d.paymentMethods[0]?.id }),
  },
  deliveryTerm: {
    list: (d) => d.deliveryTerms as unknown as Item[],
    fields: [CODE, NAME],
    columns: () => [{ title: t.fields.code, render: (i) => String(i.code) }, nameCol],
  },
}

const KIND_ORDER: DictKind[] = [
  'businessType',
  'region',
  'paymentTerm',
  'deliveryTerm',
  'paymentMethod',
  'productGroup',
  'productLine',
  'vatRate',
]

function usageTags(usage: Record<string, number> | undefined) {
  const used = Object.entries(usage ?? {}).filter(([, n]) => n > 0)
  if (!used.length) return <span className="muted">{t.notUsed}</span>
  return (
    <Space size={[4, 4]} wrap>
      {used.map(([k, n]) => (
        <Tag key={k}>
          {n} {t.usage[k as keyof typeof t.usage] ?? k}
        </Tag>
      ))}
    </Space>
  )
}

function toFormValues(def: KindDef, item?: Partial<Item>) {
  return Object.fromEntries(
    def.fields.map((f) => [
      f.name,
      f.type === 'date' ? (item?.[f.name] ? dayjs(String(item[f.name])) : undefined) : item?.[f.name],
    ]),
  )
}

function DictionaryTab({ kind, data }: { kind: DictKind; data: DictionariesData }) {
  const def = KINDS[kind]
  const { message } = App.useApp()
  const [editing, setEditing] = useState<Item | null | undefined>(undefined)
  const [form] = Form.useForm()
  const [save, { isLoading }] = useSaveDictionaryItemMutation()
  const [remove] = useDeleteDictionaryItemMutation()
  const items = def.list(data)

  useEffect(() => {
    if (editing !== undefined) form.setFieldsValue(toFormValues(def, editing ?? def.newItem?.(data)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const onFinish = async (values: Record<string, unknown>) => {
    const item: Record<string, unknown> = { id: editing?.id }
    def.fields.forEach((f) => {
      const v = values[f.name]
      item[f.name] = f.type === 'date' ? (v ? (v as dayjs.Dayjs).format('YYYY-MM-DD') : undefined) : v
    })
    const r = await save({ kind, item } as never)
    if ('error' in r) return void message.error(errorMessage(r.error))
    message.success(t.saved)
    setEditing(undefined)
  }

  const onRemove = async (i: Item) => {
    const r = await remove({ kind, id: i.id })
    if ('error' in r) message.error(errorMessage(r.error), 6)
    else message.success(t.removed)
  }

  return (
    <div>
      <div className="tab-head">
        <p className="muted" style={{ margin: 0 }}>
          {t.hints[kind]}
        </p>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setEditing(null)}>
          {t.add}
        </Button>
      </div>
      <Table<Item>
        rowKey="id"
        dataSource={items}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description={t.empty} /> }}
        columns={[
          ...def.columns(data).map((c) => ({ title: c.title, render: (_: unknown, i: Item) => c.render(i) })),
          { title: t.usedIn, render: (_, i) => usageTags(data.usage[kind][i.id]) },
          {
            title: '',
            render: (_, i) => (
              <Space>
                <Button icon={<EditOutlined />} onClick={() => setEditing(i)}>
                  {t.edit}
                </Button>
                <Popconfirm
                  title={t.removeTitle}
                  okText={t.remove}
                  cancelText={t.cancel}
                  okButtonProps={{ danger: true }}
                  onConfirm={() => onRemove(i)}
                >
                  <Button danger type="text" icon={<DeleteOutlined />} aria-label={t.remove} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        destroyOnHidden
        forceRender
        width={Math.min(480, window.innerWidth)}
        title={t.kinds[kind]}
      >
        <Form form={form} layout="vertical" size="large" requiredMark={false} onFinish={onFinish}>
          {def.fields.map((f) => (
            <Form.Item
              key={f.name}
              name={f.name}
              label={f.label}
              extra={f.hint}
              rules={f.optional ? [] : [{ required: true, message: ru.common.required }]}
            >
              {f.type === 'number' ? (
                <InputNumber style={{ width: '100%' }} min={0} max={100} />
              ) : f.type === 'date' ? (
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              ) : f.type === 'select' ? (
                <Select options={f.options?.(data)} />
              ) : f.type === 'multi' ? (
                <Select mode="multiple" options={f.options?.(data)} />
              ) : (
                <Input autoComplete="off" />
              )}
            </Form.Item>
          ))}
          <div className="card-actions">
            <Button type="primary" htmlType="submit" loading={isLoading}>
              {ru.common.save}
            </Button>
            <Button onClick={() => setEditing(undefined)}>{t.cancel}</Button>
          </div>
        </Form>
      </Drawer>
    </div>
  )
}

/** Справочники коммерческой политики и классификации. Используемые записи удалить нельзя. */
export default function DictionariesPage() {
  const { data, isLoading, isError, error, refetch } = useGetDictionariesQuery()
  const [params, setParams] = useSearchParams()
  const kind = useMemo(
    () => (KIND_ORDER.includes(params.get('kind') as DictKind) ? (params.get('kind') as DictKind) : KIND_ORDER[0]),
    [params],
  )

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />
  if (isError || !data) return <ErrorState error={error} onRetry={refetch} />

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <Tabs
        activeKey={kind}
        onChange={(k) => setParams({ kind: k }, { replace: true })}
        items={KIND_ORDER.map((k) => ({
          key: k,
          label: `${t.kinds[k]} (${KINDS[k].list(data).length})`,
          children: <DictionaryTab key={k} kind={k} data={data} />,
        }))}
      />
    </>
  )
}
