import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { ru } from '@/shared/i18n/ru'
import type { Id } from '@/shared/types/domain'
import { STEP, emptyWizard, type WizardData } from './validate'

export interface WizardState {
  data: WizardData
  step: number
  /** Самый дальний открытый шаг — к нему можно вернуться по индикатору. */
  maxStep: number
  /** Одноразовое сообщение пользователю (например, о сброшенных позициях). */
  notice?: string
}

const initial = (): WizardState => ({ data: emptyWizard(), step: 0, maxStep: 0 })

type Scalar = Exclude<keyof WizardData, 'qty' | 'draftId'>

const slice = createSlice({
  name: 'orderWizard',
  initialState: initial,
  reducers: {
    reset: () => initial(),
    /** Продолжить черновик: все введённые данные возвращаются, начинаем с шага проверки. */
    load(_s, a: PayloadAction<WizardData>) {
      return { data: a.payload, step: STEP.summary, maxStep: STEP.submit }
    },
    setDraftId(s, a: PayloadAction<Id>) {
      s.data.draftId = a.payload
    },
    /** Меняет поле и сбрасывает всё, что от него зависит. */
    setField(s, a: PayloadAction<{ field: Scalar; value: string }>) {
      const { field, value } = a.payload
      const d = s.data
      if (d[field] === value) return
      d[field] = value
      if (field === 'clientId') {
        Object.assign(d, {
          consigneeId: '',
          regionId: '',
          businessTypeId: '',
          paymentTermId: '',
          deliveryTermId: '',
          applicationId: '',
        })
        d.qty = {}
      }
      if (field === 'regionId' || field === 'businessTypeId') d.applicationId = ''
      if (field === 'businessTypeId' && Object.keys(d.qty).length) {
        d.qty = {}
        s.notice = ru.order.businessTypeChanged
      }
    },
    /** qty ≤ 0 или не число — убирает позицию. */
    setQty(s, a: PayloadAction<{ productId: Id; qty: number | null }>) {
      const { productId, qty } = a.payload
      if (qty && qty > 0) s.data.qty[productId] = qty
      else delete s.data.qty[productId]
    },
    addMany(s, a: PayloadAction<{ productId: Id; qty: number }[]>) {
      a.payload.forEach(({ productId, qty }) => {
        if (!s.data.qty[productId]) s.data.qty[productId] = qty
      })
    },
    dropUnavailable(s, a: PayloadAction<Id[]>) {
      const allowed = new Set(a.payload)
      Object.keys(s.data.qty).forEach((id) => {
        if (!allowed.has(id)) delete s.data.qty[id]
      })
    },
    setComment(s, a: PayloadAction<string>) {
      s.data.comment = a.payload
    },
    goTo(s, a: PayloadAction<number>) {
      s.step = a.payload
      s.maxStep = Math.max(s.maxStep, a.payload)
    },
    clearNotice(s) {
      s.notice = undefined
    },
  },
})

export const wizardActions = slice.actions
export default slice.reducer
