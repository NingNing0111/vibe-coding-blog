'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiGet, apiPut } from '@/lib/api'
import { Spin, Button, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const ReactReader = dynamic(() => import('react-reader').then((m) => m.ReactReader), { ssr: false })

interface Book {
  id: number
  title: string
  author: string | null
  cover_url: string | null
  file_url: string
  file_key: string
  file_size: number
}

interface Progress {
  id: number
  user_id: number
  book_id: number
  current_position: string | null
  reading_duration_seconds: number
  updated_at: string
}

const { Title, Text } = Typography

const PROGRESS_SAVE_INTERVAL_MS = 5000
const DURATION_SAVE_INTERVAL_MS = 30000

export default function BookReadPage() {
  const params = useParams()
  const router = useRouter()
  const bookId = Number(params?.id)
  const [book, setBook] = useState<Book | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [location, setLocation] = useState<string | number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const readingStartRef = useRef<number>(Date.now())
  const durationAccRef = useRef(0)
  const lastSaveRef = useRef(0)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveProgress = useCallback(
    async (newLocation: string | number, extraDurationSeconds?: number) => {
      if (!bookId) return
      const elapsed = extraDurationSeconds ?? Math.floor((Date.now() - readingStartRef.current) / 1000)
      readingStartRef.current = Date.now()
      durationAccRef.current += elapsed
      const totalSeconds = (progress?.reading_duration_seconds ?? 0) + durationAccRef.current
      try {
        const res = await apiPut<Progress>(`/api/v1/books/${bookId}/progress`, {
          current_position: typeof newLocation === 'string' ? newLocation : undefined,
          reading_duration_seconds: totalSeconds,
        })
        setProgress(res)
        durationAccRef.current = 0
        lastSaveRef.current = Date.now()
      } catch (e) {
        console.error('保存阅读进度失败:', e)
      }
    },
    [bookId, progress]
  )

  useEffect(() => {
    if (!bookId || isNaN(bookId)) {
      setError('无效的书籍')
      setLoading(false)
      return
    }
    const load = async () => {
      try {
        const [bookData, progressData] = await Promise.all([
          apiGet<Book>(`/api/v1/books/${bookId}`),
          apiGet<Progress | null>(`/api/v1/books/${bookId}/progress`),
        ])
        setBook(bookData)
        setProgress(progressData ?? null)
        if (progressData?.current_position) {
          setLocation(progressData.current_position)
        }
      } catch (e) {
        console.error('加载书籍失败:', e)
        setError('加载失败')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [bookId])

  useEffect(() => {
    if (!bookId) return
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - readingStartRef.current) / 1000)
      saveProgress(location, elapsed)
    }, DURATION_SAVE_INTERVAL_MS)
    return () => clearInterval(t)
  }, [bookId, location, saveProgress])

  useEffect(() => {
    const onBeforeUnload = () => {
      const elapsed = Math.floor((Date.now() - readingStartRef.current) / 1000)
      durationAccRef.current += elapsed
      saveProgress(location, 0)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [location, saveProgress])

  const handleLocationChange = (epubcfi: string) => {
    setLocation(epubcfi)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveProgress(epubcfi)
    }, PROGRESS_SAVE_INTERVAL_MS)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900">
        <Spin size="large" />
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-gray-900 px-4">
        <Text type="danger">{error || '书籍不存在'}</Text>
        <Link href="/books">
          <Button type="primary" icon={<ArrowLeftOutlined />}>
            返回书架
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-gray-900">
      <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <Link href="/books">
          <Button type="text" icon={<ArrowLeftOutlined />}>
            返回书架
          </Button>
        </Link>
        <Title level={5} className="!mb-0 truncate flex-1">
          {book.title}
          {book.author && (
            <Text type="secondary" className="ml-2 font-normal">
              {book.author}
            </Text>
          )}
        </Title>
      </div>
      <div style={{ height: 'calc(100vh - 56px)' }} className="bg-white dark:bg-gray-800">
        <ReactReader
          url={book.file_url}
          title={book.title}
          location={location}
          locationChanged={handleLocationChange}
          showToc={true}
          getRendition={(r) => {
            r?.themes?.font?.('100%')
          }}
        />
      </div>
    </div>
  )
}
