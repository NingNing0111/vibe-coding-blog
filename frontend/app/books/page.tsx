'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import Link from 'next/link'
import { Input, Select, Row, Col, Card, Pagination, Typography, Spin, Empty } from 'antd'
import { SearchOutlined, BookOutlined, UserOutlined, FolderOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

interface BookCategory {
  id: number
  name: string
  slug: string
  description?: string
}

interface Book {
  id: number
  title: string
  author: string | null
  cover_url: string | null
  file_url: string
  file_key: string
  file_size: number
  categories?: BookCategory[]
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<BookCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined)
  const pageSize = 12

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const list = await apiGet<BookCategory[]>('/api/v1/book-categories/list')
        setCategories(list || [])
      } catch (e) {
        console.error('获取书库分类失败:', e)
      }
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          page: page.toString(),
          size: pageSize.toString(),
        })
        if (searchKeyword) params.append('keyword', searchKeyword)
        if (categoryId != null) params.append('category_id', String(categoryId))
        const data = await apiGet<PaginatedResponse<Book>>(`/api/v1/books?${params.toString()}`)
        setBooks(data.items || [])
        setTotal(data.total || 0)
      } catch (e) {
        console.error('获取书籍列表失败:', e)
        setBooks([])
      } finally {
        setLoading(false)
      }
    }
    fetchBooks()
  }, [page, searchKeyword, categoryId])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Title level={2} className="!mb-6 flex items-center gap-2">
          <BookOutlined />
          书架
        </Title>

        <div className="flex flex-wrap gap-4 mb-6">
          <Input
            placeholder="按书名或作者检索"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={() => setSearchKeyword(keyword)}
            allowClear
            className="w-56"
          />
          <Select
            placeholder="全部分类"
            allowClear
            value={categoryId}
            onChange={(v) => { setCategoryId(v); setPage(1) }}
            options={[
              { value: undefined, label: '全部分类' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            className="w-40"
          />
          <button
            type="button"
            onClick={() => { setSearchKeyword(keyword); setPage(1) }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            搜索
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        ) : books.length === 0 ? (
          <Empty description="暂无书籍" className="py-12" />
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {books.map((book) => (
                <Col xs={24} sm={12} md={8} lg={6} key={book.id}>
                  <Link href={`/books/${book.id}/read`}>
                    <Card
                      hoverable
                      cover={
                        book.cover_url ? (
                          <div className="h-48 bg-slate-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                            <img
                              src={book.cover_url}
                              alt={book.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-48 bg-slate-200 dark:bg-gray-700 flex items-center justify-center">
                            <BookOutlined className="text-5xl text-slate-400" />
                          </div>
                        )
                      }
                      className="h-full"
                    >
                      <Card.Meta
                        title={<span className="line-clamp-2">{book.title}</span>}
                        description={
                          <div className="space-y-1">
                            {book.author && (
                              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                <UserOutlined className="text-xs" />
                                <Text type="secondary" className="text-sm">{book.author}</Text>
                              </div>
                            )}
                            {book.categories && book.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {book.categories.map((c) => (
                                  <span
                                    key={c.id}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-slate-100 dark:bg-gray-700"
                                  >
                                    <FolderOutlined /> {c.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        }
                      />
                    </Card>
                  </Link>
                </Col>
              ))}
            </Row>
            {total > pageSize && (
              <div className="flex justify-center mt-6">
                <Pagination
                  current={page}
                  total={total}
                  pageSize={pageSize}
                  onChange={setPage}
                  showSizeChanger={false}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
