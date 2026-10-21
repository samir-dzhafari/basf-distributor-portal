import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Button, Result, Spin } from 'antd'
import { useEffect } from 'react'
import dayjs from 'dayjs'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { api } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import type { Permission } from '@/shared/types/domain'
import { logout } from './authSlice'
import { can } from './permissions'
import { useMe } from './useMe'

export function RequireAuth({ children }: { children: ReactNode }) {
  const userId = useAppSelector((s) => s.auth.userId)
  const dispatch = useAppDispatch()
  const location = useLocation()
  const expiresAt = useAppSelector((s) => s.auth.expiresAt)
  const { data: me, isError } = useMe()

  // Сессия закончилась на сервере или истёк её срок — возвращаем на экран входа.
  useEffect(() => {
    const end = () => {
      dispatch(logout())
      dispatch(api.util.resetApiState())
    }
    if (isError) return end()
    if (!expiresAt) return
    const timer = setTimeout(end, Math.max(0, dayjs(expiresAt).diff(dayjs())))
    return () => clearTimeout(timer)
  }, [isError, expiresAt, dispatch])

  if (!userId) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (!me) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip={ru.common.loading}>
          <div style={{ padding: 40 }} />
        </Spin>
      </div>
    )
  }
  return <>{children}</>
}

export function RequirePermission({ perm, children }: { perm?: Permission; children: ReactNode }) {
  const { data: me } = useMe()
  if (perm && !can(me, perm)) {
    return (
      <Result
        status="403"
        title={ru.common.noAccessTitle}
        subTitle={ru.common.noAccessText}
        extra={
          <Button type="primary" href="#/">
            {ru.common.toHome}
          </Button>
        }
      />
    )
  }
  return <>{children}</>
}
