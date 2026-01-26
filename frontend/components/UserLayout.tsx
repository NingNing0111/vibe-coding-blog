'use client'

import { Layout } from 'antd'
import Header from './Header'
import Footer from './Footer'

const { Content } = Layout

interface UserLayoutProps {
  children: React.ReactNode
}

export default function UserLayout({ children }: UserLayoutProps) {
  return (
    <Layout className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* 头部 */}
      <Header />

      {/* 内容区域 */}
      <Content className="flex-1">
        {children}
      </Content>

      {/* 页底 */}
      <Footer />
    </Layout>
  )
}
