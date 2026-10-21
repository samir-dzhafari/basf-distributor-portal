import { Component, type ReactNode } from 'react'
import { Button, Result } from 'antd'
import { ru } from '@/shared/i18n/ru'

export function CrashScreen() {
  return (
    <Result
      status="error"
      title={ru.common.crashTitle}
      subTitle={ru.common.crashText}
      extra={
        <Button type="primary" size="large" onClick={() => window.location.reload()}>
          {ru.common.reload}
        </Button>
      }
      style={{ paddingTop: 96 }}
    />
  )
}

/** Последний рубеж: вместо белого экрана — понятное сообщение и кнопка «Обновить». */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children
  }
}
