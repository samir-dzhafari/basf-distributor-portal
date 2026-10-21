import { useState } from 'react'
import { Alert, Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useAppDispatch } from '@/app/hooks'
import { ru } from '@/shared/i18n/ru'
import { formatDate } from '@/shared/lib/format'
import { ChoiceCards } from '@/shared/ui/ChoiceCards'
import { Field } from '@/shared/ui/Field'
import { matchingApplications } from '../rules'
import { wizardActions } from '../wizardSlice'
import type { StepProps } from './types'

const t = ru.order.application

/** Шаг 3. Приложение к договору. */
export function StepApplication({ ctx, d, errors }: StepProps) {
  const dispatch = useAppDispatch()
  const [q, setQ] = useState('')
  const all = matchingApplications(ctx, d)
  const list = all.filter((a) => a.number.toLowerCase().includes(q.trim().toLowerCase()))

  if (all.length === 0) {
    return <Alert type="warning" showIcon message={t.noneTitle} description={t.noneText} />
  }

  return (
    <div className="step-form">
      <Field label={t.label} hint={t.hint} error={errors.applicationId}>
        {all.length > 6 && (
          <Input
            allowClear
            size="large"
            prefix={<SearchOutlined />}
            placeholder={t.search}
            aria-label={t.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ marginBottom: 12 }}
          />
        )}
        <ChoiceCards
          name="application"
          value={d.applicationId}
          onChange={(v) => dispatch(wizardActions.setField({ field: 'applicationId', value: v }))}
          options={list.map((a) => ({
            value: a.id,
            title: a.number,
            description: t.valid(formatDate(a.validFrom), formatDate(a.validTo)),
          }))}
        />
        {list.length === 0 && <div style={{ padding: 12 }}>{t.nothingFound}</div>}
      </Field>
    </div>
  )
}
