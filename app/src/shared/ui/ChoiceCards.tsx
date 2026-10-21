import type { ReactNode } from 'react'

export interface ChoiceOption {
  value: string
  title: ReactNode
  description?: ReactNode
  disabled?: boolean
}

/** Крупные карточки-варианты (радиокнопки): удобно нажимать, всё видно сразу. */
export function ChoiceCards({
  name,
  options,
  value,
  onChange,
  columns = 1,
}: {
  name: string
  options: ChoiceOption[]
  value: string
  onChange: (v: string) => void
  columns?: 1 | 2
}) {
  return (
    <div className={`choice-grid choice-grid--${columns}`} role="radiogroup">
      {options.map((o) => (
        <label
          key={o.value}
          className={`choice${value === o.value ? ' choice--on' : ''}${o.disabled ? ' choice--off' : ''}`}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={o.disabled}
            onChange={() => onChange(o.value)}
          />
          <span className="choice__dot" aria-hidden />
          <span className="choice__text">
            <strong>{o.title}</strong>
            {o.description && <small>{o.description}</small>}
          </span>
        </label>
      ))}
    </div>
  )
}
