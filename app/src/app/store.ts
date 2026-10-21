import { configureStore } from '@reduxjs/toolkit'
import { api } from './api'
import auth from '@/features/auth/authSlice'
import orderWizard from '@/features/orders/wizard/wizardSlice'

export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer, auth, orderWizard },
  middleware: (gdm) => gdm().concat(api.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
