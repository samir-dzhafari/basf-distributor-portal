import { createSlice, isAnyOf } from '@reduxjs/toolkit'
import dayjs from 'dayjs'
import { authApi } from './authApi'

interface AuthState {
  userId: string | null
  expiresAt: string | null
}

const KEY = 'basf-demo-session'

function load(): AuthState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as AuthState
      if (s.userId && s.expiresAt && dayjs(s.expiresAt).isAfter(dayjs())) return s
    }
  } catch {
    /* нет сохранённой сессии */
  }
  return { userId: null, expiresAt: null }
}

const save = (s: AuthState) => {
  try {
    if (s.userId) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

const slice = createSlice({
  name: 'auth',
  initialState: load,
  reducers: {
    logout(state) {
      state.userId = null
      state.expiresAt = null
      save(state)
    },
  },
  extraReducers: (b) => {
    b.addMatcher(
      isAnyOf(authApi.endpoints.login.matchFulfilled, authApi.endpoints.demoLogin.matchFulfilled),
      (state, { payload }) => {
        state.userId = payload.userId
        state.expiresAt = payload.expiresAt
        save(state)
      },
    )
    // Активация по приглашению сразу входит в кабинет; после сброса пароля — нет.
    b.addMatcher(authApi.endpoints.setPasswordByToken.matchFulfilled, (state, { payload }) => {
      if (payload.type === 'invite') {
        state.userId = payload.userId
        state.expiresAt = payload.expiresAt
        save(state)
      }
    })
  },
})

export const { logout } = slice.actions
export default slice.reducer
