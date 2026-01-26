'use client'

import { usePathname } from 'next/navigation'
import UserLayout from './UserLayout'

interface LayoutWrapperProps {
  children: React.ReactNode
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname()
  
  // 如果是管理端路由，不包装 UserLayout（管理端有自己的 layout）
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/login') || pathname?.startsWith('/register') || pathname?.startsWith('/setup')) {
    return <>{children}</>
  }
  
  // 用户端路由使用 UserLayout
  return <UserLayout>{children}</UserLayout>
}
