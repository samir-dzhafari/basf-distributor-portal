import { skipToken } from '@reduxjs/toolkit/query/react'
import { useAppSelector } from '@/app/hooks'
import { useGetMeQuery } from './authApi'

export function useMe() {
  const userId = useAppSelector((s) => s.auth.userId)
  return useGetMeQuery(userId ?? skipToken)
}
