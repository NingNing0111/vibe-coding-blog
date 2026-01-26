'use client'

import { ConfigProvider } from 'antd'
import { useTheme } from '@/contexts/ThemeContext'
import zhCN from 'antd/locale/zh_CN'

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  const { antdThemeConfig } = useTheme()

  return (
    <ConfigProvider theme={antdThemeConfig} locale={zhCN}>
      {children}
    </ConfigProvider>
  )
}
