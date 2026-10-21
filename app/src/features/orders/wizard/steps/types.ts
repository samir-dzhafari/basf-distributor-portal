import type { Me } from '@/features/auth/permissions'
import type { OrderContext } from '../../ordersApi'
import type { Errors, WizardData } from '../validate'

export interface StepProps {
  me: Me
  ctx: OrderContext
  d: WizardData
  /** Ошибки показываем только после попытки пойти дальше. */
  errors: Errors
}
