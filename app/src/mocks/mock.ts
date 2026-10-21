import { getDb, persist } from './db'
import { advanceExchange } from './exchange'
import { applyPriceSchedule } from './prices'
import type { Db } from './seed'

export interface ApiError {
  code: string
  message: string
}

export class MockError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Выполняет «запрос к серверу» поверх мок-БД: задержка 150–350 мс, сохранение в localStorage.
 * Возвращает форму, которую ждёт queryFn в RTK Query.
 */
export async function mock<T>(
  fn: (db: Db) => T,
  opts: { write?: boolean } = {},
): Promise<{ data: T } | { error: ApiError }> {
  await sleep(150 + Math.random() * 200)
  try {
    const db = getDb()
    // «Время» в эмуляции 1С идёт, пока приложение открыто: при каждом обращении подтягиваем ответы 1С.
    if (advanceExchange(db) || applyPriceSchedule(db)) persist()
    const data = fn(db)
    if (opts.write) persist()
    // Копия: RTK замораживает ответы, а мок-БД должна оставаться изменяемой.
    return { data: structuredClone(data) }
  } catch (e) {
    if (e instanceof MockError) return { error: { code: e.code, message: e.message } }
    console.error(e)
    return { error: { code: 'unknown', message: 'Что-то пошло не так. Попробуйте ещё раз.' } }
  }
}
