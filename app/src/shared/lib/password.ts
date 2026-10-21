export interface PasswordRule {
  id: 'length' | 'letter' | 'digit' | 'notEmail'
  label: string
  ok: boolean
}

export const PASSWORD_MIN_LENGTH = 8

/** Парольная политика (фич-лист 3.4). */
export function checkPassword(password: string, email?: string): PasswordRule[] {
  const local = email?.split('@')[0]?.toLowerCase()
  return [
    { id: 'length', label: `Не короче ${PASSWORD_MIN_LENGTH} символов`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { id: 'letter', label: 'Есть хотя бы одна буква', ok: /\p{L}/u.test(password) },
    { id: 'digit', label: 'Есть хотя бы одна цифра', ok: /\d/.test(password) },
    {
      id: 'notEmail',
      label: 'Не совпадает с адресом почты',
      ok:
        !!password && !(email && (password.toLowerCase() === email.toLowerCase() || password.toLowerCase() === local)),
    },
  ]
}

export const isPasswordValid = (password: string, email?: string) => checkPassword(password, email).every((r) => r.ok)
