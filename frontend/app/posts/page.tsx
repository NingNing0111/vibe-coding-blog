'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import Link from 'next/link'
import { List, Empty, Tag, Typography, Avatar, Spin, Divider, Pagination } from 'antd'
import { CalendarOutlined, EyeOutlined, MessageOutlined, UserOutlined, TagOutlined } from '@ant-design/icons'

interface Post {
  id: number
  title: string
  slug: string
  excerpt: string | null
  cover_image: string | null
  view_count: number
  comment_count: number
  created_at: string
  published_at: string | null
  author: {
    id: number
    username: string
    avatar: string | null
  }
  category: {
    id: number
    name: string
    slug: string
  } | null
  tags: Array<{
    id: number
    name: string
    slug: string
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
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true)
        const data = await apiGet<PaginatedResponse<Post>>(`/api/v1/posts/published?page=${page}&size=${pageSize}`)
        setPosts(data.items || [])
        setTotal(data.total || 0)
      } catch (error) {
        console.error('Failed to fetch posts:', error)
        setPosts([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }
    fetchPosts()
  }, [page])

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12 text-center">
        <Typography.Title
          level={1}
          className="!text-gray-900 dark:!text-gray-100 !mb-4 !text-5xl !font-bold"
        >
          技术文章
        </Typography.Title>
        <Typography.Paragraph
          type="secondary"
          className="!text-lg !text-gray-600 dark:!text-gray-400 !m-0"
        >
          探索编程世界的精彩内容
        </Typography.Paragraph>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <Spin size="large" />
        </div>
      ) : posts.length === 0 ? (
        <Empty
          image={<TagOutlined className="text-6xl text-gray-300 dark:text-gray-600" />}
          description={<span className="text-gray-500 dark:text-gray-400">暂无文章</span>}
          className="py-20"
        />
      ) : (
        <div>
          <List
            itemLayout="vertical"
            dataSource={posts}
            split={false}
            renderItem={(post) => (
              <List.Item key={post.id} className="!p-0 !mb-8 last:!mb-0">
                <Link href={`/posts/${post.slug}`} className="block no-underline">
                  <div className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="min-w-0 flex-1 space-y-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {post.category && (
                            <Tag color="blue" className="!m-0 !rounded !px-2 !py-0.5">
                              {post.category.name}
                            </Tag>
                          )}
                          {post.tags.slice(0, 3).map((tag) => (
                            <Tag
                              key={tag.id}
                              className="!m-0 !text-[11px] !px-1.5 !py-0 !rounded !border-0 !bg-gray-100 dark:!bg-gray-700 dark:!text-gray-300"
                            >
                              #{tag.name}
                            </Tag>
                          ))}
                          {post.tags.length > 3 && (
                            <Tag className="!m-0 !text-[11px] !px-1.5 !py-0 !rounded !border-0 !bg-gray-100 dark:!bg-gray-700 dark:!text-gray-300">
                              +{post.tags.length - 3}
                            </Tag>
                          )}
                        </div>

                        <Typography.Title
                          level={4}
                          ellipsis={{ rows: 2 }}
                          className="!m-0 !text-xl !font-semibold !leading-snug !text-gray-900 dark:!text-gray-100"
                        >
                          {post.title}
                        </Typography.Title>

                        <Typography.Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          className="!m-0 !text-sm !leading-relaxed !text-gray-600 dark:!text-gray-400"
                        >
                          {post.excerpt && post.excerpt.trim() ? post.excerpt : '暂无描述'}
                        </Typography.Paragraph>

                        <Divider className="!my-3 dark:!border-gray-700" />

                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar
                              size="small"
                              src={post.author.avatar}
                              icon={<UserOutlined />}
                              className="!flex-shrink-0"
                            />
                            <Typography.Text
                              type="secondary"
                              className="!text-xs !truncate dark:!text-gray-400"
                              ellipsis
                            >
                              {post.author.username}
                            </Typography.Text>
                            {post.published_at && (
                              <div className="flex items-center gap-1.5">
                                <CalendarOutlined className="text-xs text-gray-500 dark:text-gray-400" />
                                <Typography.Text
                                  type="secondary"
                                  className="!text-xs whitespace-nowrap dark:!text-gray-400"
                                >
                                  {new Date(post.published_at).toLocaleDateString('zh-CN', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                  })}
                                </Typography.Text>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <EyeOutlined className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0" />
                              <Typography.Text
                                type="secondary"
                                className="!text-xs dark:!text-gray-400 whitespace-nowrap"
                              >
                                {post.view_count}
                              </Typography.Text>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MessageOutlined className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0" />
                              <Typography.Text
                                type="secondary"
                                className="!text-xs dark:!text-gray-400 whitespace-nowrap"
                              >
                                {post.comment_count}
                              </Typography.Text>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="w-full md:w-64 h-40 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                        {post.cover_image ? (
                          <img
                            src={post.cover_image}
                            alt={post.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 dark:text-gray-300">
                            暂无封面
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </List.Item>
            )}
          />

          <div className="flex justify-center">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger={false}
              onChange={(nextPage) => setPage(nextPage)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
