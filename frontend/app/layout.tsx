import type { Metadata } from 'next'
import { Inter, Roboto, Open_Sans, Noto_Sans_SC } from 'next/font/google'
import './globals.css'
import { getApiBaseUrl } from '@/lib/api'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ConfigProvider } from '@/contexts/ConfigContext'
import LayoutWrapper from '@/components/LayoutWrapper'
import InjectScripts from '@/components/InjectScripts'
import AntdProvider from '@/components/AntdProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const roboto = Roboto({ weight: ['300', '400', '500', '700'], subsets: ['latin'], variable: '--font-roboto' })
const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-open-sans' })
const notoSansSC = Noto_Sans_SC({ weight: ['300', '400', '500', '700'], subsets: ['latin'], variable: '--font-noto-sans-sc' })

export async function generateMetadata(): Promise<Metadata> {
  const defaultTitle = process.env.NEXT_PUBLIC_SITE_TITLE || 'Tech Blog - 技术博客'
  const defaultDesc = process.env.NEXT_PUBLIC_SITE_DESCRIPTION || '分享编程经验、技术见解与开发心得的技术博客'

  try {
    const base = getApiBaseUrl()
    const res = await fetch(`${base}/api/v1/config/structured/all`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(2000) // 2秒超时，防止阻塞
    })
    if (res.ok) {
      const data = await res.json()
      return {
        title: data?.site_basic?.site_title || defaultTitle,
        description: data?.site_basic?.site_description || defaultDesc,
      }
    }
  } catch (error) {
    // 忽略错误，使用默认值
  }

  return {
    title: defaultTitle,
    description: defaultDesc,
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} ${roboto.variable} ${openSans.variable} ${notoSansSC.variable}`}>
        <ThemeProvider>
          <ConfigProvider>
            <InjectScripts />
            <AntdProvider>
              <LayoutWrapper>{children}</LayoutWrapper>
            </AntdProvider>
          </ConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
