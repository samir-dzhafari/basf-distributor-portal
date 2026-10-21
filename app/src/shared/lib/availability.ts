import type { Client, Id, Product } from '@/shared/types/domain'

export type Availability = Client['availability']

export type UnavailableReason =
  'closedGlobally' | 'closedGroup' | 'closedLine' | 'closedProduct' | 'outsidePrice' | 'otherBusiness'

export const emptyAvailability = (): Availability => ({
  closedGroupIds: [],
  closedLineIds: [],
  closedProductIds: [],
  openedProductIds: [],
})

/**
 * Можно ли клиенту заказать продукт (фич-лист 6.7). Доступность определяет только право заказа, остатки не учитываются.
 * Порядок причин — от самой «внешней»: закрыто в каталоге → группа → линейка → позиция → вне прайс-листа → чужой тип бизнеса.
 */
export function productAvailability(
  p: Pick<Product, 'id' | 'closed' | 'groupId' | 'lineId' | 'inPriceList' | 'businessTypeIds'>,
  a: Availability,
  businessTypeIds?: Id[],
): { orderable: boolean; reason?: UnavailableReason } {
  const no = (reason: UnavailableReason) => ({ orderable: false, reason })
  if (p.closed) return no('closedGlobally')
  if (a.closedGroupIds.includes(p.groupId)) return no('closedGroup')
  if (a.closedLineIds.includes(p.lineId)) return no('closedLine')
  if (a.closedProductIds.includes(p.id)) return no('closedProduct')
  if (!p.inPriceList && !a.openedProductIds.includes(p.id)) return no('outsidePrice')
  if (businessTypeIds && !p.businessTypeIds.some((id) => businessTypeIds.includes(id))) return no('otherBusiness')
  return { orderable: true }
}

/** Включает или выключает одну позицию: для позиции из прайс-листа правит «закрытые», для внепрайсовой — «открытые». */
export function setProductOpen(a: Availability, p: Pick<Product, 'id' | 'inPriceList'>, open: boolean): Availability {
  const without = (ids: Id[]) => ids.filter((x) => x !== p.id)
  if (p.inPriceList) {
    return { ...a, closedProductIds: open ? without(a.closedProductIds) : [...without(a.closedProductIds), p.id] }
  }
  return { ...a, openedProductIds: open ? [...without(a.openedProductIds), p.id] : without(a.openedProductIds) }
}

export function toggleId(ids: Id[], id: Id, on: boolean): Id[] {
  const rest = ids.filter((x) => x !== id)
  return on ? [...rest, id] : rest
}
