import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, App, Button, Card, Grid, Popconfirm, Result, Skeleton, Typography } from 'antd'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { errorMessage } from '@/app/api'
import { isClient } from '@/features/auth/permissions'
import { useMe } from '@/features/auth/useMe'
import { ru } from '@/shared/i18n/ru'
import { formatMoney } from '@/shared/lib/format'
import { PageHeader } from '@/shared/ui/PageHeader'
import {
  useDeleteDraftMutation,
  useGetOrderContextQuery,
  useListMyDraftsQuery,
  useSaveDraftMutation,
  useSubmitOrderMutation,
} from '../ordersApi'
import { DraftsBanner } from './DraftsBanner'
import { scrollToError, useScrollTopOnChange, useWizardAutofill, useWizardBootstrap, useWizardProducts } from './hooks'
import { ClientPicker } from './steps/ClientPicker'
import { StepApplication } from './steps/StepApplication'
import { StepProducts } from './steps/StepProducts'
import { StepRecipient } from './steps/StepRecipient'
import { StepSubmit } from './steps/StepSubmit'
import { StepSummary } from './steps/StepSummary'
import { StepTerms } from './steps/StepTerms'
import { useOrderTotals } from './useOrderTotals'
import { STEP, STEPS, firstInvalidStep, validateStep, type QtyRule } from './validate'
import { WizardFooter } from './WizardFooter'
import { WizardProgress } from './WizardProgress'
import { wizardActions } from './wizardSlice'

const t = ru.order

