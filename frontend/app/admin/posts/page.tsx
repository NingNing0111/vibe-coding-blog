'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiDelete } from '@/lib/api'
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Popconfirm,
  message,
  Image,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'

const { Title } = Typography

interface Post {
  id: number
  title: string
  slug: string
  excerpt: string | null
  cover_image: string | null
  status: string
  view_count: number
  comment_count: number
  created_at: string
  published_at: string | null
  author: {
    id: number
    username: string
  }
  categories: Array<{
    id: number
    name: string
  }>
  tags: Array<{
    id: number
    name: string
  }>
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export default function PostsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const fetchingRef = useRef(false)
  const prevPathnameRef = useRef<string | null>(null)

  useEffect(() => {
    fetchPosts()
  }, [page, pageSize])

  // 监听路由变化，当从新建/编辑页面返回时自动刷新
  useEffect(() => {
    const prevPathname = prevPathnameRef.current
    prevPathnameRef.current = pathname

    // 如果之前在新建或编辑页面，现在返回到列表页，则刷新数据
    if (
      prevPathname &&
      (prevPathname.startsWith('/admin/posts/new') ||
        prevPathname.match(/^\/admin\/posts\/\d+\/edit$/)) &&
      pathname === '/admin/posts'
    ) {
      fetchPosts()
    }
  }, [pathname])

  const fetchPosts = async () => {
    // 防止重复请求
    if (fetchingRef.current) {
      return
    }
    
    try {
      fetchingRef.current = true
      setLoading(true)
      // 不传status参数，让后端返回所有状态的文章（管理员）
      const data = await apiGet<PaginatedResponse<Post>>(`/api/v1/posts/?page=${page}&size=${pageSize}`, true)
      setPosts(data.items)
      setTotal(data.total)
    } catch (error) {
      console.error('获取文章列表失败:', error)
      message.error('获取文章列表失败')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/v1/posts/${id}`)
      message.success('删除成功')
      // 如果当前页没有数据了，回到上一页
      if (page > 1 && posts.length === 1) {
        setPage(page - 1)
      } else {
        fetchPosts()
      }
    } catch (error) {
      console.error('删除文章失败:', error)
      message.error('删除失败')
    }
  }

  const columns: ColumnsType<Post> = [
    {
      title: '封面',
      dataIndex: 'cover_image',
      key: 'cover_image',
      width: 150,
      align: 'left',
      render: (url: string | null) =>
        url ? (
          <Space>
            <Image
              src={url}
              alt="封面"
              width={40}
              height={40}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
            <Typography.Text 
              copyable 
              ellipsis={{ tooltip: url }} 
              style={{ fontSize: 12, color: '#666', width: 80 }}
            >
              {url}
            </Typography.Text>
          </Space>
        ) : (
          <span style={{ color: '#bfbfbf', fontSize: 12 }}>无封面</span>
        ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      align: 'left',
      render: (text: string, record: Post) => (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#262626', marginBottom: 4, lineHeight: '1.5' }}>
            {text}
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: '1.4' }}>{record.slug}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status: string) => (
        <Tag 
          color={status === 'PUBLISHED' ? 'success' : 'default'}
          style={{ 
            margin: 0,
            padding: '2px 8px',
            borderRadius: 4,
            fontWeight: 500
          }}
        >
          {status === 'PUBLISHED' ? '已发布' : '草稿'}
        </Tag>
      ),
    },
    {
      title: '分类',
      dataIndex: 'categories',
      key: 'categories',
      width: 150,
      align: 'center',
      render: (categories: Post['categories']) => 
        categories && categories.length > 0 ? (
          <Space size={[0, 4]} wrap>
            {categories.map((category) => (
              <Tag color="blue" key={category.id} style={{ margin: 0, borderRadius: 4 }}>
                {category.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <span style={{ color: '#bfbfbf', fontSize: 12 }}>-</span>
        ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 220,
      align: 'left',
      render: (tags: Post['tags']) => 
        tags && tags.length > 0 ? (
          <Space size={[0, 6]} wrap>
            {tags.map((tag) => (
              <Tag 
                key={tag.id}
                style={{ margin: 0, borderRadius: 4, fontSize: 12 }}
              >
                {tag.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <span style={{ color: '#bfbfbf', fontSize: 12 }}>-</span>
        ),
    },
    {
      title: '阅读/评论',
      key: 'stats',
      width: 130,
      align: 'left',
      render: (_: any, record: Post) => (
        <div style={{ fontSize: 13, lineHeight: '1.8' }}>
          <div style={{ color: '#595959' }}>
            <span style={{ color: '#8c8c8c' }}>阅读</span> {record.view_count}
          </div>
          <div style={{ color: '#595959' }}>
            <span style={{ color: '#8c8c8c' }}>评论</span> {record.comment_count}
          </div>
        </div>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      key: 'published_at',
      width: 140,
      align: 'left',
      render: (date: string | null) =>
        date ? (
          <span style={{ fontSize: 13, color: '#595959' }}>
            {new Date(date).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            })}
          </span>
        ) : (
          <span style={{ color: '#bfbfbf', fontSize: 12 }}>-</span>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      align: 'center',
      render: (_: any, record: Post) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => router.push(`/admin/posts/${record.id}/edit`)}
            style={{ 
              padding: '0 8px',
              height: 32,
              fontSize: 13,
              color: '#1890ff'
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这篇文章吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
              style={{ 
                padding: '0 8px',
                height: 32,
                fontSize: 13
              }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          文章管理
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/admin/posts/new')}
        >
          新建文章
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={posts}
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
          style: { marginTop: 16 }
        }}
        scroll={{ x: 1200 }}
        style={{
          background: '#fff',
          borderRadius: 8,
          overflow: 'hidden'
        }}
        size="middle"
        rowClassName={() => 'table-row'}
        components={{
          header: {
            cell: (props: any) => (
              <th
                {...props}
                style={{
                  ...props.style,
                  background: '#fafafa',
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#262626',
                  borderBottom: '2px solid #e8e8e8',
                  padding: '12px 16px',
                }}
              />
            ),
          },
        }}
      />
    </div>
  )
}
