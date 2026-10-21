import { isClient, type Me } from '@/features/auth/permissions'
import type { OrderContext } from '../ordersApi'
import type { WizardData } from './validate'

/** Допустимые условия оплаты: пересечение условий клиента и типа бизнеса (если пересечение пусто — условия клиента). */
export function allowedPaymentTerms(ctx: OrderContext, d: Pick<WizardData, 'businessTypeId'>) {
  const bt = ctx.businessTypes.find((b) => b.id === d.businessTypeId)
  const both = ctx.paymentTerms.filter((p) => bt?.paymentTermIds.includes(p.id))
  return both.length ? both : ctx.paymentTerms
}

/** Выбирает ли условие поставки сам пользователь. Сотрудник — всегда; клиент — если ему это разрешено. */
export const canPickDelivery = (me: Me, ctx: OrderContext) => !isClient(me) || ctx.client.canChooseDelivery

/** Приложения клиента, подходящие под выбранные регион и тип бизнеса. */
export const matchingApplications = (ctx: OrderContext, d: Pick<WizardData, 'regionId' | 'businessTypeId'>) =>
  ctx.applications.filter((a) => a.regionId === d.regionId && a.businessTypeId === d.businessTypeId)
