import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import type { ApiError } from '@/mocks/mock'

/**
 * Единый API-слой. Сейчас эндпоинты работают поверх мок-БД (queryFn).
 * Чтобы подключить реальный бэкенд, замените fakeBaseQuery на fetchBaseQuery и queryFn на query.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<ApiError>(),
  tagTypes: [
    'Me',
    'Order',
    'Client',
    'User',
    'Role',
    'Product',
    'Application',
    'Dictionary',
    'Email',
    'Notification',
    'Audit',
    'Settings',
  ],
  endpoints: () => ({}),
})

const FALLBACK = 'Что-то пошло не так. Попробуйте ещё раз.'

export const errorMessage = (e: unknown): string =>
  e && typeof e === 'object' && 'message' in e && typeof (e as ApiError).message === 'string'
    ? (e as ApiError).message
    : FALLBACK

export const errorCode = (e: unknown): string | undefined =>
  e && typeof e === 'object' && 'code' in e && typeof (e as ApiError).code === 'string'
    ? (e as ApiError).code
    : undefined
