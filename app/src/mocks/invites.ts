import dayjs from 'dayjs'
import type { TokenType, User } from '@/shared/types/domain'
import { newId } from './db'
import type { Db } from './seed'

/** Одноразовая ссылка для активации (7 суток) или сброса пароля (1 час). Прежняя ссылка того же типа гаснет. */
export function issueToken(db: Db, userId: string, type: TokenType) {
  const token = `${type}-${newId('t')}`
  db.tokens = db.tokens.filter((t) => !(t.userId === userId && t.type === type))
  db.tokens.push({
    token,
    userId,
    type,
    expiresAt: dayjs()
      .add(type === 'reset' ? 1 : 168, 'hour')
      .toISOString(),
  })
  return token
}

/** «Отправляет» письмо-приглашение: в демо оно попадает в журнал писем, а ссылка показывается на экране. */
export function sendInvite(db: Db, user: User): string {
  const token = issueToken(db, user.id, 'invite')
  const link = `/activate/${token}`
  db.emails.push({
    id: newId('em'),
    to: user.email,
    at: new Date().toISOString(),
    subject: 'Приглашение в кабинет дистрибьютора',
    body: 'Задайте пароль, чтобы войти в кабинет.',
    link,
  })
  return link
}

export const inviteLinkFor = (db: Db, userId: string): string | undefined => {
  const t = db.tokens.find((x) => x.userId === userId && x.type === 'invite' && dayjs(x.expiresAt).isAfter(dayjs()))
  return t ? `/activate/${t.token}` : undefined
}
