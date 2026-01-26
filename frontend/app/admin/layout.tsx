'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { apiGet } from '@/lib/api'
import { removeTokenCookie, removeRefreshTokenCookie } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  FolderTree,
  Tag,
  MessageSquare,
  Settings,
  Home,
  LogOut,
  User,
  Image,
  ChevronRight,
} from 'lucide-react'

interface MenuItem {
  href: string
  label: string
  icon: React.ReactNode
}

const menuItems: MenuItem[] = [
  { href: '/admin', label: '仪表盘', icon: <LayoutDashboard className="w-5 h-5" /> },
  { href: '/admin/posts', label: '文章管理', icon: <FileText className="w-5 h-5" /> },
  { href: '/admin/categories', label: '分类管理', icon: <FolderTree className="w-5 h-5" /> },
  { href: '/admin/tags', label: '标签管理', icon: <Tag className="w-5 h-5" /> },
  { href: '/admin/comments', label: '评论管理', icon: <MessageSquare className="w-5 h-5" /> },
  { href: '/admin/media', label: '媒体资源', icon: <Image className="w-5 h-5" /> },
  { href: '/admin/config', label: '配置管理', icon: <Settings className="w-5 h-5" /> },
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
  const [user, setUser] = useState<any>(null)
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
  const breadcrumbs = useMemo(() => {
    if (!pathname) return []
    
    const paths = pathname.split('/').filter(Boolean)
    const crumbs: Array<{ label: string; href: string }> = []

    // 如果路径就是 /admin，只显示首页
    if (paths.length === 1 && paths[0] === 'admin') {
      return [{ label: '仪表盘', href: '' }]
    }

    let currentPath = '/admin'
    crumbs.push({ label: '仪表盘', href: '/admin' })

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
        crumbs.push({ label, href: '' })
      } else {
        // 如果下一个是数字ID，当前路径也不添加链接（因为数字ID会被跳过）
        const nextSegment = paths[i + 1]
        if (nextSegment && /^\d+$/.test(nextSegment)) {
          crumbs.push({ label, href: '' })
        } else {
          crumbs.push({ label, href: currentPath })
        }
      }
    }

    return crumbs
  }, [pathname])

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 左侧菜单栏 */}
      <aside className="w-64 bg-white shadow-lg fixed left-0 top-0 bottom-0 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">管理后台</h1>
        </div>
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className={isActive ? 'text-indigo-600' : 'text-gray-500'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* 右侧内容区域 */}
      <div className="flex-1 ml-64 flex flex-col">
        {/* 顶部头部栏 */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="px-6 py-4 flex justify-between items-center">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-700 hover:text-indigo-600 transition-colors"
            >
              <Home className="w-5 h-5" />
              <span>返回首页</span>
            </Link>
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-4 h-4" />
                  <span className="text-sm">{user.username}</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>退出</span>
              </button>
            </div>
          </div>
        </header>

        {/* 面包屑导航 */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center gap-2">
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-gray-600 hover:text-indigo-600 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-gray-900 font-medium">{crumb.label}</span>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* 主内容区域 */}
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  )
}
