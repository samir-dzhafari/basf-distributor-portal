import type { HTMLAttributes, KeyboardEvent } from 'react'

/**
 * Свойства строки таблицы, по которой можно «открыть» запись: клик мышью и клавиатура (Tab → Enter/пробел).
 * Без этого строки, открывающиеся по клику, недоступны тем, кто работает без мыши.
 */
export function clickableRow(open: () => void): HTMLAttributes<HTMLElement> {
  return {
    onClick: open,
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      // Только когда фокус на самой строке, а не на кнопке или поле внутри неё.
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        open()
      }
    },
  }
}
