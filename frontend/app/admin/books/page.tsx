'use client'

import { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import {
  Table,
  Button,
  Space,
  Typography,
  Popconfirm,
  message,
  Modal,
  Form,
  Input,
  Select,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'

const { Title } = Typography

interface BookCategory {
  id: number
  name: string
  slug: string
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

const EPUB_MIME = 'application/epub+zip'

export default function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<BookCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [modalVisible, setModalVisible] = useState(false)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [form] = Form.useForm()
  const [uploadForm] = Form.useForm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchBooks()
  }, [page, pageSize])

  const fetchCategories = async () => {
    try {
      const list = await apiGet<BookCategory[]>('/api/v1/book-categories/list')
      setCategories(list || [])
    } catch (e) {
      console.error('获取书库分类失败:', e)
    }
  }

  const fetchBooks = async () => {
    try {
      setLoading(true)
      const data = await apiGet<PaginatedResponse<Book>>(
        `/api/v1/books/?page=${page}&size=${pageSize}`
      )
      setBooks(data.items || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error('获取书籍列表失败:', e)
      message.error('获取书籍列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    uploadForm.resetFields()
    setUploadModalVisible(true)
  }

  const handleEdit = (record: Book) => {
    setEditingId(record.id)
    form.setFieldsValue({
      title: record.title,
      author: record.author || '',
      cover_url: record.cover_url || '',
      category_ids: record.categories?.map((c) => c.id) || [],
    })
    setModalVisible(true)
  }

  const handleCancel = () => {
    setModalVisible(false)
    setUploadModalVisible(false)
    setEditingId(null)
    form.resetFields()
    uploadForm.resetFields()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUploadSubmit = async () => {
    const file = (fileInputRef.current?.files ?? [])[0]
    if (!file) {
      message.warning('请选择 epub 文件')
      return
    }
    if (!file.name.toLowerCase().endsWith('.epub')) {
      message.warning('仅支持 .epub 格式')
      return
    }
    try {
      const values = await uploadForm.validateFields()
      setUploading(true)

      const { presigned_url, file_url, file_key } = await apiPost<{
        presigned_url: string
        file_url: string
        file_key: string
      }>('/api/v1/upload/presigned-url', {
        file_name: file.name,
        file_size: file.size,
        file_type: 'book',
      })

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 204) resolve()
          else reject(new Error('上传失败'))
        })
        xhr.addEventListener('error', () => reject(new Error('上传失败')))
        xhr.open('PUT', presigned_url)
        xhr.setRequestHeader('Content-Type', EPUB_MIME)
        xhr.send(file)
      })

      await apiPost('/api/v1/books/', {
        title: values.title || file.name.replace(/\.epub$/i, ''),
        author: values.author || null,
        cover_url: values.cover_url || null,
        file_url,
        file_key,
        file_size: file.size,
        category_ids: values.category_ids || [],
      })
      message.success('书籍上传成功')
      handleCancel()
      fetchBooks()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleEditSubmit = async () => {
    if (!editingId) return
    try {
      const values = await form.validateFields()
      await apiPut(`/api/v1/books/${editingId}`, {
        title: values.title,
        author: values.author || null,
        cover_url: values.cover_url || null,
        category_ids: values.category_ids || [],
      })
      message.success('更新成功')
      handleCancel()
      fetchBooks()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.message || '更新失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/v1/books/${id}`)
      message.success('删除成功')
      fetchBooks()
    } catch (err: any) {
      message.error(err?.message || '删除失败')
    }
  }

  const columns: ColumnsType<Book> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: '封面',
      dataIndex: 'cover_url',
      width: 60,
      render: (url: string | null) =>
        url ? (
          <img src={url} alt="" className="w-10 h-14 object-cover rounded" />
        ) : (
          <span className="text-gray-400 text-xs">无</span>
        ),
    },
    { title: '书名', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '作者', dataIndex: 'author', key: 'author', width: 120 },
    {
      title: '分类',
      dataIndex: 'categories',
      key: 'categories',
      width: 180,
      render: (cats: BookCategory[] | undefined) =>
        cats?.length ? (
          <Space size={[0, 4]} wrap>
            {cats.map((c) => (
              <Tag key={c.id}>{c.name}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该书籍？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!mb-0">
          书库管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          上传书籍
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={books}
        loading={loading}
        pagination={{
          current: page,
          pageSize: pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
        }}
        onChange={(p) => {
          if (p.current) setPage(p.current)
          if (p.pageSize) setPageSize(p.pageSize)
        }}
      />

      <Modal
        title="上传书籍（仅支持 epub）"
        open={uploadModalVisible}
        onOk={handleUploadSubmit}
        onCancel={handleCancel}
        confirmLoading={uploading}
        destroyOnClose
      >
        <Form form={uploadForm} layout="vertical">
          <Form.Item
            label="Epub 文件"
            required
            help="仅支持 .epub 格式"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub,application/epub+zip"
              onChange={() => {}}
            />
          </Form.Item>
          <Form.Item
            name="title"
            label="书名"
            rules={[{ required: true, message: '请输入书名' }]}
          >
            <Input placeholder="书名" />
          </Form.Item>
          <Form.Item name="author" label="作者">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="cover_url" label="封面图 URL">
            <Input placeholder="可选，图片地址" />
          </Form.Item>
          <Form.Item name="category_ids" label="分类">
            <Select
              mode="multiple"
              placeholder="选择分类"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑书籍"
        open={modalVisible}
        onOk={handleEditSubmit}
        onCancel={handleCancel}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="书名" rules={[{ required: true, message: '请输入书名' }]}>
            <Input placeholder="书名" />
          </Form.Item>
          <Form.Item name="author" label="作者">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="cover_url" label="封面图 URL">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="category_ids" label="分类">
            <Select
              mode="multiple"
              placeholder="选择分类"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
