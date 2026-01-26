import type { Metadata } from 'next'
import { Inter, Roboto, Open_Sans, Noto_Sans_SC } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import AntdProvider from '@/components/AntdProvider'
import LayoutWrapper from '@/components/LayoutWrapper'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const roboto = Roboto({ weight: ['300', '400', '500', '700'], subsets: ['latin'], variable: '--font-roboto' })
const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-open-sans' })
const notoSansSC = Noto_Sans_SC({ weight: ['300', '400', '500', '700'], subsets: ['latin'], variable: '--font-noto-sans-sc' })

export const metadata: Metadata = {
  title: 'Tech Blog - 技术博客',
  description: '分享编程经验、技术见解与开发心得的技术博客',
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
          <AntdProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
          </AntdProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
