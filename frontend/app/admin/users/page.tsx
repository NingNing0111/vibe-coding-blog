'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPut, apiDelete } from '@/lib/api'
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
  Avatar,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, DeleteOutlined, UserOutlined, SearchOutlined } from '@ant-design/icons'

const { Title } = Typography

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface UserItem {
  id: number
  email: string
  username: string
  avatar: string | null
  role: string
  is_active: boolean
  is_subscribed: boolean
  created_at: string
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [form] = Form.useForm()
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)

  useEffect(() => {
    apiGet<{ id: number }>('/api/v1/auth/me', true).then((u) => setCurrentUserId(u.id)).catch(() => {})
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [page, pageSize, search])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        size: String(pageSize),
      })
      if (search.trim()) params.set('search', search.trim())
      const data = await apiGet<PaginatedResponse<UserItem>>(
        `/api/v1/users/?${params.toString()}`,
        false
      )
      setUsers(data.items)
      setTotal(data.total)
    } catch (error) {
      console.error('获取用户列表失败:', error)
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setSearch(searchInput.trim())
    setPage(1)
  }

  const handleEdit = (record: UserItem) => {
    setEditingUser(record)
    form.setFieldsValue({
      username: record.username,
      role: record.role,
      is_active: record.is_active,
      is_subscribed: record.is_subscribed,
    })
    setModalVisible(true)
  }

  const handleCancel = () => {
    setModalVisible(false)
    setEditingUser(null)
    form.resetFields()
  }

  const handleSubmit = async () => {
    if (!editingUser) return
    try {
      const values = await form.validateFields()
      await apiPut(`/api/v1/users/${editingUser.id}`, {
        username: values.username,
        role: values.role,
        is_active: values.is_active,
        is_subscribed: values.is_subscribed,
      })
      message.success('更新成功')
      handleCancel()
      fetchUsers()
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      message.error((error as Error)?.message || '更新失败')
    }
  }

  const handleDelete = async (record: UserItem) => {
    try {
      await apiDelete(`/api/v1/users/${record.id}`)
      message.success('删除成功')
      fetchUsers()
    } catch (error: unknown) {
      message.error((error as Error)?.message || '删除失败')
    }
  }

  const columns: ColumnsType<UserItem> = [
    {
      title: '用户',
      key: 'user',
      width: 220,
      render: (_: unknown, record: UserItem) => (
        <Space>
          <Avatar
            size="small"
            src={record.avatar}
            icon={<UserOutlined />}
            style={{ backgroundColor: record.is_active ? '#1890ff' : '#d9d9d9' }}
          />
          <div>
            <div style={{ fontWeight: 500 }}>{record.username}</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => (
        <Tag color={role === 'ADMIN' ? 'blue' : 'default'}>{role === 'ADMIN' ? '管理员' : '用户'}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      render: (is_active: boolean) => (
        <Tag color={is_active ? 'green' : 'red'}>{is_active ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '订阅',
      dataIndex: 'is_subscribed',
      key: 'is_subscribed',
      width: 80,
      render: (is_subscribed: boolean) => (
        <Tag color={is_subscribed ? 'blue' : 'default'}>{is_subscribed ? '已订阅' : '未订阅'}</Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (t: string) => formatDateTime(t),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_: unknown, record: UserItem) => {
        const isSelf = currentUserId !== null && record.id === currentUserId
        return (
          <Space>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
            {!isSelf && (
              <Popconfirm
                title="确定要删除该用户吗？删除后不可恢复。"
                onConfirm={() => handleDelete(record)}
                okText="确定"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          用户管理
        </Title>
        <Space>
          <Input
            placeholder="按邮箱或用户名搜索"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        scroll={{ x: 800 }}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps ?? 10)
          },
        }}
        style={{
          background: '#fff',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        }}
        size="middle"
      />

      <Modal
        title="编辑用户"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        okText="保存"
        cancelText="取消"
        width={420}
        destroyOnClose
      >
        {editingUser && (
          <div style={{ marginBottom: 16, color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
            邮箱：{editingUser.email}（不可修改）
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }, { whitespace: true, message: '用户名不能为纯空格' }]}
          >
            <Input placeholder="用户名" />
          </Form.Item>
          <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              placeholder="选择角色"
              options={[
                { value: 'USER', label: '用户' },
                { value: 'ADMIN', label: '管理员' },
              ]}
            />
          </Form.Item>
          <Form.Item label="状态" name="is_active" rules={[{ required: true }]}>
            <Select
              placeholder="选择状态"
              options={[
                { value: true, label: '启用' },
                { value: false, label: '禁用' },
              ]}
            />
          </Form.Item>
          <Form.Item label="订阅新文章邮件" name="is_subscribed" rules={[{ required: true }]}>
            <Select
              placeholder="是否订阅"
              options={[
                { value: true, label: '已订阅' },
                { value: false, label: '未订阅' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
