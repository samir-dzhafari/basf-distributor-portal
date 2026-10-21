import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Drawer, Dropdown, Grid, Layout, Menu, type MenuProps } from 'antd'
import {
  DownOutlined,
  MenuOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  LogoutOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useAppDispatch } from '@/app/hooks'
import { api } from '@/app/api'
import { resetDb } from '@/mocks/db'
import { logout } from '@/features/auth/authSlice'
import { can } from '@/features/auth/permissions'
import { useMe } from '@/features/auth/useMe'
import { BrandLogo } from '@/shared/ui/BrandLogo'
import { fullName } from '@/shared/lib/format'
import { ru } from '@/shared/i18n/ru'
import { useGetApprovalCountQuery } from '@/features/approvals/approvalsApi'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { buildNav, flatten, type NavItem } from './nav'

const { Header, Content } = Layout

export default function AppLayout() {
  const { data: me } = useMe()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  // При переходе на другую страницу переводим фокус на её заголовок: так экранный диктор объявляет новую страницу,
  // а пользователь клавиатуры не остаётся где-то в шапке.
  useEffect(() => {
    const timer = setTimeout(() => {
      const main = mainRef.current
      if (!main) return
      const heading = main.querySelector<HTMLElement>('h2')
      const target = heading ?? main
      target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
    }, 250)
    return () => clearTimeout(timer)
  }, [location.pathname])
  const screens = Grid.useBreakpoint()
  // Горизонтальное меню (до 5 пунктов + кнопка + профиль) помещается от 1200 px; ниже — выдвижная панель.
  const isMobile = !screens.xl
  const [drawer, setDrawer] = useState(false)
  // Счётчик заказов, ждущих решения, — в меню рядом с «Одобрением».
  const { data: approvalCount = 0 } = useGetApprovalCountQuery(undefined, {
    skip: !can(me, 'orders.approve'),
    pollingInterval: 15000,
  })

  const nav = useMemo(() => (me ? buildNav(me) : []), [me])
  const activeKey = useMemo(() => {
    const flat = flatten(nav)
    return flat
      .filter((i) => i.path && (location.pathname === i.path || location.pathname.startsWith(i.path + '/')))
      .sort((a, b) => b.path!.length - a.path!.length)[0]?.key
  }, [nav, location.pathname])

  if (!me) return null

  const toMenu = (i: NavItem): NonNullable<MenuProps['items']>[number] =>
    i.children
      ? { key: i.key, label: i.label, children: i.children.map(toMenu) }
      : {
          key: i.key,
          label: (
            <Link to={i.path!}>
              {i.label}
              {i.key === 'approvals' && approvalCount > 0 && (
                <Badge
                  count={approvalCount}
                  color="#F39500"
                  overflowCount={99}
                  style={{ marginLeft: 8 }}
                  aria-label={ru.approvals.queueCount(approvalCount)}
                />
              )}
            </Link>
          ),
        }

  const signOut = () => {
    dispatch(logout())
    dispatch(api.util.resetApiState())
    navigate('/login', { replace: true })
  }
  const resetDemo = () => {
    resetDb()
    dispatch(logout())
    window.location.hash = '#/login'
    window.location.reload()
  }

  const userMenu: MenuProps = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: ru.nav.profile, onClick: () => navigate('/profile') },
      { key: 'help', icon: <QuestionCircleOutlined />, label: ru.nav.help, onClick: () => navigate('/help') },
      { key: 'reset', icon: <ReloadOutlined />, label: ru.nav.resetDemo, onClick: resetDemo },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: ru.nav.logout, onClick: signOut },
    ],
  }

  const newOrderBtn = can(me, 'orders.create') && (
    <Button
      type="primary"
      icon={<PlusOutlined />}
      onClick={() => {
        setDrawer(false)
        navigate('/orders/new')
      }}
    >
      {ru.nav.newOrder}
    </Button>
  )

  const menuItems = nav.map(toMenu)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <button type="button" className="skip-link" onClick={() => mainRef.current?.focus()}>
        {ru.common.skipToContent}
      </button>
      <Header className="app-header">
        {isMobile && (
          <Button
            type="text"
            aria-label={ru.nav.menu}
            icon={<MenuOutlined style={{ color: '#1E1E1E', fontSize: 20 }} />}
            onClick={() => setDrawer(true)}
          />
        )}
        <Link to="/" aria-label={ru.appName} className="app-header__logo">
          <BrandLogo showName={!isMobile} />
        </Link>
        {!isMobile && (
          <Menu
            theme="light"
            mode="horizontal"
            items={menuItems}
            selectedKeys={activeKey ? [activeKey] : []}
            style={{ flex: 1, minWidth: 0, background: 'transparent', borderBottom: 0 }}
          />
        )}
        <div style={{ flex: isMobile ? 1 : undefined }} />
        {!isMobile && newOrderBtn}
        <NotificationBell />
        <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
          <Button type="text" className="app-header__user" aria-label={fullName(me.user)}>
            <Avatar size={32} style={{ background: '#00793A' }} icon={<UserOutlined />} />
            {!isMobile && (
              <span className="app-header__user-text">
                <strong>{fullName(me.user)}</strong>
                <small>{me.clientName ?? me.role.name}</small>
              </span>
            )}
            <DownOutlined style={{ fontSize: 11 }} />
          </Button>
        </Dropdown>
      </Header>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        placement="left"
        width={290}
        title={<BrandLogo />}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: 16 }}>{newOrderBtn}</div>
        <Menu
          mode="inline"
          items={menuItems}
          selectedKeys={activeKey ? [activeKey] : []}
          defaultOpenKeys={nav.filter((n) => n.children).map((n) => n.key)}
          onClick={() => setDrawer(false)}
          style={{ borderInlineEnd: 0 }}
        />
      </Drawer>

      <Content id="main" ref={mainRef} tabIndex={-1} className="app-content" aria-label={ru.appName}>
        <Outlet />
      </Content>
    </Layout>
  )
}
