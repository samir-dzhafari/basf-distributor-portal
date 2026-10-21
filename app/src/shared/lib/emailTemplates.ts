import type { NotificationType } from '@/shared/types/domain'
import { NOTIFICATION_META } from './notificationMeta'

/** Данные заказа, которые попадают в письмо. */
export interface EmailData {
  number: string
  clientName: string
  applicationNumber: string
  total: string
  status: string
  /** Ссылка на карточку заказа. */
  link: string
  erpNumber?: string
  /** Пояснение: причина отклонения, перечень правок, имя документа, текст ошибки. */
  details?: string
  actorName?: string
  senderEmail: string
}

export interface RenderedEmail {
  subject: string
  /** Короткий текст, который видно в списке писем. */
  preheader: string
  html: string
  text: string
}

export const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const LEAD: Record<NotificationType, (d: EmailData) => string> = {
  'order.submitted': (d) => `Клиент ${d.clientName} отправил заказ ${d.number}. Его нужно проверить и принять решение.`,
  'order.approved': (d) =>
    `Заказ ${d.number} одобрен${d.actorName ? ` (${d.actorName})` : ''} и передан в учётную систему.`,
  'order.rejected': (d) => `Заказ ${d.number} отклонён${d.actorName ? ` сотрудником ${d.actorName}` : ''}.`,
  'order.changed': (d) =>
    `В заказ ${d.number} внесены изменения${d.actorName ? ` (${d.actorName})` : ''}. Проверьте состав и суммы.`,
  'order.cancelled': (d) => `Заказ ${d.number} отменён${d.actorName ? ` (${d.actorName})` : ''}.`,
  'exchange.sent': (d) => `Заказ ${d.number} передан в учётную систему 1С.`,
  'exchange.error': (d) => `Заказ ${d.number} не удалось передать в 1С. Нужна повторная отправка.`,
  'exchange.accepted': (d) =>
    `Заказ ${d.number} принят в учётной системе${d.erpNumber ? `, номер в 1С: ${d.erpNumber}` : ''}.`,
  'exchange.completed': (d) => `Заказ ${d.number} выполнен.`,
  'document.uploaded': (d) => `К заказу ${d.number} добавлен документ.`,
}

const DETAILS_LABEL: Partial<Record<NotificationType, string>> = {
  'order.rejected': 'Причина',
  'order.changed': 'Что изменилось',
  'order.cancelled': 'Причина',
  'exchange.error': 'Ошибка',
  'document.uploaded': 'Документ',
  'order.approved': 'Комментарий',
}

/** Единый HTML-шаблон письма: ключевые данные заказа и ссылка на карточку (фич-лист 13.2). Значения экранируются. */
export function renderEmail(type: NotificationType, d: EmailData): RenderedEmail {
  const meta = NOTIFICATION_META[type]
  const subject = meta.title(d.number)
  const lead = LEAD[type](d)
  const accent = meta.severity === 'error' ? '#C50022' : meta.severity === 'warning' ? '#A85F00' : '#00793A'
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#5A5F61;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:600">${escapeHtml(v)}</td></tr>`
  const rows = [
    row('Заказ', d.number),
    row('Клиент', d.clientName),
    row('Приложение', d.applicationNumber),
    row('Статус', d.status),
    d.erpNumber ? row('Номер в 1С', d.erpNumber) : '',
    row('Сумма с НДС', d.total),
  ].join('')
  const details = d.details
    ? `<div style="margin:16px 0;padding:12px 16px;background:#F6F7F7;border-left:4px solid ${accent};border-radius:4px"><div style="color:#5A5F61;font-size:13px">${escapeHtml(DETAILS_LABEL[type] ?? 'Подробности')}</div><div style="white-space:pre-line">${escapeHtml(d.details)}</div></div>`
    : ''
  const html = `<!doctype html><html lang="ru"><body style="margin:0;background:#F3F4F4;font-family:'Segoe UI',Arial,sans-serif;color:#1E1E1E">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#1E1E1E;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0"><span style="font-weight:800;letter-spacing:1px;font-size:20px">■ BASF</span> <span style="opacity:.8;margin-left:8px">Кабинет дистрибьютора</span></div>
  <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #DDE0E0;border-top:0">
    <h1 style="margin:0 0 12px;font-size:20px;color:${accent}">${escapeHtml(subject)}</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escapeHtml(lead)}</p>
    <table style="border-collapse:collapse;font-size:15px">${rows}</table>
    ${details}
    <p style="margin:24px 0"><a href="${escapeHtml(d.link)}" style="display:inline-block;background:#00793A;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Открыть заказ</a></p>
    <p style="margin:0;color:#5A5F61;font-size:13px">Это автоматическое письмо. Отключить такие уведомления можно в профиле, раздел «Уведомления». Отправитель: ${escapeHtml(d.senderEmail)}</p>
  </div>
</div></body></html>`
  const text = [
    lead,
    `Клиент: ${d.clientName}`,
    `Приложение: ${d.applicationNumber}`,
    `Сумма с НДС: ${d.total}`,
    d.details ? `${DETAILS_LABEL[type] ?? 'Подробности'}: ${d.details}` : '',
    `Открыть: ${d.link}`,
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, preheader: lead, html, text }
}

/** Пример данных для просмотра шаблонов. */
export const SAMPLE_EMAIL_DATA: Record<NotificationType, Partial<EmailData>> = {
  'order.submitted': {},
  'order.approved': { actorName: 'Воронова Ирина', details: 'Объём скорректирован по согласованию' },
  'order.rejected': { actorName: 'Воронова Ирина', details: 'Объём не совпадает с условиями приложения' },
  'order.changed': { actorName: 'Воронова Ирина', details: 'Дуал Голд 20 л: 60 → 50 л\nЭфория 5 л: позиция удалена' },
  'order.cancelled': { actorName: 'Иванов Пётр', details: 'Клиент передумал' },
  'exchange.sent': {},
  'exchange.error': { details: 'Нет ответа от сервера 1С (превышено время ожидания)' },
  'exchange.accepted': { erpNumber: '3388650007' },
  'exchange.completed': { erpNumber: '3388650007' },
  'document.uploaded': { details: 'УПД: UPD_1040.pdf' },
}
