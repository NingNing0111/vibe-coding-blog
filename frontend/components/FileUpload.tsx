'use client'

import { useState } from 'react'
import { apiPost } from '@/lib/api'

interface FileUploadProps {
  fileType: 'cover' | 'post' | 'avatar'
  onUploadComplete: (url: string) => void
  label?: string
}

export default function FileUpload({ fileType, onUploadComplete, label }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      setProgress(0)

      // 1. 获取预签名 URL
      const { presigned_url, file_url } = await apiPost<{
        presigned_url: string
        file_url: string
        file_key: string
      }>('/api/v1/upload/s3-presigned-url', {
        file_type: fileType,
        file_name: file.name,
      })

      // 2. 上传文件到 S3
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100
          setProgress(percentComplete)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          onUploadComplete(file_url)
          setUploading(false)
          setProgress(0)
        } else {
          throw new Error('上传失败')
        }
      })

      xhr.addEventListener('error', () => {
        throw new Error('上传失败')
      })

      xhr.open('PUT', presigned_url)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    } catch (error: any) {
      alert(error.message || '上传失败')
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <div className="flex items-center gap-4">
        <label className="cursor-pointer">
          <span className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 inline-block">
            {uploading ? '上传中...' : '选择文件'}
          </span>
          <input
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
            accept="image/*"
          />
        </label>
        {uploading && (
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
