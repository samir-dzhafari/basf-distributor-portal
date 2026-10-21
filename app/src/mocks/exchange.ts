import type { ExchangeJob, ExchangeLogEntry, Order } from '@/shared/types/domain'
import { notify } from './notify'
import { newId } from './db'
import type { Db } from './seed'

/** Системный «пользователь» для событий, которые приходят из 1С. */
export const SYSTEM_USER = 'system'

/** Сколько «времени» эмулятор 1С думает над ответом (мс). */
export const EXCHANGE_TIMING = { toAccepted: 4_000, toError: 3_000, toCompleted: 30_000 }

export const EXCHANGE_ERRORS = {
  down: 'Нет ответа от сервера 1С (превышено время ожидания)',
  reject: 'Заказ отклонён 1С: код клиента не найден в справочнике',
}

const iso = (ms: number) => new Date(ms).toISOString()

function log(db: Db, orderId: string, message: string, at: number, level: ExchangeLogEntry['level'] = 'info') {
  db.exchange.log.unshift({ id: newId('exl'), at: iso(at), orderId, level, message })
  db.exchange.log.length = Math.min(db.exchange.log.length, 200)
}

function history(order: Order, userId: string, action: string, at: number, details?: string) {
  order.history.push({ id: newId('h'), at: iso(at), userId, action, details })
}

const nextErpNumber = (db: Db) => {
  const max = db.orders.reduce((m, o) => Math.max(m, Number(o.erpNumber ?? 0)), 3388650000)
  return String(max + 7)
}

/** Передать одобренный заказ в 1С: ставит в очередь обмена, результат появится позже (см. advanceExchange). */
export function enqueueExchange(db: Db, order: Order, now = Date.now()): ExchangeJob {
  const job: ExchangeJob = {
    id: newId('ex'),
    orderId: order.id,
    status: 'sent',
    outcome: db.exchange.mode,
    attempts: 1,
    sentAt: iso(now),
    updatedAt: iso(now),
  }
  db.exchange.jobs.unshift(job)
  order.status = 'sent'
  history(order, SYSTEM_USER, 'Заказ передан в 1С', now)
  log(db, order.id, `${order.number}: заказ передан в 1С`, now)
  notify(db, 'exchange.sent', order)
  return job
}

/** Повторная отправка после ошибки: результат снова определяет текущий режим эмулятора. */
export function retryExchange(db: Db, job: ExchangeJob, userId: string, now = Date.now()) {
  const order = db.orders.find((o) => o.id === job.orderId)
  if (!order || job.status !== 'error') return false
  job.attempts += 1
  job.frozen = false
  job.status = 'sent'
  job.outcome = db.exchange.mode
  job.sentAt = iso(now)
  job.updatedAt = iso(now)
  job.lastError = undefined
  order.status = 'sent'
  history(order, userId, 'Повторная передача в 1С', now, `Попытка № ${job.attempts}`)
  log(db, order.id, `${order.number}: повторная передача, попытка № ${job.attempts}`, now)
  notify(db, 'exchange.sent', order)
  return true
}

/** Отмена заказа до передачи в 1С закрывает и задание на обмен. */
export function cancelExchange(db: Db, orderId: string, now = Date.now()) {
  const job = db.exchange.jobs.find((j) => j.orderId === orderId)
  if (job && job.status === 'error') {
    job.status = 'cancelled'
    job.updatedAt = iso(now)
  }
}

/**
 * Продвигает эмуляцию 1С по времени: «передан» → «принят» (с номером) или «ошибка»; «принят» → «выполнен».
 * Вызывается при каждом обращении к мок-серверу. Возвращает true, если что-то изменилось.
 */
export function advanceExchange(db: Db, now = Date.now()): boolean {
  let changed = false
  for (const job of db.exchange.jobs) {
    const order = db.orders.find((o) => o.id === job.orderId)
    if (!order || job.frozen) continue

    if (job.status === 'sent') {
      const at = Date.parse(job.sentAt)
      if (job.outcome === 'ok' && now - at >= EXCHANGE_TIMING.toAccepted) {
        const erp = nextErpNumber(db)
        const when = at + EXCHANGE_TIMING.toAccepted
        job.status = 'accepted'
        job.erpNumber = erp
        job.updatedAt = iso(when)
        order.status = 'accepted'
        order.erpNumber = erp
        history(order, SYSTEM_USER, 'Принят в 1С', when, `Номер в 1С: ${erp}`)
        log(db, order.id, `${order.number}: принят в 1С, номер ${erp}`, when)
        notify(db, 'exchange.accepted', order)
        changed = true
      } else if (job.outcome !== 'ok' && now - at >= EXCHANGE_TIMING.toError) {
        const when = at + EXCHANGE_TIMING.toError
        job.status = 'error'
        job.lastError = EXCHANGE_ERRORS[job.outcome]
        job.updatedAt = iso(when)
        order.status = 'error'
        history(order, SYSTEM_USER, 'Ошибка передачи в 1С', when, job.lastError)
        log(db, order.id, `${order.number}: ${job.lastError}`, when, 'error')
        notify(db, 'exchange.error', order, { details: job.lastError })
        changed = true
      }
    } else if (job.status === 'accepted' && now - Date.parse(job.updatedAt) >= EXCHANGE_TIMING.toCompleted) {
      const when = Date.parse(job.updatedAt) + EXCHANGE_TIMING.toCompleted
      job.status = 'completed'
      job.updatedAt = iso(when)
      order.status = 'completed'
      history(order, SYSTEM_USER, 'Заказ выполнен', when)
      log(db, order.id, `${order.number}: выполнен`, when)
      notify(db, 'exchange.completed', order)
      changed = true
    }
  }
  return changed
}
