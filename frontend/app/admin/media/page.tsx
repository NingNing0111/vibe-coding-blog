'use client'

import { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Upload, Trash2, Search, X, FileImage, File, Download } from 'lucide-react'

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
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fetchingRef = useRef(false)

  useEffect(() => {
    fetchMediaList()
  }, [page, searchKeyword, fileTypeFilter])

  const fetchMediaList = async () => {
    if (fetchingRef.current) {
      return
    }

    try {
      fetchingRef.current = true
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        size: '20',
      })
      if (searchKeyword) {
        params.append('keyword', searchKeyword)
      }
      if (fileTypeFilter) {
        params.append('file_type', fileTypeFilter)
      }

      const data = await apiGet<PaginatedResponse>(`/api/v1/media/?${params.toString()}`)
      setMediaList(data.items)
      setTotalPages(data.pages)
      setTotal(data.total)
    } catch (error) {
      console.error('获取媒体资源列表失败:', error)
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
            alert('上传成功')
          } catch (error: any) {
            console.error('保存文件信息失败:', error)
            alert('文件已上传，但保存信息失败: ' + (error.message || '未知错误'))
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
        alert('上传失败')
        setUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      })

      xhr.open('PUT', presigned_url)
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.send(file)
    } catch (error: any) {
      alert(error.message || '上传失败')
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (id: number, fileName: string) => {
    if (!confirm(`确定要删除文件 "${fileName}" 吗？`)) {
      return
    }

    try {
      await apiDelete(`/api/v1/media/${id}`)
      fetchMediaList()
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  const handleSearch = () => {
    setSearchKeyword(keyword)
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

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <FileImage className="w-5 h-5 text-blue-500" />
    }
    return <File className="w-5 h-5 text-gray-500" />
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板')
    })
  }

  if (loading && mediaList.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">媒体资源管理</h1>
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {uploading ? '上传中...' : '上传文件'}
          </button>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索文件名</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="输入文件名关键词..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                搜索
              </button>
              {(searchKeyword || fileTypeFilter) && (
                <button
                  onClick={handleClearSearch}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  清除
                </button>
              )}
            </div>
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">文件类型</label>
            <select
              value={fileTypeFilter}
              onChange={(e) => {
                setFileTypeFilter(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全部类型</option>
              <option value="image">图片</option>
              <option value="video">视频</option>
              <option value="audio">音频</option>
              <option value="application">文档</option>
            </select>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="mb-4 text-sm text-gray-600">
        共 {total} 个文件
      </div>

      {/* 文件列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  预览
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  文件名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  文件类型
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  文件大小
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  文件URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  上传时间
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mediaList.map((media) => (
                <tr key={media.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {media.file_type.startsWith('image/') ? (
                      <img
                        src={media.file_url}
                        alt={media.file_name}
                        className="w-16 h-16 object-cover rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      getFileIcon(media.file_type)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{media.file_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{media.file_type}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{formatFileSize(media.file_size)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 max-w-md">
                      <div className="text-sm text-gray-500 truncate flex-1">{media.file_url}</div>
                      <button
                        onClick={() => copyToClipboard(media.file_url)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs"
                        title="复制URL"
                      >
                        复制
                      </button>
                      <a
                        href={media.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800"
                        title="打开链接"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(media.created_at).toLocaleString('zh-CN')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDelete(media.id, media.file_name)}
                      className="text-red-600 hover:text-red-900 flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {mediaList.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            暂无媒体资源
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              第 {page} 页，共 {totalPages} 页
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
