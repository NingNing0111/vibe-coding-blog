'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Layout, Form, Input, Button, Alert, Space, FloatButton, Dropdown, Typography } from 'antd'
import { SunOutlined, MoonOutlined, FontSizeOutlined } from '@ant-design/icons'
import { apiPost, apiGet } from '@/lib/api'
import { setTokenCookie, setRefreshTokenCookie, setUserRoleCookie } from '@/lib/utils'
import { useTheme, type FontFamily } from '@/contexts/ThemeContext'
import type { MenuProps } from 'antd'

const { Content } = Layout

export default function LoginPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const themeContext = useTheme()
  const { theme, fontFamily, toggleTheme, setFontFamily } = mounted ? themeContext : { 
    theme: 'light' as const, 
    fontFamily: 'inter' as FontFamily,
    toggleTheme: () => {},
    setFontFamily: () => {}
  }
  const [form] = Form.useForm()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    // 移除所有字体类
    root.classList.remove('font-inter', 'font-roboto', 'font-open-sans', 'font-noto-sans-sc', 'font-system')
    // 添加当前字体类
    root.classList.add(`font-${fontFamily}`)
  }, [fontFamily, mounted])

  const handleSubmit = async (values: { email: string; password: string }) => {
    setError('')
    setLoading(true)

    try {
      const response = await apiPost<{ access_token: string; refresh_token: string }>('/api/v1/auth/login', {
        email: values.email,
        password: values.password,
      })

      // 存储令牌到 localStorage 和 cookie
      localStorage.setItem('access_token', response.access_token)
      localStorage.setItem('refresh_token', response.refresh_token)
      setTokenCookie(response.access_token)
      setRefreshTokenCookie(response.refresh_token)

      // 拉取当前用户信息，按角色决定跳转并写入角色 cookie（仅管理员可进后台）
      const me = await apiGet<{ role: string }>('/api/v1/auth/me')
      setUserRoleCookie(me.role)
      if (me.role === 'ADMIN') {
        router.push('/admin')
      } else {
        router.push('/')
      }
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const fonts: { value: FontFamily; label: string }[] = [
    { value: 'inter', label: 'Inter' },
    { value: 'roboto', label: 'Roboto' },
    { value: 'open-sans', label: 'Open Sans' },
    { value: 'noto-sans-sc', label: '思源黑体' },
    { value: 'system', label: '系统字体' },
  ]

  const fontMenuItems: MenuProps['items'] = fonts.map((font) => ({
    key: font.value,
    label: font.label,
    onClick: () => setFontFamily(font.value),
  }))

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{ 
          maxWidth: '400px', 
          width: '100%',
          padding: '32px',
          background: 'var(--ant-color-bg-container)',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}>
          <Typography.Title level={2} style={{ textAlign: 'center', marginBottom: '32px' }}>
            登录
          </Typography.Title>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            size="large"
          >
            {error && (
              <Alert
                message={error}
                type="error"
                showIcon
                closable
                style={{ marginBottom: '24px' }}
                onClose={() => setError('')}
              />
            )}
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入您的邮箱地址' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input placeholder="请输入您的邮箱地址" />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入您的密码' }]}
            >
              <Input.Password placeholder="请输入您的密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                {loading ? '登录中...' : '登录'}
              </Button>
            </Form.Item>
            <div style={{ textAlign: 'center' }}>
              <Typography.Text type="secondary">还没有账号？</Typography.Text>
              <Link href="/register" style={{ marginLeft: '8px' }}>
                立即注册
              </Link>
            </div>
          </Form>
        </div>
      </Content>

      {/* 主题和字体切换按钮 */}
      <Space orientation="vertical" style={{ 
        position: 'fixed', 
        bottom: '24px', 
        right: '24px',
        zIndex: 1000,
      }}>
        <FloatButton
          icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
          onClick={toggleTheme}
          tooltip="切换主题"
        />
        <Dropdown menu={{ items: fontMenuItems }} placement="topRight">
          <FloatButton
            icon={<FontSizeOutlined />}
            tooltip="切换字体"
          />
        </Dropdown>
      </Space>
    </Layout>
  )
}
