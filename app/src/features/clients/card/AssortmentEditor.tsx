import { useMemo, useState } from 'react'
import { Button, Checkbox, Empty, Input, Segmented, Select, Switch, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { ru } from '@/shared/i18n/ru'
import { productAvailability, setProductOpen, toggleId, type Availability } from '@/shared/lib/availability'
import type { Id, Product, ProductGroup, ProductLine } from '@/shared/types/domain'

const t = ru.clients.assortment

type Filter = 'all' | 'available' | 'closed'
const LOCKED = ['closedGlobally', 'closedGroup', 'closedLine', 'otherBusiness']

export interface AssortmentRefs {
  productGroups: ProductGroup[]
  productLines: ProductLine[]
  products: Product[]
}

/** Открытие и закрытие ассортимента: группы, линейки и отдельные позиции (в том числе вне прайс-листа). */
export function AssortmentEditor({
  value,
  refs,
  businessTypeIds,
  onChange,
}: {
  value: Availability
  refs: AssortmentRefs
  /** Типы бизнеса клиента — продукты чужих типов считаются недоступными. */
  businessTypeIds?: Id[]
  onChange: (next: Availability) => void
}) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [group, setGroup] = useState<string>()
  const [checked, setChecked] = useState<Set<Id>>(new Set())

  const rows = useMemo(
    () => refs.products.map((p) => ({ p, a: productAvailability(p, value, businessTypeIds) })),
    [refs.products, value, businessTypeIds],
  )
  const availableCount = rows.filter((r) => r.a.orderable).length

  const shown = rows.filter(({ p, a }) => {
    const s = q.trim().toLowerCase()
    return (
      (!s || p.name.toLowerCase().includes(s) || p.code.includes(s)) &&
      (!group || p.groupId === group) &&
      (filter === 'all' || (filter === 'available' ? a.orderable : !a.orderable))
    )
  })

  // Позицию можно включать и выключать самому, только если её не закрыла «внешняя» причина (каталог, группа, линейка, тип бизнеса).
  const canToggle = (r: (typeof rows)[number]) => !LOCKED.includes(r.a.reason ?? '')

  const bulk = (open: boolean) => {
    let next = value
    rows.filter((r) => checked.has(r.p.id) && canToggle(r)).forEach((r) => (next = setProductOpen(next, r.p, open)))
    onChange(next)
    setChecked(new Set())
  }
  const allChecked = shown.length > 0 && shown.every((r) => checked.has(r.p.id))

  const statusTag = ({ p, a }: (typeof rows)[number]) =>
    a.orderable ? (
      !p.inPriceList ? (
        <Tag color="blue">{t.openedManually}</Tag>
      ) : (
        <Tag color="green">{t.ok}</Tag>
      )
    ) : (
      <Tag color={a.reason === 'closedProduct' || a.reason === 'outsidePrice' ? 'default' : 'red'}>
        {t.reasons[a.reason!]}
      </Tag>
    )

  return (
    <div>
      <p className="muted">{t.hint}</p>

      <div className="assort-switches">
        <div>
          <strong>{t.groups}</strong>
          {refs.productGroups.map((g) => (
            <label key={g.id} className="cond-switch">
              <Switch
                checked={!value.closedGroupIds.includes(g.id)}
                onChange={(on) => onChange({ ...value, closedGroupIds: toggleId(value.closedGroupIds, g.id, !on) })}
                aria-label={g.name}
              />
              {g.name}
            </label>
          ))}
        </div>
        <div>
          <strong>{t.lines}</strong>
          {refs.productLines.map((l) => (
            <label key={l.id} className="cond-switch">
              <Switch
                checked={!value.closedLineIds.includes(l.id)}
                onChange={(on) => onChange({ ...value, closedLineIds: toggleId(value.closedLineIds, l.id, !on) })}
                aria-label={l.name}
              />
              {l.name}
            </label>
          ))}
        </div>
      </div>

      <h4 style={{ margin: '20px 0 4px' }}>
        {t.products} <span className="muted">· {t.available(availableCount, rows.length)}</span>
      </h4>

      <div className="prod-filters" style={{ gridTemplateColumns: '2fr 1fr auto' }}>
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
          aria-label={t.groups}
          value={group}
          onChange={setGroup}
          options={refs.productGroups.map((g) => ({ value: g.id, label: g.name }))}
        />
        <Segmented
          size="large"
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={[
            { value: 'all', label: t.filterAll },
            { value: 'available', label: t.filterAvailable },
            { value: 'closed', label: t.filterClosed },
          ]}
        />
      </div>

      <div className="prod-bulk" aria-live="polite">
        {checked.size > 0 ? (
          <>
            <span>{t.selected(checked.size)}</span>
            <Button onClick={() => bulk(true)}>{t.openSelected}</Button>
            <Button onClick={() => bulk(false)}>{t.closeSelected}</Button>
          </>
        ) : null}
      </div>

      <div className="assort-head">
        <Checkbox
          aria-label={ru.order.products.checkAll}
          checked={allChecked}
          indeterminate={!allChecked && shown.some((r) => checked.has(r.p.id))}
          onChange={(e) => setChecked(e.target.checked ? new Set(shown.map((r) => r.p.id)) : new Set())}
        />
        <span>{t.colProduct}</span>
        <span>{t.colGroup}</span>
        <span>{t.colPrice}</span>
        <span>{t.colStatus}</span>
        <span>{t.colOpen}</span>
      </div>
      {shown.length === 0 && <Empty description={ru.order.products.empty} style={{ padding: 24 }} />}
      {shown.map((r) => (
        <div key={r.p.id} className={`assort-row${r.a.orderable ? '' : ' assort-row--off'}`}>
          <Checkbox
            checked={checked.has(r.p.id)}
            onChange={(e) =>
              setChecked(
                (prev) => new Set(e.target.checked ? [...prev, r.p.id] : [...prev].filter((x) => x !== r.p.id)),
              )
            }
            aria-label={ru.order.products.check(r.p.name)}
          />
          <div>
            <strong>{r.p.name}</strong>
            <small className="muted" style={{ display: 'block' }}>
              {ru.order.products.code(r.p.code)}
            </small>
          </div>
          <div data-label={t.colGroup}>
            {refs.productGroups.find((g) => g.id === r.p.groupId)?.name}
            <small className="muted" style={{ display: 'block' }}>
              {refs.productLines.find((l) => l.id === r.p.lineId)?.name}
            </small>
          </div>
          <div data-label={t.colPrice}>{r.p.inPriceList ? t.inPrice : t.outsidePrice}</div>
          <div>{statusTag(r)}</div>
          <div>
            <Switch
              checked={r.a.orderable}
              disabled={!canToggle(r)}
              onChange={(on) => onChange(setProductOpen(value, r.p, on))}
              aria-label={`${t.colOpen}: ${r.p.name}`}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
