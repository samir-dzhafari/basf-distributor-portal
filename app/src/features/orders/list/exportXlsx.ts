import dayjs from 'dayjs'
import { ORDER_STATUS } from '@/shared/lib/status'
import type { ExportData } from '../ordersViewApi'

/** Выгрузка списка заказов и их позиций в XLSX. Библиотека подгружается только при нажатии на кнопку. */
export async function exportOrdersXlsx(data: ExportData, opts: { showClient: boolean; showResponsible: boolean }) {
  const XLSX = await import('xlsx')

  const orders = data.orders.map((o) => ({
    Дата: dayjs(o.createdAt).format('DD.MM.YYYY HH:mm'),
    '№ заказа': o.number,
    '№ в 1С': o.erpNumber ?? '',
    ...(opts.showClient ? { Клиент: o.clientName } : {}),
    Регион: o.regionName,
    Город: o.city,
    Приложение: o.applicationNumber,
    Создатель: o.creatorName,
    ...(opts.showResponsible ? { Ответственный: o.responsibleName ?? '' } : {}),
    Статус: ORDER_STATUS[o.status].label,
    Позиций: o.itemsCount,
    'Сумма с НДС, ₽': o.total,
  }))
  const items = data.items.map((i) => ({
    '№ заказа': i.number,
    'Код 1С': i.code,
    Продукт: i.name,
    Количество: i.qty,
    'Ед.': i.unit,
    'Цена без НДС, ₽': i.price,
    'НДС, %': i.vatRate,
    'Сумма без НДС, ₽': i.net,
    'Сумма с НДС, ₽': i.gross,
  }))

  const wb = XLSX.utils.book_new()
  const sheet = (rows: Record<string, unknown>[]) => {
    const ws = XLSX.utils.json_to_sheet(rows)
    const keys = Object.keys(rows[0] ?? {})
    ws['!cols'] = keys.map((k) => ({
      wch: Math.min(48, Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)) + 2),
    }))
    return ws
  }
  XLSX.utils.book_append_sheet(wb, sheet(orders), 'Заказы')
  XLSX.utils.book_append_sheet(wb, sheet(items), 'Позиции')
  XLSX.writeFile(wb, `zakazy_${dayjs().format('YYYY-MM-DD_HHmm')}.xlsx`)
}
