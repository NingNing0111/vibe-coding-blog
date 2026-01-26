'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { apiGet, apiPut } from '@/lib/api'
import FileUpload from '@/components/FileUpload'
import AIPolish from '@/components/AIPolish'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface Category {
  id: number
  name: string
  slug: string
}

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

interface Post {
  id: number
  title: string
  slug: string
  content: string
  excerpt: string | null
  cover_image: string | null
  status: string
  category_id: number | null
  tags: Array<{ id: number }>
}

export default function EditPostPage() {
  const router = useRouter()
  const params = useParams()
  const postId = params.id as string

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [status, setStatus] = useState('DRAFT')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [tagIds, setTagIds] = useState<number[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    fetchPost()
    fetchCategories()
    fetchTags()
  }, [postId])

  const fetchPost = async () => {
    try {
      setFetching(true)
      // 直接通过 ID 获取文章
      const post = await apiGet<any>(`/api/v1/posts/id/${postId}`)
      loadPostData(post)
    } catch (error) {
      console.error('获取文章失败:', error)
      alert('获取文章失败')
      router.push('/admin/posts')
    } finally {
      setFetching(false)
    }
  }

  const loadPostData = (post: any) => {
    setTitle(post.title)
    setSlug(post.slug)
    setContent(post.content)
    setExcerpt(post.excerpt || '')
    setCoverImage(post.cover_image || '')
    setStatus(post.status)
    setCategoryId(post.category?.id || null)
    setTagIds(post.tags?.map((t: any) => t.id) || [])
  }

  const fetchCategories = async () => {
    try {
      const data = await apiGet<PaginatedResponse<Category>>('/api/v1/categories/?page=1&size=1000')
      setCategories(data.items || [])
    } catch (error) {
      console.error('获取分类失败:', error)
      setCategories([])
    }
  }

  const fetchTags = async () => {
    try {
      const data = await apiGet<PaginatedResponse<Tag>>('/api/v1/tags/?page=1&size=1000')
      setTags(data.items || [])
    } catch (error) {
      console.error('获取标签失败:', error)
      setTags([])
    }
  }

  const handleTagToggle = (tagId: number) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await apiPut(`/api/v1/posts/${postId}`, {
        title,
        slug,
        content,
        excerpt: excerpt || null,
        cover_image: coverImage || null,
        status,
        category_id: categoryId,
        tag_ids: tagIds,
      })

      router.push('/admin/posts')
    } catch (error: any) {
      alert(error.message || '更新文章失败')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">编辑文章</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            标题 *
          </label>
          <input
            type="text"
            required
            value={title}
            placeholder='请输入标题'
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Slug *
          </label>
          <input
            type="text"
            required
            value={slug}
            placeholder='请输入slug'
            onChange={(e) => setSlug(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            封面图
          </label>
          <FileUpload
            fileType="cover"
            onUploadComplete={(url) => setCoverImage(url)}
            label=""
          />
          {coverImage && (
            <div className="mt-2">
              <img src={coverImage} alt="封面预览" className="max-w-xs h-32 object-cover rounded" />
              <input
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="或直接输入图片 URL"
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            摘要
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              内容 *
            </label>
            <AIPolish content={content} onPolishComplete={(text) => setContent(text)} />
          </div>
          <div data-color-mode="light">
            <MDEditor
              height={520}
              value={content}
              onChange={(value) => setContent(value || '')}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分类
            </label>
            <select
              value={categoryId || ''}
              onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">无分类</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              状态
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="DRAFT">草稿</option>
              <option value="PUBLISHED">已发布</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            标签
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleTagToggle(tag.id)}
                className={`px-3 py-1 rounded-full text-sm ${tagIds.includes(tag.id)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  )
}
