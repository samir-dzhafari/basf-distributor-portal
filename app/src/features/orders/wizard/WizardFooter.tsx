import { Button } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons'
import { ru } from '@/shared/i18n/ru'
import { formatMoney } from '@/shared/lib/format'

const t = ru.order

/** Нижняя панель мастера: всегда на виду, на телефоне кнопки — только значки. */
export function WizardFooter({
  isMobile,
  isFirst,
  isLast,
  ready,
  canSave,
  saving,
  submitting,
  summary,
  onBack,
  onSave,
  onNext,
  onSubmit,
}: {
  isMobile: boolean
  isFirst: boolean
  isLast: boolean
  ready: boolean
  canSave: boolean
  saving: boolean
  submitting: boolean
  summary?: { count: number; total: number }
  onBack: () => void
  onSave: () => void
  onNext: () => void
  onSubmit: () => void
}) {
  return (
    <div className="wizard-footer">
      <Button size="large" icon={<ArrowLeftOutlined />} disabled={isFirst} onClick={onBack} aria-label={t.back}>
        {isMobile ? '' : t.back}
      </Button>
      <div className="wizard-footer__mid">
        {summary && summary.count > 0 && (
          <span>
            {t.itemsCount(summary.count)} · <strong>{formatMoney(summary.total)}</strong>
            <small> {t.withVat}</small>
          </span>
        )}
      </div>
      <Button
        size="large"
        icon={<SaveOutlined />}
        loading={saving}
        disabled={!canSave}
        onClick={onSave}
        aria-label={t.saveDraft}
      >
        {isMobile ? '' : t.saveDraft}
      </Button>
      {isLast ? (
        <Button
          type="primary"
          size="large"
          icon={<SendOutlined />}
          loading={submitting}
          disabled={!ready}
          onClick={onSubmit}
        >
          {t.submit}
        </Button>
      ) : (
        <Button type="primary" size="large" disabled={!ready} onClick={onNext}>
          {t.next} <ArrowRightOutlined />
        </Button>
      )}
    </div>
  )
}
