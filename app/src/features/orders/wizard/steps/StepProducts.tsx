import { useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Empty, Input, Select, Skeleton, Switch } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useAppDispatch } from '@/app/hooks'
import { ru } from '@/shared/i18n/ru'
import { useGetOrderProductsQuery } from '../../ordersApi'
import { wizardActions } from '../wizardSlice'
import { ProductRow } from './ProductRow'
import type { StepProps } from './types'

const t = ru.order.products

/** Шаг 5. Подбор продуктов: поиск, фильтры, отметка нескольких позиций, количество прямо в строке. */
export function StepProducts({ d, errors, showErrors }: StepProps & { showErrors: boolean }) {
  const dispatch = useAppDispatch()
  const { data, isLoading, isError, refetch } = useGetOrderProductsQuery({
    clientId: d.clientId,
    businessTypeId: d.businessTypeId,
  })
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string>()
  const [line, setLine] = useState<string>()
  const [onlySelected, setOnlySelected] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (data?.products ?? []).filter(
      (p) =>
        (!s || p.name.toLowerCase().includes(s) || p.code.includes(s)) &&
        (!group || p.groupId === group) &&
        (!line || p.lineId === line) &&
        (!onlySelected || d.qty[p.id]),
    )
  }, [data, q, group, line, onlySelected, d.qty])

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />
  if (isError || !data) {
    return (
      <Alert
        type="error"
        showIcon
        message={t.loadError}
        action={<Button onClick={() => refetch()}>{t.retry}</Button>}
      />
    )
  }

  const toggle = (id: string, on: boolean) =>
    setChecked((prev) => {
      const n = new Set(prev)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  const clearChecked = () => setChecked(new Set())
  const allChecked = list.length > 0 && list.every((p) => checked.has(p.id))
  const toAdd = list.filter((p) => checked.has(p.id) && !d.qty[p.id])

  return (
    <div>
      {showErrors && errors.items && (
        <Alert type="error" showIcon message={errors.items} style={{ marginBottom: 16 }} role="alert" />
      )}

      <div className="prod-filters">
        <Input
          allowClear
          size="large"
          prefix={<SearchOutlined />}
          placeholder={t.search}
          aria-label={t.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          allowClear
          size="large"
          placeholder={t.allGroups}
          aria-label={t.group}
          value={group}
          onChange={setGroup}
          options={data.groups.map((g) => ({ value: g.id, label: g.name }))}
        />
        <Select
          allowClear
          size="large"
          placeholder={t.allLines}
          aria-label={t.line}
          value={line}
          onChange={setLine}
          options={data.lines.map((l) => ({ value: l.id, label: l.name }))}
        />
        <label className="prod-filters__switch">
          <Switch checked={onlySelected} onChange={setOnlySelected} /> {t.onlySelected(Object.keys(d.qty).length)}
        </label>
      </div>

      <div className="prod-bulk" aria-live="polite">
        {checked.size > 0 ? (
          <>
            <span>{t.checked(checked.size)}</span>
            <Button
              type="primary"
              ghost
              disabled={!toAdd.length}
              onClick={() => {
                dispatch(wizardActions.addMany(toAdd.map((p) => ({ productId: p.id, qty: p.minQty }))))
                clearChecked()
              }}
            >
              {t.addChecked}
            </Button>
            <Button type="link" onClick={clearChecked}>
              {t.clearChecked}
            </Button>
          </>
        ) : (
          <span className="muted">{t.bulkHint}</span>
        )}
      </div>

      <div className="prod-head">
        <Checkbox
          aria-label={t.checkAll}
          checked={allChecked}
          indeterminate={!allChecked && list.some((p) => checked.has(p.id))}
          onChange={(e) => setChecked(e.target.checked ? new Set(list.map((p) => p.id)) : new Set())}
        />
        <span>{t.colProduct}</span>
        <span>{t.colPack}</span>
        <span>{t.colPrice}</span>
        <span>{t.colQty}</span>
        <span className="num">{t.colSum}</span>
      </div>

      {list.length === 0 ? (
        <Empty description={t.empty} style={{ padding: 32 }} />
      ) : (
        list.map((p) => (
          <ProductRow
            key={p.id}
            p={p}
            qty={d.qty[p.id]}
            checked={checked.has(p.id)}
            forceError={showErrors}
            onCheck={(on) => toggle(p.id, on)}
            onQty={(qty) => dispatch(wizardActions.setQty({ productId: p.id, qty }))}
          />
        ))
      )}
    </div>
  )
}
