import { createSeed, type Db } from './seed'

const KEY = 'basf-demo-db'
const VERSION = 8
let db: Db | null = null

export function getDb(): Db {
  if (db) return db
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Db
      if (parsed.version === VERSION) return (db = parsed)
    }
  } catch {
    /* повреждённые данные — создаём заново */
  }
  db = createSeed()
  persist()
  return db
}

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* хранилище недоступно — демо работает в памяти */
  }
}

export function resetDb() {
  db = createSeed()
  persist()
}

let counter = Date.now()
export const newId = (prefix: string) => `${prefix}-${(counter++).toString(36)}`
