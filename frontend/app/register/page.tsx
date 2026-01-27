'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Layout, Form, Input, Button, Alert, Space, Typography, message } from 'antd'
import { apiPost } from '@/lib/api'

const { Content } = Layout

export default function RegisterPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const handleSendCode = async () => {
    try {
      setError('')
      const email = form.getFieldValue('email')
      if (!email) {
        message.error('请先输入邮箱地址')
        return
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/auth/send-verification-code?email=${encodeURIComponent(email)}`, {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        const detail = (data && (data.detail || data.message)) || '发送验证码失败'
        message.error(detail)
        throw new Error(detail)
      }

      setCodeSent(true)
      message.success(`验证码已发送`)

      // 开始倒计时
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err: any) {
      setError(err.message || '发送验证码失败')
    }
  }

  const handleSubmit = async (values: {
    email: string
    username: string
    password: string
    verification_code: string
  }) => {
    setError('')
    setLoading(true)

    try {
      await apiPost('/api/v1/auth/register', {
        email: values.email,
        username: values.username,
        password: values.password,
        verification_code: values.verification_code,
      })

      message.success('注册成功，请登录')
      router.push('/login')
    } catch (err: any) {
      setError(err.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

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
            注册
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
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入您的用户名' }]}
            >
              <Input placeholder="请输入您的用户名" />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入您的密码' }]}
            >
              <Input.Password placeholder="请输入您的密码" />
            </Form.Item>
            <Form.Item
              name="verification_code"
              label="验证码"
              rules={[{ required: true, message: '请输入验证码' }]}
            >
              <Space.Compact style={{ width: '100%' }}>
                <Input placeholder="请输入验证码" />
                <Button
                  onClick={handleSendCode}
                  disabled={countdown > 0}
                >
                  {countdown > 0 ? `${countdown}秒后重发` : '发送验证码'}
                </Button>
              </Space.Compact>
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                {loading ? '注册中...' : '注册'}
              </Button>
            </Form.Item>
            <div style={{ textAlign: 'center' }}>
              <Typography.Text type="secondary">已有账号？</Typography.Text>
              <Link href="/login" style={{ marginLeft: '8px' }}>
                立即登录
              </Link>
            </div>
          </Form>
        </div>
      </Content>
    </Layout>
  )
}
