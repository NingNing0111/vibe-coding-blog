'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiDelete } from '@/lib/api'
import {
  Table,
  Button,
  Space,
  Typography,
  Popconfirm,
  message,
  Avatar,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, UserOutlined } from '@ant-design/icons'

const { Title } = Typography

interface Comment {
  id: number
  content: string
  post_id: number
  user: {
    id: number
    username: string
    avatar: string | null
  }
  created_at: string
  post?: {
    id: number
    title: string
    slug: string
  }
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchComments()
  }, [page, pageSize])

  const fetchComments = async () => {
    try {
      setLoading(true)
      const data = await apiGet<PaginatedResponse<Comment>>(`/api/v1/comments/?page=${page}&size=${pageSize}`, true)
      setComments(data.items)
      setTotal(data.total)
    } catch (error) {
      console.error('获取评论失败:', error)
      message.error('获取评论失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/v1/comments/${id}`)
      message.success('删除成功')
      fetchComments()
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }

  const columns: ColumnsType<Comment> = [
    {
      title: '评论内容',
      dataIndex: 'content',
      key: 'content',
      width: 400,
      render: (text: string) => (
        <div style={{ maxWidth: 400, wordBreak: 'break-word' }}>{text}</div>
      ),
    },
    {
      title: '用户',
      key: 'user',
      width: 150,
      render: (_: any, record: Comment) => (
        <Space>
          <Avatar
            src={record.user.avatar || undefined}
            icon={!record.user.avatar && <UserOutlined />}
          />
          <span>{record.user.username}</span>
        </Space>
      ),
    },
    {
      title: '文章',
      key: 'post',
      width: 200,
      render: (_: any, record: Comment) => (
        <div style={{ maxWidth: 200, wordBreak: 'break-word' }}>
          {record.post?.title || `文章 ID: ${record.post_id}`}
        </div>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Comment) => (
        <Popconfirm
          title="确定要删除这条评论吗？"
          onConfirm={() => handleDelete(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <Title level={2} style={{ marginBottom: 16 }}>
        评论管理
      </Title>

      <Table
        columns={columns}
        dataSource={comments}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => {
            setPage(page)
            setPageSize(pageSize)
          },
        }}
        scroll={{ x: 1000 }}
        style={{
          background: '#fff',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
        }}
        size="middle"
      />
    </div>
  )
}
