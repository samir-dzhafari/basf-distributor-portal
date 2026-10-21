import { useState } from 'react'
import { Button, InputNumber } from 'antd'
import { ru } from '@/shared/i18n/ru'
import type { OrderProduct } from '../../ordersApi'
import { qtyProblem } from '../validate'

/**
 * Поле количества: шаг = кратность упаковки, ошибка показывается после ухода из поля
 * (или после попытки пойти дальше) вместе с кнопкой «Исправить».
 */
export function QtyInput({
  product,
  value,
  forceError,
  onChange,
}: {
  product: OrderProduct
  value?: number
  forceError: boolean
  onChange: (qty: number | null) => void
}) {
  const [touched, setTouched] = useState(false)
  const problem = value ? qtyProblem(value, product) : null
  const show = !!problem && (touched || forceError)

  return (
    <div className="qty">
      <InputNumber
        aria-label={ru.order.products.qtyLabel(product.unit, product.name)}
        aria-invalid={show}
        size="large"
        min={0}
        max={999999}
        precision={0}
        step={product.multiple}
        value={value ?? null}
        status={show ? 'error' : undefined}
        placeholder="0"
        suffix={product.unit}
        style={{ width: '100%' }}
        onChange={(v) => {
          const qty = typeof v === 'number' ? v : null
          if (!qty) setTouched(false)
          onChange(qty)
        }}
        onBlur={() => setTouched(true)}
      />
      {show && (
        <div className="field__error" role="alert">
          {problem.message}{' '}
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onChange(problem.nearest)}>
            {ru.order.products.fix}
          </Button>
        </div>
      )}
    </div>
  )
}
