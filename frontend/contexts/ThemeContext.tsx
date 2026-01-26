'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { theme as antdTheme, ThemeConfig } from 'antd'

type Theme = 'light' | 'dark'
export type FontFamily = 'inter' | 'roboto' | 'open-sans' | 'noto-sans-sc' | 'system'

interface ThemeContextType {
  theme: Theme
  fontFamily: FontFamily
  toggleTheme: () => void
  setFontFamily: (font: FontFamily) => void
  antdThemeConfig: ThemeConfig
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const fontFamilyMap: Record<FontFamily, string> = {
  'inter': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  'roboto': "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  'open-sans': "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  'noto-sans-sc': "'Noto Sans SC', 'Microsoft YaHei', 'SimHei', sans-serif",
  'system': "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [fontFamily, setFontFamilyState] = useState<FontFamily>('inter')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // 从 localStorage 读取保存的主题，如果没有则使用系统偏好
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme) {
      setTheme(savedTheme)
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefersDark ? 'dark' : 'light')
    }
    
    // 从 localStorage 读取保存的字体
    const savedFont = localStorage.getItem('fontFamily') as FontFamily | null
    if (savedFont && fontFamilyMap[savedFont]) {
      setFontFamilyState(savedFont)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme, mounted])

  useEffect(() => {
    if (!mounted) return
    
    const root = document.documentElement
    // 移除所有字体类
    root.classList.remove('font-inter', 'font-roboto', 'font-open-sans', 'font-noto-sans-sc', 'font-system')
    // 添加当前字体类
    root.classList.add(`font-${fontFamily}`)
    localStorage.setItem('fontFamily', fontFamily)
  }, [fontFamily, mounted])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const setFontFamily = (font: FontFamily) => {
    setFontFamilyState(font)
  }

  // Ant Design 主题配置
  const antdThemeConfig: ThemeConfig = {
    algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      fontFamily: fontFamilyMap[fontFamily],
      colorPrimary: '#1677ff',
      borderRadius: 6,
    },
    components: {
      Button: {
        borderRadius: 6,
      },
      Card: {
        borderRadius: 8,
      },
      Input: {
        borderRadius: 6,
      },
    },
  }

  // 始终提供 context，即使在服务端渲染时也提供默认值
  // 这样可以避免在预渲染时出现 "useTheme must be used within a ThemeProvider" 错误
  return (
    <ThemeContext.Provider value={{ theme, fontFamily, toggleTheme, setFontFamily, antdThemeConfig }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  // 在服务端渲染或构建时，如果 context 未定义，返回默认值
  // 这样可以避免预渲染错误
  if (context === undefined) {
    // 返回默认值而不是抛出错误，以支持服务端渲染
    return {
      theme: 'light' as Theme,
      fontFamily: 'inter' as FontFamily,
      toggleTheme: () => {
        // 空函数，避免在服务端调用时出错
        console.warn('toggleTheme called before ThemeProvider is mounted')
      },
      setFontFamily: () => {
        console.warn('setFontFamily called before ThemeProvider is mounted')
      },
      antdThemeConfig: {
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          fontFamily: fontFamilyMap['inter'],
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      } as ThemeConfig
    }
  }
  return context
}
