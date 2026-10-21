import logo from '@/assets/basf-logo.png'
import { ru } from '@/shared/i18n/ru'

/** Логотип BASF (символ, название, девиз) — по руководству только чёрный или белый, плоский. */
export function BrandLogo({ dark = false, showName = true }: { dark?: boolean; showName?: boolean }) {
  return (
    <span className={`brand-logo${dark ? ' brand-logo--dark' : ''}`}>
      <img className="brand-logo__img" src={logo} alt="BASF — We create chemistry" />
      {showName && <span className="brand-logo__name">{ru.appName}</span>}
    </span>
  )
}
