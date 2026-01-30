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
  FileOutlined,
  SearchOutlined,
  SnippetsOutlined,
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

  /** 上传单个文件（供选择文件与粘贴共用） */
  const uploadFile = async (file: File): Promise<void> => {
    try {
      const { presigned_url, file_url, file_key } = await apiPost<{
        presigned_url: string
        file_url: string
        file_key: string
      }>('/api/v1/upload/presigned-url', {
        file_name: file.name,
        file_size: file.size,
        file_type: 'media',
      })

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.addEventListener('load', async () => {
          if (xhr.status === 200 || xhr.status === 204) {
            try {
              await apiPost('/api/v1/upload/complete', {
                file_name: file.name,
                file_size: file.size,
                file_type: file.type || 'application/octet-stream',
                file_url,
                file_key,
              })
              fetchMediaList()
              resolve()
            } catch (error: any) {
              reject(new Error('保存文件信息失败: ' + (error.message || '未知错误')))
            }
          } else {
            reject(new Error('上传失败'))
          }
        })
        xhr.addEventListener('error', () => reject(new Error('上传失败')))
        xhr.open('PUT', presigned_url)
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.send(file)
      })
    } catch (error: any) {
      throw error
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      await uploadFile(file)
      message.success('上传成功')
    } catch (error: any) {
      message.error(error.message || '上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  /** 从剪贴板获取可上传的文件列表 */
  const getFilesFromClipboard = (clipboardData: DataTransfer): File[] => {
    const files: File[] = []
    if (clipboardData.files?.length) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const f = clipboardData.files[i]
        if (f && f.size > 0) files.push(f)
      }
    }
    if (files.length > 0) return files
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i]
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file && file.size > 0) files.push(file)
      }
    }
    return files
  }

  /** 粘贴上传：页面内 Ctrl+V 或 点击「粘贴上传」 */
  const handlePasteUpload = async (e: React.ClipboardEvent | { clipboardData: DataTransfer }) => {
    const clipboardData = 'clipboardData' in e ? e.clipboardData : e.clipboardData
    const files = getFilesFromClipboard(clipboardData)
    if (files.length === 0) return
    if ('preventDefault' in e) e.preventDefault()
    try {
      setUploading(true)
      await Promise.all(files.map((file) => uploadFile(file)))
      message.success(files.length > 1 ? `成功上传 ${files.length} 个文件` : '上传成功')
    } catch (error: any) {
      message.error(error.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  /** 点击「粘贴上传」时尝试从剪贴板读取并上传 */
  const triggerPasteUpload = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      const files: File[] = []
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/') || type === 'image/png') {
            const blob = await item.getType(type)
            const ext = type.split('/')[1] || 'png'
            files.push(new File([blob], `paste-${Date.now()}.${ext}`, { type }))
            break
          }
        }
      }
      if (files.length === 0) {
        message.info('剪贴板中没有可上传的图片，请先复制图片后再试')
        return
      }
      setUploading(true)
      await Promise.all(files.map((file) => uploadFile(file)))
      message.success(files.length > 1 ? `成功上传 ${files.length} 个文件` : '上传成功')
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        message.warning('请允许访问剪贴板，或在页面内按 Ctrl+V 粘贴上传')
      } else {
        message.error(err?.message || '粘贴上传失败')
      }
    } finally {
      setUploading(false)
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
      width: 220,
      ellipsis: { showTitle: true },
      render: (url: string) => (
        <span title={url} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {url}
        </span>
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
      width: 180,
      fixed: 'right',
      render: (_: any, record: Media) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(record.file_url)}
          >
            复制URL
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            href={record.file_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            下载
          </Button>
          <Popconfirm
            title={`确定要删除文件 "${record.file_name}" 吗？`}
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  /** 页面内 Ctrl+V 粘贴上传（监听 document） */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const data = e.clipboardData
      if (!data) return
      const files = getFilesFromClipboard(data)
      if (files.length === 0) return
      e.preventDefault()
      setUploading(true)
      Promise.all(files.map((file) => uploadFile(file)))
        .then(() => {
          message.success(files.length > 1 ? `成功上传 ${files.length} 个文件` : '上传成功')
        })
        .catch((err: any) => message.error(err?.message || '上传失败'))
        .finally(() => setUploading(false))
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          媒体资源管理
        </Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          <Button
            icon={<SnippetsOutlined />}
            loading={uploading}
            onClick={triggerPasteUpload}
          >
            粘贴上传
          </Button>
          <span style={{ color: '#8c8c8c', fontSize: 12 }}>
            支持 Ctrl+V 粘贴图片/文件
          </span>
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
