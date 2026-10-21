import { Progress, Steps, Typography } from 'antd'
import { ru } from '@/shared/i18n/ru'
import { STEPS } from './validate'

/** Индикатор шагов: на компьютере — кликабельные пройденные шаги, на телефоне — «Шаг 2 из 6» и полоска. */
export function WizardProgress({
  step,
  maxStep,
  isMobile,
  onGo,
}: {
  step: number
  maxStep: number
  isMobile: boolean
  onGo: (step: number) => void
}) {
  if (isMobile) {
    return (
      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong>{ru.order.stepOf(step + 1, STEPS.length, STEPS[step])}</Typography.Text>
        <Progress percent={Math.round(((step + 1) / STEPS.length) * 100)} showInfo={false} strokeColor="#00793A" />
      </div>
    )
  }
  return (
    <Steps
      size="small"
      current={step}
      style={{ marginBottom: 24 }}
      onChange={(s) => s <= maxStep && onGo(s)}
      items={STEPS.map((title, i) => ({ title, disabled: i > maxStep }))}
    />
  )
}
