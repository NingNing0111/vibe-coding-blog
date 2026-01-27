'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { apiGet } from '@/lib/api'
import { removeTokenCookie, removeRefreshTokenCookie } from '@/lib/utils'
import { useConfig } from '@/contexts/ConfigContext'
import {
  Layout,
  Menu,
  Breadcrumb,
  Avatar,
  Dropdown,
  Space,
  Button,
  Typography,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FolderOutlined,
  TagOutlined,
  CommentOutlined,
  PictureOutlined,
  SettingOutlined,
  HomeOutlined,
  LogoutOutlined,
  UserOutlined,
  CodeOutlined,
} from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Text } = Typography

interface MenuItem {
  key: string
  label: string
  icon: React.ReactNode
  path: string
}

const menuItems: MenuItem[] = [
  { key: '/admin', label: '仪表盘', icon: <DashboardOutlined />, path: '/admin' },
  { key: '/admin/posts', label: '文章管理', icon: <FileTextOutlined />, path: '/admin/posts' },
  { key: '/admin/categories', label: '分类管理', icon: <FolderOutlined />, path: '/admin/categories' },
  { key: '/admin/tags', label: '标签管理', icon: <TagOutlined />, path: '/admin/tags' },
  { key: '/admin/comments', label: '评论管理', icon: <CommentOutlined />, path: '/admin/comments' },
  { key: '/admin/media', label: '媒体资源', icon: <PictureOutlined />, path: '/admin/media' },
  { key: '/admin/config', label: '配置管理', icon: <SettingOutlined />, path: '/admin/config' },
]

// 路由到标签的映射
const routeLabels: Record<string, string> = {
  '/admin': '仪表盘',
  '/admin/posts': '文章管理',
  '/admin/posts/new': '新建文章',
  '/admin/posts/[id]/edit': '编辑文章',
  '/admin/categories': '分类管理',
  '/admin/tags': '标签管理',
  '/admin/comments': '评论管理',
  '/admin/media': '媒体资源',
  '/admin/config': '配置管理',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { config } = useConfig()
  const [user, setUser] = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)
  const hasFetchedUser = useRef(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.push('/login')
      return
    }

    // 防止重复请求用户信息
    if (!hasFetchedUser.current) {
      hasFetchedUser.current = true
      apiGet('/api/v1/auth/me', true)
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('access_token')
          router.push('/login')
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 只在组件挂载时执行一次

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    removeTokenCookie()
    removeRefreshTokenCookie()
    router.push('/')
  }

  // 生成面包屑
  const breadcrumbItems = useMemo(() => {
    if (!pathname) return []
    
    const paths = pathname.split('/').filter(Boolean)
    const items: Array<{ title: string; href?: string }> = []

    // 如果路径就是 /admin，只显示首页
    if (paths.length === 1 && paths[0] === 'admin') {
      return [{ title: '仪表盘' }]
    }

    let currentPath = '/admin'
    items.push({ title: '仪表盘', href: '/admin' })

    // 跳过 admin 本身，从第二个路径段开始处理
    for (let i = 1; i < paths.length; i++) {
      const segment = paths[i]
      currentPath += `/${segment}`

      // 处理动态路由和特殊路径
      let label = routeLabels[currentPath]
      if (!label) {
        // 如果是数字ID，跳过（不显示在面包屑中，由下一个路径段决定标签）
        if (/^\d+$/.test(segment)) {
          continue
        } else if (segment === 'new') {
          // 根据父路径确定标签
          const parentPath = paths.slice(0, i).join('/')
          if (parentPath.includes('posts')) {
            label = '新建文章'
          } else {
            label = '新建'
          }
        } else if (segment === 'edit') {
          // 根据父路径确定标签
          const parentPath = paths.slice(0, i).join('/')
          if (parentPath.includes('posts')) {
            label = '编辑文章'
          } else {
            label = '编辑'
          }
        } else {
          // 尝试从父路径推断
          const parentPath = `/${paths.slice(0, i).join('/')}`
          label = routeLabels[parentPath] || segment
        }
      }

      // 最后一个不添加链接
      if (i === paths.length - 1) {
        items.push({ title: label })
      } else {
        // 如果下一个是数字ID，当前路径也不添加链接（因为数字ID会被跳过）
        const nextSegment = paths[i + 1]
        if (nextSegment && /^\d+$/.test(nextSegment)) {
          items.push({ title: label })
        } else {
          items.push({ title: label, href: currentPath })
        }
      }
    }

    return items
  }, [pathname])

  // 获取当前选中的菜单项
  const selectedKeys = useMemo(() => {
    if (!pathname) return ['/admin']
    // 找到最匹配的菜单项
    for (const item of menuItems) {
      if (pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path))) {
        return [item.key]
      }
    }
    return ['/admin']
  }, [pathname])

  // 菜单点击处理
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    const item = menuItems.find((m) => m.key === key)
    if (item) {
      router.push(item.path)
    }
  }

  // 用户下拉菜单
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'home',
      icon: <HomeOutlined />,
      label: (
        <Link href="/" style={{ textDecoration: 'none' }}>
          返回首页
        </Link>
      ),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        width={200}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
          zIndex: 100,
        }}
      >
        <div style={{ 
          padding: '16px', 
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          height: '64px',
          gap: '12px'
        }}>
          {config?.site_basic?.site_logo ? (
            <img 
              src={config.site_basic.site_logo} 
              alt="Logo" 
              style={{ 
                width: collapsed ? '32px' : '32px', 
                height: collapsed ? '32px' : '32px', 
                objectFit: 'contain',
                flexShrink: 0
              }} 
            />
          ) : (
            <CodeOutlined style={{ 
              fontSize: collapsed ? '24px' : '24px', 
              color: '#1890ff',
              flexShrink: 0
            }} />
          )}
          {!collapsed && (
            <Text strong style={{ fontSize: '18px', color: '#1890ff', whiteSpace: 'nowrap' }}>
              {config?.site_basic?.site_title || 'Blog Admin'}
            </Text>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          onClick={handleMenuClick}
          items={menuItems.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
          }))}
          style={{ borderRight: 0, marginTop: '4px' }}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s', background: '#f5f7fa' }}>
        <Header
          style={{
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(8px)',
            padding: '0 24px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '64px',
            lineHeight: '64px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Space size={0}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: '16px',
                width: 64,
                height: 64,
              }}
            />
            <Breadcrumb
              items={breadcrumbItems.map((item) => ({
                title: item.href ? (
                  <Link href={item.href} style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                    {item.title}
                  </Link>
                ) : (
                  <span style={{ color: 'rgba(0, 0, 0, 0.85)', fontWeight: 500 }}>{item.title}</span>
                ),
              }))}
            />
          </Space>
          <Space size={16}>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <Space style={{ cursor: 'pointer', padding: '0 8px', borderRadius: '4px', transition: 'all 0.3s' }} className="user-dropdown-hover">
                <Avatar 
                  size="small" 
                  icon={<UserOutlined />} 
                  src={user?.avatar}
                  style={{ backgroundColor: '#1890ff' }}
                />
                <Text strong style={{ fontSize: '14px' }}>{user?.username || '管理员'}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '24px', minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
