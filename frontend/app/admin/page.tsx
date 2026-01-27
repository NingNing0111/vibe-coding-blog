'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, Row, Col, Statistic, Typography, Space } from 'antd'
import {
  FileTextOutlined,
  FolderOutlined,
  TagOutlined,
  CommentOutlined,
  SettingOutlined,
  PictureOutlined,
} from '@ant-design/icons'
import { apiGet } from '@/lib/api'

const { Title } = Typography

interface Stats {
  total_posts: number
  total_comments: number
  total_views: number
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const data = await apiGet<Stats>('/api/v1/stats/')
      setStats(data)
    } catch (error) {
      console.error('获取统计信息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const menuCards = [
    {
      title: '文章管理',
      description: '管理博客文章',
      icon: <FileTextOutlined style={{ fontSize: 32, color: '#1890ff' }} />,
      href: '/admin/posts',
    },
    {
      title: '分类管理',
      description: '管理文章分类',
      icon: <FolderOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
      href: '/admin/categories',
    },
    {
      title: '标签管理',
      description: '管理文章标签',
      icon: <TagOutlined style={{ fontSize: 32, color: '#faad14' }} />,
      href: '/admin/tags',
    },
    {
      title: '评论管理',
      description: '管理用户评论',
      icon: <CommentOutlined style={{ fontSize: 32, color: '#722ed1' }} />,
      href: '/admin/comments',
    },
    {
      title: '媒体资源',
      description: '管理媒体文件',
      icon: <PictureOutlined style={{ fontSize: 32, color: '#eb2f96' }} />,
      href: '/admin/media',
    },
    {
      title: '配置管理',
      description: '管理系统配置',
      icon: <SettingOutlined style={{ fontSize: 32, color: '#13c2c2' }} />,
      href: '/admin/config',
    },
  ]

  return (
    <div>
      <Title level={2}>仪表盘</Title>
      
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="文章总数"
                value={stats.total_posts}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="评论总数"
                value={stats.total_comments}
                prefix={<CommentOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="总阅读量"
                value={stats.total_views}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        {menuCards.map((card) => (
          <Col xs={24} sm={12} lg={8} key={card.href}>
            <Link href={card.href} style={{ textDecoration: 'none' }}>
              <Card
                hoverable
                style={{ height: '100%' }}
                bodyStyle={{ textAlign: 'center', padding: '32px' }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {card.icon}
                  <div>
                    <Title level={4} style={{ margin: 0 }}>
                      {card.title}
                    </Title>
                    <p style={{ color: '#8c8c8c', margin: '8px 0 0 0' }}>
                      {card.description}
                    </p>
                  </div>
                </Space>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </div>
  )
}
