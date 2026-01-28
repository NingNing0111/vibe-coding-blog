'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Layout, Menu, Button, Drawer } from 'antd'
import {
  CodeOutlined,
  MenuOutlined,
  SunOutlined,
  MoonOutlined,
  HomeOutlined,
  BookOutlined,
  GithubOutlined,
  LinkOutlined,
  UserOutlined,
  TagOutlined,
  FolderOutlined,
  StarOutlined,
  SettingOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { removeTokenCookie, removeRefreshTokenCookie, removeUserRoleCookie, getUserRoleCookie } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useConfig } from '@/contexts/ConfigContext'
import type { HeaderMenuItem as HeaderMenuItemType } from '@/contexts/ConfigContext'

const { Header: AntHeader } = Layout

const ICON_MAP: Record<string, React.ReactNode> = {
  HomeOutlined: <HomeOutlined />,
  BookOutlined: <BookOutlined />,
  CodeOutlined: <CodeOutlined />,
  GithubOutlined: <GithubOutlined />,
  LinkOutlined: <LinkOutlined />,
  UserOutlined: <UserOutlined />,
  TagOutlined: <TagOutlined />,
  FolderOutlined: <FolderOutlined />,
  StarOutlined: <StarOutlined />,
  SettingOutlined: <SettingOutlined />,
  GlobalOutlined: <GlobalOutlined />,
}

function getMenuLabel(url: string, name: string, closeDrawer?: () => void) {
  const isInternal = url.startsWith('/')
  const baseClassName = '!text-inherit hover:!text-inherit'
  // 让头部菜单在不依赖额外 padding 的情况下就能出现省略号
  // 固定一个最大宽度，并开启单行省略
  const ellipsisClassName =
    'inline-block max-w-[140px] truncate align-middle'
  const className = `${baseClassName} ${ellipsisClassName}`
  if (isInternal) {
    return (
      <Link href={url} className={className} onClick={closeDrawer}>
        {name}
      </Link>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className={className} onClick={closeDrawer}>
      {name}
    </a>
  )
}

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const themeContext = useTheme()
  const { config } = useConfig()
  const { theme, toggleTheme } = mounted ? themeContext : {
    theme: 'light' as const,
    toggleTheme: () => {},
  }

  useEffect(() => {
    setMounted(true)
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    setIsLoggedIn(!!token)
    setIsAdmin(getUserRoleCookie() === 'ADMIN')
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    removeTokenCookie()
    removeRefreshTokenCookie()
    removeUserRoleCookie()
    setIsLoggedIn(false)
    setIsAdmin(false)
    setIsMobileMenuOpen(false)
    window.location.href = '/'
  }

  const headerMenuItems = (config?.header_menu?.items ?? []).filter(
    (item: HeaderMenuItemType) => item.name?.trim() && item.url?.trim()
  )

  const configMenuItems = headerMenuItems.map((item: HeaderMenuItemType, index: number) => ({
    key: `header-menu-${index}`,
    icon: item.icon ? ICON_MAP[item.icon] : undefined,
    label: getMenuLabel(item.url, item.name),
  }))

  const configMobileMenuItems = headerMenuItems.map((item: HeaderMenuItemType, index: number) => ({
    key: `header-menu-${index}`,
    icon: item.icon ? ICON_MAP[item.icon] : undefined,
    label: getMenuLabel(item.url, item.name, () => setIsMobileMenuOpen(false)),
  }))

  const menuItems = [
    ...configMenuItems,
    {
      key: 'posts',
      label: <Link href="/posts">文章</Link>,
    },
    ...(isLoggedIn
      ? [
          ...(isAdmin ? [{ key: 'admin', label: <Link href="/admin">管理</Link> }] : []),
          {
            key: 'logout',
            label: (
              <Button type="text" onClick={handleLogout}>
                退出
              </Button>
            ),
          },
        ]
      : [
          {
            key: 'login',
            label: <Link href="/login">登录</Link>,
          },
        ]),
  ]

  const mobileMenuItems = [
    ...configMobileMenuItems,
    {
      key: 'posts',
      label: <Link href="/posts" onClick={() => setIsMobileMenuOpen(false)}>文章</Link>,
    },
    ...(isLoggedIn
      ? [
          ...(isAdmin ? [{ key: 'admin', label: <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)}>管理</Link> }] : []),
          {
            key: 'logout',
            label: (
              <Button type="text" block onClick={handleLogout}>
                退出
              </Button>
            ),
          },
        ]
      : [
          {
            key: 'login',
            label: <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>登录</Link>,
          },
        ]),
  ]

  return (
    <>
      <AntHeader
        className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md transition-all duration-300 shadow-sm dark:shadow-none"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: '64px',
          borderBottom: '1px solid',
          borderBottomColor: 'rgba(226, 232, 240, 0.8)', // slate-200/80
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link
            href="/"
            className="flex items-center gap-2.5 no-underline hover:opacity-80 transition-opacity"
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: 'inherit',
            }}
          >
            {config?.site_basic?.site_logo ? (
              <img 
                src={config.site_basic.site_logo} 
                alt="Logo" 
                style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
              />
            ) : (
              <CodeOutlined style={{ fontSize: '24px', color: '#1677ff' }} />
            )}
            <span className="hidden sm:inline text-slate-900 dark:text-gray-100">
              {config?.site_basic?.site_title || process.env.NEXT_PUBLIC_SITE_TITLE || 'Tech Blog'}
            </span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          <Menu
            mode="horizontal"
            items={menuItems}
            className="flex-1 border-none bg-transparent"
            style={{
              border: 'none',
              background: 'transparent',
              minWidth: 0,
              flex: 1,
              boxShadow: 'none',
            }}
            theme="light"
          />
          <Button
            type="text"
            icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
            onClick={toggleTheme}
            aria-label="切换主题"
            className="text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 border-none"
            style={{
              border: 'none',
              boxShadow: 'none',
            }}
          />
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden flex items-center gap-1">
          <Button
            type="text"
            icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
            onClick={toggleTheme}
            aria-label="切换主题"
            className="text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100"
          />
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100"
          />
        </div>
      </AntHeader>

      {/* Mobile Menu Drawer */}
      <Drawer
        title="菜单"
        placement="right"
        onClose={() => setIsMobileMenuOpen(false)}
        open={isMobileMenuOpen}
        size={280}
      >
        <Menu
          mode="vertical"
          items={mobileMenuItems}
          style={{ border: 'none' }}
        />
      </Drawer>
    </>
  )
}
