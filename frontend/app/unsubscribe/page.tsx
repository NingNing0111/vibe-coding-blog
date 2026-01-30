'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, Button, Typography, Space, Alert, Spin } from 'antd'
import { apiGet, apiPost } from '@/lib/api'

const { Title, Paragraph, Text } = Typography

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(!!token)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<{ email: string; username: string } | null>(null)
  const [success, setSuccess] = useState(false)

  const fetchInfo = useCallback(async () => {
    if (!token) {
      setLoading(false)
      setError('缺少取消订阅链接参数，请使用邮件中的链接访问。')
      return
    }
    try {
      setLoading(true)
      setError('')
      const data = await apiGet<{ email: string; username: string }>(
        `/api/v1/auth/unsubscribe?token=${encodeURIComponent(token)}`
      )
      setInfo(data)
    } catch (e) {
      setError((e as Error).message || '链接无效或已过期，请使用邮件中的最新链接。')
      setInfo(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchInfo()
  }, [fetchInfo])

  const handleConfirm = async () => {
    if (!token) return
    setSubmitting(true)
    setError('')
    try {
      await apiPost<{ message: string }>('/api/v1/auth/unsubscribe', { token })
      setSuccess(true)
    } catch (e) {
      setError((e as Error).message || '取消失败，请重试或使用邮件中的最新链接。')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Spin size="large" tip="加载中…" />
      </div>
    )
  }

  if (success) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: '48px auto',
          padding: 24,
        }}
      >
        <Card>
          <Title level={3} style={{ marginTop: 0 }}>
            已取消订阅
          </Title>
          <Paragraph type="secondary">
            您已成功取消订阅，将不再收到新文章通知邮件。
          </Paragraph>
          <Link href="/">
            <Button type="primary">返回首页</Button>
          </Link>
        </Card>
      </div>
    )
  }

  if (error && !info) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: '48px auto',
          padding: 24,
        }}
      >
        <Card>
          <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
          <Link href="/">
            <Button>返回首页</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '48px auto',
        padding: 24,
      }}
    >
      <Card>
        <Title level={3} style={{ marginTop: 0 }}>
          确认取消订阅？
        </Title>
        {info && (
          <Paragraph>
            将不再向 <Text strong>{info.email}</Text>（{info.username}）发送新文章通知邮件。
          </Paragraph>
        )}
        {error && (
          <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
        )}
        <Space>
          <Button type="primary" danger onClick={handleConfirm} loading={submitting}>
            确认取消订阅
          </Button>
          <Link href="/">
            <Button disabled={submitting}>暂不取消</Button>
          </Link>
        </Space>
      </Card>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Spin size="large" tip="加载中…" />
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  )
}