export default function OrderWizardPage() {
  const { id: draftId } = useParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { modal, message } = App.useApp()
  const isMobile = !Grid.useBreakpoint().md
  const { data: me } = useMe()
  const { data, step, maxStep, notice } = useAppSelector((s) => s.orderWizard)
  const [showErrors, setShowErrors] = useState(false)
  const [doneNumber, setDoneNumber] = useState<string>()

  const { draftQuery } = useWizardBootstrap(draftId, me)
  const ctxQuery = useGetOrderContextQuery(data.clientId, { skip: !data.clientId })
  const ctx = ctxQuery.data
  useWizardAutofill(ctx, me)
  const products = useWizardProducts()
  const { lines, totals } = useOrderTotals(data, products)
  const rules = useMemo(() => new Map<string, QtyRule>((products ?? []).map((p) => [p.id, p])), [products])
  useScrollTopOnChange(step)

  const { data: drafts } = useListMyDraftsQuery()
  const [saveDraft, { isLoading: saving }] = useSaveDraftMutation()
  const [deleteDraft] = useDeleteDraftMutation()
  const [submit, { isLoading: submitting }] = useSubmitOrderMutation()

  const errors = showErrors ? validateStep(step, data, rules) : {}

  const go = (s: number) => {
    setShowErrors(false)
    dispatch(wizardActions.goTo(s))
  }

  const next = () => {
    if (Object.keys(validateStep(step, data, rules)).length) {
      setShowErrors(true)
      scrollToError()
      return
    }
    go(step + 1)
  }

  const restart = () => {
    dispatch(wizardActions.reset())
    setShowErrors(false)
    setDoneNumber(undefined)
    if (draftId) navigate('/orders/new', { replace: true })
  }

  const onSaveDraft = async () => {
    if (!data.clientId) return void message.warning(t.draftNeedClient)
    const r = await saveDraft(data)
    if ('error' in r) return void message.error(errorMessage(r.error))
    dispatch(wizardActions.setDraftId(r.data.id))
    message.success(t.draftSaved)
  }

  const onSubmit = () => {
    const bad = firstInvalidStep(data, rules)
    if (bad >= 0) {
      dispatch(wizardActions.goTo(bad))
      setShowErrors(true)
      scrollToError()
      return
    }
    modal.confirm({
      title: t.confirm.title,
      content: t.confirm.content(lines.length, formatMoney(totals.gross)),
      okText: t.confirm.ok,
      cancelText: t.confirm.cancel,
      okButtonProps: { size: 'large' },
      cancelButtonProps: { size: 'large' },
      onOk: async () => {
        const r = await submit(data)
        if ('error' in r) return void message.error(errorMessage(r.error))
        dispatch(wizardActions.reset())
        setDoneNumber(r.data.number)
      },
    })
  }

  if (!me) return null

  if (doneNumber) {
    return (
      <Card>
        <Result
          status="success"
          title={t.done.title(doneNumber)}
          subTitle={t.done.text}
          extra={[
            <Button key="list" type="primary" size="large" onClick={() => navigate('/orders')}>
              {t.done.toOrders}
            </Button>,
            <Button key="new" size="large" onClick={restart}>
              {t.done.another}
            </Button>,
          ]}
        />
      </Card>
    )
  }

  const pickClient = (id: string) => dispatch(wizardActions.setField({ field: 'clientId', value: id }))

  const renderStep = () => {
    if (draftId && draftQuery.isError) {
      return <Alert type="error" showIcon message={t.draftNotFound} description={t.draftNotFoundHint} />
    }
    if (!isClient(me) && !data.clientId) {
      return (
        <div className="step-form">
          <ClientPicker value="" error={showErrors ? ru.order.errors.client : undefined} onChange={pickClient} />
        </div>
      )
    }
    if (ctxQuery.isError) {
      return (
        <Alert
          type="error"
          showIcon
          message={errorMessage(ctxQuery.error)}
          action={<Button onClick={() => ctxQuery.refetch()}>{t.products.retry}</Button>}
        />
      )
    }
    if (!ctx) return <Skeleton active paragraph={{ rows: 6 }} />

    const p = { me, ctx, d: data, errors }
    switch (step) {
      case STEP.recipient:
        return (
          <>
            {!isClient(me) && (
              <div className="step-form" style={{ marginBottom: 20 }}>
                <ClientPicker value={data.clientId} error={errors.clientId} onChange={pickClient} />
              </div>
            )}
            <StepRecipient {...p} />
          </>
        )
      case STEP.terms:
        return <StepTerms {...p} />
      case STEP.application:
        return <StepApplication {...p} />
      case STEP.summary:
        return <StepSummary {...p} onEdit={go} />
      case STEP.products:
        return <StepProducts {...p} showErrors={showErrors} />
      default:
        return <StepSubmit {...p} showErrors={showErrors} />
    }
  }

  return (
    <>
      <PageHeader
        title={data.draftId ? t.draftTitle : t.title}
        subtitle={ctx?.client.name}
        extra={
          <Popconfirm
            title={t.restart}
            description={t.restartHint}
            okText={t.restart}
            cancelText={ru.common.cancel}
            onConfirm={restart}
          >
            <Button type="link">{t.restart}</Button>
          </Popconfirm>
        }
      />

      <WizardProgress step={step} maxStep={maxStep} isMobile={isMobile} onGo={(s) => ctx && go(s)} />

      {!data.draftId && step === STEP.recipient && !!drafts?.length && (
        <DraftsBanner
          drafts={drafts}
          onResume={(id) => navigate(`/orders/${id}/edit`)}
          onRemove={(id) => deleteDraft(id)}
        />
      )}
      {notice && (
        <Alert
          type="warning"
          showIcon
          closable
          message={notice}
          onClose={() => dispatch(wizardActions.clearNotice())}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card className="wizard-card" styles={{ body: { padding: isMobile ? 16 : 28 } }}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          {t.stepTitle(step + 1, STEPS[step])}
        </Typography.Title>
        <Typography.Paragraph type="secondary">{t.lead[step]}</Typography.Paragraph>
        <div className={step === STEP.products ? '' : 'wizard-narrow'}>{renderStep()}</div>
      </Card>

      <WizardFooter
        isMobile={isMobile}
        isFirst={step === 0}
        isLast={step === STEPS.length - 1}
        ready={!!ctx || !data.clientId}
        canSave={!!data.clientId}
        saving={saving}
        submitting={submitting}
        summary={step >= STEP.products ? { count: lines.length, total: totals.gross } : undefined}
        onBack={() => go(step - 1)}
        onSave={onSaveDraft}
        onNext={next}
        onSubmit={onSubmit}
      />
    </>
  )
}
