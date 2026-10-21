import type { ReactNode } from 'react'
import { BrandLogo } from '@/shared/ui/BrandLogo'
import { ru } from '@/shared/i18n/ru'

/** Каркас публичных экранов: слева — бренд, справа — форма. На телефоне — только форма. */
export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="auth">
      <aside className="auth__hero">
        <BrandLogo dark showName={false} />
        <div>
          <h1>{ru.auth.heroTitle}</h1>
          <p>{ru.auth.heroText}</p>
        </div>
        <small>{ru.appName}</small>
      </aside>
      <main className="auth__main">
        <div className="auth__mobile-logo">
          <BrandLogo />
        </div>
        <div className="auth__card" style={wide ? { maxWidth: 560 } : undefined}>
          {children}
        </div>
      </main>
    </div>
  )
}
