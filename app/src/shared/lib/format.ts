import dayjs from 'dayjs'
import 'dayjs/locale/ru'

dayjs.locale('ru')

const num = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 })

export const formatNumber = (v: number) => num.format(v)
export const formatMoney = (v: number) => money.format(v)
export const formatDate = (iso?: string) => (iso ? dayjs(iso).format('DD.MM.YYYY') : '—')
export const formatDateTime = (iso?: string) => (iso ? dayjs(iso).format('DD.MM.YYYY HH:mm') : '—')
export const fullName = (u?: { firstName: string; lastName: string }) =>
  u ? `${u.lastName} ${u.firstName}`.trim() : '—'
export const initials = (u?: { firstName: string; lastName: string }) =>
  u ? `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase() : ''
