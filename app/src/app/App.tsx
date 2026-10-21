import { App as AntApp, ConfigProvider } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import { store } from './store'
import { router } from './router'
import { theme } from './theme'

export default function App() {
  return (
    <ConfigProvider locale={ruRU} theme={theme}>
      <AntApp>
        <ErrorBoundary>
          <Provider store={store}>
            <RouterProvider router={router} />
          </Provider>
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  )
}
