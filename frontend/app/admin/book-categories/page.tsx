'use client'

import { useState, useEffect } from 'react'
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
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'

const { Title } = Typography
const { TextArea } = Input

interface BookCategory {
  id: number
  name: string
  slug: string
  description: string | null
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export default function BookCategoriesPage() {
  const [categories, setCategories] = useState<BookCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchCategories()
  }, [page, pageSize])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const data = await apiGet<PaginatedResponse<BookCategory>>(
        `/api/v1/book-categories/?page=${page}&size=${pageSize}`
      )
      setCategories(data.items || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('获取书库分类失败:', error)
      message.error('获取书库分类失败')
    } finally {
      setLoading(false)
    }
  }

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleAdd = () => {
    setEditingId(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record: BookCategory) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      slug: record.slug,
      description: record.description || '',
    })
    setModalVisible(true)
  }

  const handleCancel = () => {
    setModalVisible(false)
    setEditingId(null)
    form.resetFields()
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        name: values.name,
        slug: values.slug,
        description: values.description || null,
      }
      if (editingId) {
        await apiPut(`/api/v1/book-categories/${editingId}`, payload)
        message.success('更新成功')
      } else {
        await apiPost('/api/v1/book-categories/', payload)
        message.success('创建成功')
      }
      handleCancel()
      fetchCategories()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.message || '操作失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/v1/book-categories/${id}`)
      message.success('删除成功')
      fetchCategories()
    } catch (err: any) {
      message.error(err?.message || '删除失败')
    }
  }

  const columns: ColumnsType<BookCategory> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: 'Slug', dataIndex: 'slug', key: 'slug' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除该分类？"
            onConfirm={() => handleDelete(record.id)}
          >
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
          书库分类
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建分类
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={categories}
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
        title={editingId ? '编辑书库分类' : '新建书库分类'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input
              placeholder="分类名称"
              onChange={(e) => form.setFieldValue('slug', generateSlug(e.target.value))}
            />
          </Form.Item>
          <Form.Item
            name="slug"
            label="Slug"
            rules={[{ required: true, message: '请输入 slug' }]}
          >
            <Input placeholder="url-slug" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
