import { useEffect } from 'react'
import dayjs from 'dayjs'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import type { Me } from '@/features/auth/permissions'
import { isClient } from '@/features/auth/permissions'
import { useGetDraftQuery, useGetOrderProductsQuery, type OrderContext } from '../ordersApi'
import { allowedPaymentTerms, canPickDelivery, matchingApplications } from './rules'
import { wizardActions } from './wizardSlice'

/** Запуск мастера: чистый лист для нового заказа или загрузка черновика; клиент всегда заказывает за свою компанию. */
export function useWizardBootstrap(draftId: string | undefined, me: Me | undefined) {
  const dispatch = useAppDispatch()
  const { data } = useAppSelector((s) => s.orderWizard)
  const draftQuery = useGetDraftQuery(draftId ?? '', { skip: !draftId, refetchOnMountOrArgChange: true })
  const loadedDraftId = data.draftId

  // «Новый заказ» после работы с черновиком начинается с чистого листа (только при входе на экран).
  useEffect(() => {
    if (!draftId && loadedDraftId) dispatch(wizardActions.reset())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (draftId && draftQuery.data && loadedDraftId !== draftId) dispatch(wizardActions.load(draftQuery.data))
  }, [draftId, draftQuery.data, loadedDraftId, dispatch])

  const ownClientId = me && isClient(me) ? me.user.clientId : undefined
  useEffect(() => {
    if (ownClientId && !data.clientId && !draftId) {
      dispatch(wizardActions.setField({ field: 'clientId', value: ownClientId }))
    }
  }, [ownClientId, data.clientId, draftId, dispatch])

  return { draftQuery }
}

type SetField = Parameters<typeof wizardActions.setField>[0]['field']

/** Подставляет единственные варианты и значения по умолчанию (фич-лист 10.2) и убирает недопустимые выборы. */
export function useWizardAutofill(ctx: OrderContext | undefined, me: Me | undefined) {
  const dispatch = useAppDispatch()
  const { data } = useAppSelector((s) => s.orderWizard)

  useEffect(() => {
    if (!ctx || !me) return
    const set = (field: SetField, value: string) => dispatch(wizardActions.setField({ field, value }))

    if (!data.consigneeId && ctx.consignees.length === 1) set('consigneeId', ctx.consignees[0].id)
    if (!data.regionId && ctx.regions.length === 1) set('regionId', ctx.regions[0].id)
    if (!data.businessTypeId && ctx.businessTypes.length === 1) set('businessTypeId', ctx.businessTypes[0].id)

    if (data.businessTypeId) {
      const allowed = allowedPaymentTerms(ctx, data)
      if (!allowed.some((p) => p.id === data.paymentTermId)) {
        const def =
          allowed.find((p) => p.id === ctx.client.defaultPaymentTermId) ??
          (allowed.length === 1 ? allowed[0] : undefined)
        set('paymentTermId', def?.id ?? '')
      }
    }

    if (!canPickDelivery(me, ctx)) {
      const fixed = ctx.deliveryTerms[0]?.id ?? ''
      if (data.deliveryTermId !== fixed) set('deliveryTermId', fixed)
    } else if (!data.deliveryTermId && ctx.deliveryTerms.length === 1) {
      set('deliveryTermId', ctx.deliveryTerms[0].id)
    }

    if (!data.desiredDate) set('desiredDate', dayjs().add(7, 'day').format('YYYY-MM-DD'))

    if (data.regionId && data.businessTypeId && !data.applicationId) {
      const apps = matchingApplications(ctx, data)
      if (apps.length === 1) set('applicationId', apps[0].id)
    }
  }, [ctx, me, data, dispatch])
}

/** Список доступных продуктов для текущих клиента и типа бизнеса; лишние позиции из корзины убираются. */
export function useWizardProducts() {
  const dispatch = useAppDispatch()
  const { data } = useAppSelector((s) => s.orderWizard)
  const query = useGetOrderProductsQuery(
    { clientId: data.clientId, businessTypeId: data.businessTypeId },
    { skip: !data.clientId || !data.businessTypeId },
  )
  const products = query.data?.products

  useEffect(() => {
    if (!products) return
    const ids = new Set(products.map((p) => p.id))
    if (Object.keys(data.qty).some((id) => !ids.has(id))) dispatch(wizardActions.dropUnavailable([...ids]))
  }, [products, data.qty, dispatch])

  return products
}

export function useScrollTopOnChange(dep: unknown) {
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [dep])
}

/** После неудачной попытки пойти дальше показываем первую ошибку. */
export const scrollToError = () =>
  setTimeout(
    () =>
      document
        .querySelector('.field__error, .ant-alert-error')
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    60,
  )
