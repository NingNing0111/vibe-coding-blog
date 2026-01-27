'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
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
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'

const { Title } = Typography
const { TextArea } = Input

interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  parent_id: number | null
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export default function CategoriesPage() {
  const pathname = usePathname()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const prevPathnameRef = useRef<string | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [page, pageSize])

  // 监听路由变化，当从其他页面返回时自动刷新
  useEffect(() => {
    const prevPathname = prevPathnameRef.current
    prevPathnameRef.current = pathname

    // 如果路径变化回到分类管理页面，刷新数据
    if (prevPathname && prevPathname !== pathname && pathname === '/admin/categories') {
      fetchCategories()
    }
  }, [pathname])

  const fetchCategories = async (forceRefresh = false) => {
    try {
      setLoading(true)
      // 添加时间戳参数以绕过缓存（如果需要强制刷新）
      const timestamp = forceRefresh ? `&_t=${Date.now()}` : ''
      const data = await apiGet<PaginatedResponse<Category>>(
        `/api/v1/categories/?page=${page}&size=${pageSize}${timestamp}`,
        false // 不使用请求去重，确保获取最新数据
      )
      setCategories(data.items)
      setTotal(data.total)
    } catch (error) {
      console.error('获取分类失败:', error)
      message.error('获取分类失败')
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

  const handleEdit = (category: Category) => {
    setEditingId(category.id)
    form.setFieldsValue({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      parent_id: category.parent_id,
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
      const submitData = {
        ...values,
        description: values.description || null,
        parent_id: values.parent_id || null,
      }

      if (editingId) {
        await apiPut(`/api/v1/categories/${editingId}`, submitData)
        message.success('更新成功')
      } else {
        await apiPost('/api/v1/categories/', submitData)
        message.success('创建成功')
      }
      handleCancel()
      // 强制刷新数据，绕过缓存
      setTimeout(() => {
        fetchCategories(true)
      }, 100) // 稍微延迟以确保后端缓存清除完成
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return
      }
      message.error(error.message || '操作失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/v1/categories/${id}`)
      message.success('删除成功')
      // 强制刷新数据，绕过缓存
      setTimeout(() => {
        fetchCategories(true)
      }, 100) // 稍微延迟以确保后端缓存清除完成
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }

  const getCategoryName = (id: number | null) => {
    if (!id) return '-'
    const category = categories.find((c) => c.id === id)
    return category?.name || '-'
  }

  const columns: ColumnsType<Category> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
    },
    {
      title: '父分类',
      dataIndex: 'parent_id',
      key: 'parent_id',
      render: (parentId: number | null) => getCategoryName(parentId),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string | null) => desc || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Category) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个分类吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
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
          分类管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建分类
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={categories}
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
        style={{
          background: '#fff',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
        }}
        size="middle"
      />

      <Modal
        title={editingId ? '编辑分类' : '新建分类'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changedValues) => {
            if (changedValues.name && !form.getFieldValue('slug')) {
              form.setFieldsValue({ slug: generateSlug(changedValues.name) })
            }
          }}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item
            label="Slug"
            name="slug"
            rules={[{ required: true, message: '请输入Slug' }]}
          >
            <Input placeholder="分类的URL友好标识" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={3} placeholder="分类描述（可选）" />
          </Form.Item>
          <Form.Item label="父分类" name="parent_id">
            <Select
              placeholder="选择父分类（可选）"
              allowClear
              disabled={!!editingId}
            >
              {categories
                .filter((c) => !editingId || c.id !== editingId)
                .map((cat) => (
                  <Select.Option key={cat.id} value={cat.id}>
                    {cat.name}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
