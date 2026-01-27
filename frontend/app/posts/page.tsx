'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import Link from 'next/link'
import { List, Empty, Tag, Typography, Avatar, Spin, Divider, Pagination, Input, Row, Col, Card } from 'antd'
import { CalendarOutlined, EyeOutlined, MessageOutlined, UserOutlined, TagOutlined, SearchOutlined, FolderOutlined } from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

interface Category {
  id: number
  name: string
  slug: string
}

interface TagType {
  id: number
  name: string
  slug: string
}

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
  categories: Array<{
    id: number
    name: string
    slug: string
  }>
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
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [selectedTag, setSelectedTag] = useState<number | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<TagType[]>([])
  const pageSize = 10

  // 获取分类和标签
  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        const [categoriesData, tagsData] = await Promise.all([
          apiGet<PaginatedResponse<Category>>('/api/v1/categories?size=100'),
          apiGet<PaginatedResponse<TagType>>('/api/v1/tags?size=100')
        ])
        setCategories(categoriesData.items || [])
        setTags(tagsData.items || [])
      } catch (error) {
        console.error('Failed to fetch sidebar data:', error)
      }
    }
    fetchSidebarData()
  }, [])

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true)
        let url = `/api/v1/posts/published?page=${page}&size=${pageSize}`
        if (search) url += `&search=${encodeURIComponent(search)}`
        if (selectedCategory) url += `&category_id=${selectedCategory}`
        if (selectedTag) url += `&tag_id=${selectedTag}`
        
        const data = await apiGet<PaginatedResponse<Post>>(url)
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
  }, [page, search, selectedCategory, selectedTag])

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleCategoryClick = (id: number | null) => {
    setSelectedCategory(id === selectedCategory ? null : id)
    setPage(1)
  }

  const handleTagClick = (id: number | null) => {
    setSelectedTag(id === selectedTag ? null : id)
    setPage(1)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12 text-center">
        <Title
          level={1}
          className="!text-gray-900 dark:!text-gray-100 !mb-4 !text-5xl !font-bold"
        >
          技术文章
        </Title>
        <Paragraph
          type="secondary"
          className="!text-lg !text-gray-600 dark:!text-gray-400 !m-0"
        >
          探索编程世界的精彩内容
        </Paragraph>
      </div>

      <Row gutter={32}>
        {/* 左侧文章列表 */}
        <Col xs={24} lg={17}>
          <div className="mb-8">
            <Input.Search
              placeholder="搜索文章标题或内容..."
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              onSearch={handleSearch}
              className="w-full"
            />
          </div>

          {(selectedCategory || selectedTag || search) && (
            <div className="mb-6 flex items-center gap-2 flex-wrap">
              <Text type="secondary">当前筛选：</Text>
              {search && (
                <Tag closable onClose={() => setSearch('')}>
                  搜索: {search}
                </Tag>
              )}
              {selectedCategory && (
                <Tag color="blue" closable onClose={() => setSelectedCategory(null)}>
                  分类: {categories.find(c => c.id === selectedCategory)?.name}
                </Tag>
              )}
              {selectedTag && (
                <Tag color="green" closable onClose={() => setSelectedTag(null)}>
                  标签: {tags.find(t => t.id === selectedTag)?.name}
                </Tag>
              )}
              <Link 
                href="#" 
                onClick={(e) => {
                  e.preventDefault()
                  setSearch('')
                  setSelectedCategory(null)
                  setSelectedTag(null)
                }}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                清除所有
              </Link>
            </div>
          )}

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
                              {post.categories && post.categories.map((cat) => (
                                <Tag key={cat.id} color="blue" className="!m-0 !rounded !px-2 !py-0.5">
                                  {cat.name}
                                </Tag>
                              ))}
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

                            <Title
                              level={4}
                              ellipsis={{ rows: 2 }}
                              className="!m-0 !text-xl !font-semibold !leading-snug !text-gray-900 dark:!text-gray-100"
                            >
                              {post.title}
                            </Title>

                            <Paragraph
                              type="secondary"
                              ellipsis={{ rows: 2 }}
                              className="!m-0 !text-sm !leading-relaxed !text-gray-600 dark:!text-gray-400"
                            >
                              {post.excerpt && post.excerpt.trim() ? post.excerpt : '暂无描述'}
                            </Paragraph>

                            <Divider className="!my-3 dark:!border-gray-700" />

                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar
                                  size="small"
                                  src={post.author.avatar}
                                  icon={<UserOutlined />}
                                  className="!flex-shrink-0"
                                />
                                <Text
                                  type="secondary"
                                  className="!text-xs !truncate dark:!text-gray-400"
                                  ellipsis
                                >
                                  {post.author.username}
                                </Text>
                                {post.published_at && (
                                  <div className="flex items-center gap-1.5">
                                    <CalendarOutlined className="text-xs text-gray-500 dark:text-gray-400" />
                                    <Text
                                      type="secondary"
                                      className="!text-xs whitespace-nowrap dark:!text-gray-400"
                                    >
                                      {new Date(post.published_at).toLocaleDateString('zh-CN', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit'
                                      })}
                                    </Text>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <EyeOutlined className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                  <Text
                                    type="secondary"
                                    className="!text-xs dark:!text-gray-400 whitespace-nowrap"
                                  >
                                    {post.view_count}
                                  </Text>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <MessageOutlined className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                  <Text
                                    type="secondary"
                                    className="!text-xs dark:!text-gray-400 whitespace-nowrap"
                                  >
                                    {post.comment_count}
                                  </Text>
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

              <div className="flex justify-center mt-8">
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
        </Col>

        {/* 右侧侧边栏 */}
        <Col xs={0} lg={7}>
          <div className="space-y-8 sticky top-24">
            <Card
              title={<span><FolderOutlined className="mr-2" />文章分类</span>}
              bordered={false}
              className="!rounded-2xl shadow-sm dark:bg-gray-900 dark:text-gray-100"
            >
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <Tag
                    key={category.id}
                    color={selectedCategory === category.id ? 'blue' : 'default'}
                    className={`cursor-pointer !px-3 !py-1 !rounded-full transition-all hover:scale-105 ${
                      selectedCategory === category.id 
                        ? '!border-blue-500' 
                        : 'dark:!bg-gray-800 dark:!text-gray-300 dark:!border-gray-700'
                    }`}
                    onClick={() => handleCategoryClick(category.id)}
                  >
                    {category.name}
                  </Tag>
                ))}
                {categories.length === 0 && <Text type="secondary">暂无分类</Text>}
              </div>
            </Card>

            <Card
              title={<span><TagOutlined className="mr-2" />热门标签</span>}
              bordered={false}
              className="!rounded-2xl shadow-sm dark:bg-gray-900 dark:text-gray-100"
            >
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <Tag
                    key={tag.id}
                    color={selectedTag === tag.id ? 'green' : 'default'}
                    className={`cursor-pointer !px-3 !py-1 !rounded-full transition-all hover:scale-105 ${
                      selectedTag === tag.id 
                        ? '!border-green-500' 
                        : 'dark:!bg-gray-800 dark:!text-gray-300 dark:!border-gray-700'
                    }`}
                    onClick={() => handleTagClick(tag.id)}
                  >
                    #{tag.name}
                  </Tag>
                ))}
                {tags.length === 0 && <Text type="secondary">暂无标签</Text>}
              </div>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  )
}
