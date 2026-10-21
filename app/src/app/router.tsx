import type { ComponentType, ReactElement } from 'react'
import { createHashRouter, Navigate, type RouteObject } from 'react-router-dom'
import { Button, Result, Spin } from 'antd'
import { ru } from '@/shared/i18n/ru'
import type { Permission } from '@/shared/types/domain'
import { RequireAuth, RequirePermission } from '@/features/auth/guards'
import AppLayout from './AppLayout'
import { CrashScreen } from './ErrorBoundary'

const PageLoader = () => (
  <div style={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
    <Spin size="large" aria-label={ru.common.loading} />
  </div>
)

const guard = (el: ReactElement, perm?: Permission) => <RequirePermission perm={perm}>{el}</RequirePermission>

/** Страница, которая грузится отдельным файлом только при первом заходе. */
const lazyPage = (load: () => Promise<{ default: ComponentType }>, perm?: Permission): RouteObject => ({
  lazy: async () => {
    const { default: Page } = await load()
    return { Component: () => guard(<Page />, perm) }
  },
})

const publicPage = (load: () => Promise<{ default: ComponentType }>): RouteObject => ({
  lazy: async () => ({ Component: (await load()).default }),
})

/** Все маршруты приложения. Отдельным списком — чтобы их можно было проверять в тестах. */
export const routes: RouteObject[] = [
  {
    errorElement: <CrashScreen />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      { path: '/login', ...publicPage(() => import('@/features/auth/pages/LoginPage')) },
      { path: '/forgot', ...publicPage(() => import('@/features/auth/pages/ForgotPasswordPage')) },
      { path: '/reset/:token', ...publicPage(() => import('@/features/auth/pages/SetPasswordPage')) },
      { path: '/activate/:token', ...publicPage(() => import('@/features/auth/pages/SetPasswordPage')) },
      {
        path: '/',
        element: (
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Navigate to="/orders" replace /> },
          {
            path: 'orders/new',
            ...lazyPage(() => import('@/features/orders/wizard/OrderWizardPage'), 'orders.create'),
          },
          {
            path: 'orders/:id/edit',
            ...lazyPage(() => import('@/features/orders/wizard/OrderWizardPage'), 'orders.create'),
          },
          { path: 'orders', ...lazyPage(() => import('@/features/orders/list/OrdersListPage')) },
          { path: 'orders/:id', ...lazyPage(() => import('@/features/orders/card/OrderCardPage')) },
          { path: 'approvals', ...lazyPage(() => import('@/features/approvals/ApprovalQueuePage'), 'orders.approve') },
          { path: 'approvals/:id', ...lazyPage(() => import('@/features/approvals/ApprovalPage'), 'orders.approve') },
          { path: 'admin/exchange', ...lazyPage(() => import('@/features/exchange/ExchangePage'), 'exchange.manage') },
          { path: 'clients', ...lazyPage(() => import('@/features/clients/list/ClientsListPage'), 'clients.manage') },
          {
            path: 'clients/new',
            ...lazyPage(() => import('@/features/clients/card/ClientCreatePage'), 'clients.manage'),
          },
          {
            path: 'clients/import',
            ...lazyPage(() => import('@/features/clients/import/ClientsImportPage'), 'clients.manage'),
          },
          {
            path: 'clients/:id',
            ...lazyPage(() => import('@/features/clients/card/ClientCardPage'), 'clients.manage'),
          },
          { path: 'catalog/products', ...lazyPage(() => import('@/features/catalog/ProductsPage'), 'products.manage') },
          {
            path: 'catalog/products/import',
            ...lazyPage(() => import('@/features/catalog/ProductsImportPage'), 'products.manage'),
          },
          {
            path: 'applications',
            ...lazyPage(() => import('@/features/applications/ApplicationsPage'), 'applications.manage'),
          },
          {
            path: 'applications/import',
            ...lazyPage(() => import('@/features/applications/ApplicationsImportPage'), 'applications.manage'),
          },
          {
            path: 'dictionaries',
            ...lazyPage(() => import('@/features/dictionaries/DictionariesPage'), 'dictionaries.manage'),
          },
          {
            path: 'admin/employees',
            ...lazyPage(() => import('@/features/employees/EmployeesListPage'), 'users.manage'),
          },
          {
            path: 'admin/employees/new',
            ...lazyPage(() => import('@/features/employees/EmployeeCreatePage'), 'users.manage'),
          },
          {
            path: 'admin/employees/:id',
            ...lazyPage(() => import('@/features/employees/EmployeeCardPage'), 'users.manage'),
          },
          { path: 'admin/roles', ...lazyPage(() => import('@/features/roles/RolesPage'), 'roles.manage') },
          { path: 'notifications', ...lazyPage(() => import('@/features/notifications/NotificationsPage')) },
          {
            path: 'admin/notifications',
            ...lazyPage(() => import('@/features/notifications/MailPage'), 'settings.manage'),
          },
          { path: 'admin/audit', ...lazyPage(() => import('@/features/audit/AuditPage'), 'audit.view') },
          { path: 'admin/settings', ...lazyPage(() => import('@/features/settings/SettingsPage'), 'settings.manage') },
          { path: 'help', ...lazyPage(() => import('@/features/help/HelpPage')) },
          { path: 'profile', ...lazyPage(() => import('@/features/auth/pages/ProfilePage')) },
          {
            path: '*',
            element: (
              <Result
                status="404"
                title={ru.common.notFoundTitle}
                subTitle={ru.common.notFoundText}
                extra={
                  <Button type="primary" href="#/">
                    {ru.common.toHome}
                  </Button>
                }
              />
            ),
          },
        ],
      },
    ],
  },
]

export const router = createHashRouter(routes)
