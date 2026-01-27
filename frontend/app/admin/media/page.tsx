'use client'

import { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import {
  Table,
  Button,
  Space,
  Typography,
  Popconfirm,
  message,
  Input,
  Select,
  Image,
  Tag,
  Card,
  Row,
  Col,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  UploadOutlined,
  DeleteOutlined,
  CopyOutlined,
  DownloadOutlined,
  FileImageOutlined,
  FileOutlined,
  SearchOutlined,
} from '@ant-design/icons'

const { Title } = Typography
const { Search } = Input

interface Media {
  id: number
  file_name: string
  file_size: number
  file_type: string
  file_url: string
  file_key: string
  uploader_id: number | null
  created_at: string
  updated_at: string
}

interface PaginatedResponse {
  items: Media[]
  total: number
  page: number
  size: number
  pages: number
}

export default function MediaPage() {
  const [mediaList, setMediaList] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fetchingRef = useRef(false)

  useEffect(() => {
    fetchMediaList()
  }, [page, pageSize, searchKeyword, fileTypeFilter])

  const fetchMediaList = async () => {
    if (fetchingRef.current) {
      return
    }

    try {
      fetchingRef.current = true
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString(),
      })
      if (searchKeyword) {
        params.append('keyword', searchKeyword)
      }
      if (fileTypeFilter) {
        params.append('file_type', fileTypeFilter)
      }

      const data = await apiGet<PaginatedResponse>(`/api/v1/media/?${params.toString()}`)
      setMediaList(data.items)
      setTotal(data.total)
    } catch (error) {
      console.error('获取媒体资源列表失败:', error)
      message.error('获取媒体资源列表失败')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)

      // 1. 获取预签名 URL
      const { presigned_url, file_url, file_key } = await apiPost<{
        presigned_url: string
        file_url: string
        file_key: string
      }>('/api/v1/upload/presigned-url', {
        file_name: file.name,
        file_size: file.size,
        file_type: 'media',
      })

      // 2. 上传文件到 OSS
      const xhr = new XMLHttpRequest()

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200 || xhr.status === 204) {
          // 3. 上传完成后保存文件信息到数据库
          try {
            await apiPost('/api/v1/upload/complete', {
              file_name: file.name,
              file_size: file.size,
              file_type: file.type || 'application/octet-stream',
              file_url: file_url,
              file_key: file_key,
            })
            // 刷新列表
            fetchMediaList()
            message.success('上传成功')
          } catch (error: any) {
            console.error('保存文件信息失败:', error)
            message.error('文件已上传，但保存信息失败: ' + (error.message || '未知错误'))
          }
        } else {
          throw new Error('上传失败')
        }
        setUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      })

      xhr.addEventListener('error', () => {
        message.error('上传失败')
        setUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      })

      xhr.open('PUT', presigned_url)
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.send(file)
    } catch (error: any) {
      message.error(error.message || '上传失败')
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/v1/media/${id}`)
      message.success('删除成功')
      fetchMediaList()
    } catch (error) {
      console.error('删除失败:', error)
      message.error('删除失败')
    }
  }

  const handleSearch = (value: string) => {
    setSearchKeyword(value)
    setPage(1)
  }

  const handleClearSearch = () => {
    setKeyword('')
    setSearchKeyword('')
    setFileTypeFilter('')
    setPage(1)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileTypeTag = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Tag color="blue">图片</Tag>
    } else if (fileType.startsWith('video/')) {
      return <Tag color="purple">视频</Tag>
    } else if (fileType.startsWith('audio/')) {
      return <Tag color="green">音频</Tag>
    } else {
      return <Tag>文档</Tag>
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板')
    })
  }

  const columns: ColumnsType<Media> = [
    {
      title: '预览',
      dataIndex: 'file_url',
      key: 'preview',
      width: 100,
      render: (url: string, record: Media) =>
        record.file_type.startsWith('image/') ? (
          <Image
            src={url}
            alt={record.file_name}
            width={60}
            height={60}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            preview={false}
          />
        ) : (
          <FileOutlined style={{ fontSize: 32, color: '#8c8c8c' }} />
        ),
    },
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      width: 200,
    },
    {
      title: '文件类型',
      dataIndex: 'file_type',
      key: 'file_type',
      width: 150,
      render: (fileType: string) => getFileTypeTag(fileType),
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 120,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '文件URL',
      dataIndex: 'file_url',
      key: 'file_url',
      ellipsis: true,
      render: (url: string) => (
        <Space>
          <span style={{ maxWidth: 300, display: 'inline-block' }}>{url}</span>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(url)}
          >
            复制
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            href={url}
            target="_blank"
          >
            下载
          </Button>
        </Space>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_: any, record: Media) => (
        <Popconfirm
          title={`确定要删除文件 "${record.file_name}" 吗？`}
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
          媒体资源管理
        </Title>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? '上传中...' : '上传文件'}
          </Button>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col flex="auto">
            <Search
              placeholder="搜索文件名"
              allowClear
              enterButton={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="文件类型"
              allowClear
              value={fileTypeFilter}
              onChange={(value) => {
                setFileTypeFilter(value || '')
                setPage(1)
              }}
              style={{ width: '100%' }}
            >
              <Select.Option value="image">图片</Select.Option>
              <Select.Option value="video">视频</Select.Option>
              <Select.Option value="audio">音频</Select.Option>
              <Select.Option value="application">文档</Select.Option>
            </Select>
          </Col>
          {(searchKeyword || fileTypeFilter) && (
            <Col>
              <Button onClick={handleClearSearch}>清除筛选</Button>
            </Col>
          )}
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={mediaList}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个文件`,
          onChange: (page, pageSize) => {
            setPage(page)
            setPageSize(pageSize)
          },
        }}
        scroll={{ x: 1200 }}
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
