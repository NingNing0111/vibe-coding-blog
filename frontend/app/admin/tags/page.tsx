'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
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
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'

const { Title } = Typography

interface Tag {
  id: number
  name: string
  slug: string
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchTags()
  }, [page, pageSize])

  const fetchTags = async (forceRefresh = false) => {
    try {
      setLoading(true)
      // 添加时间戳参数以绕过缓存（如果需要强制刷新）
      const timestamp = forceRefresh ? `&_t=${Date.now()}` : ''
      const data = await apiGet<PaginatedResponse<Tag>>(
        `/api/v1/tags/?page=${page}&size=${pageSize}${timestamp}`,
        false // 不使用请求去重，确保获取最新数据
      )
      setTags(data.items)
      setTotal(data.total)
    } catch (error) {
      console.error('获取标签失败:', error)
      message.error('获取标签失败')
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
    form.resetFields()
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      await apiPost('/api/v1/tags/', values)
      message.success('创建成功')
      setModalVisible(false)
      form.resetFields()
      // 强制刷新数据，绕过缓存
      setTimeout(() => {
        fetchTags(true)
      }, 100) // 稍微延迟以确保后端缓存清除完成
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return
      }
      message.error(error.message || '创建标签失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/v1/tags/${id}`)
      message.success('删除成功')
      // 强制刷新数据，绕过缓存
      setTimeout(() => {
        fetchTags(true)
      }, 100) // 稍微延迟以确保后端缓存清除完成
    } catch (error: any) {
      message.error(error.message || '删除失败')
    }
  }

  const columns: ColumnsType<Tag> = [
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
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Tag) => (
        <Popconfirm
          title="确定要删除这个标签吗？"
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          标签管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建标签
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={tags}
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
        title="新建标签"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
        }}
        okText="保存"
        cancelText="取消"
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
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="请输入标签名称" />
          </Form.Item>
          <Form.Item
            label="Slug"
            name="slug"
            rules={[{ required: true, message: '请输入Slug' }]}
          >
            <Input placeholder="标签的URL友好标识" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
