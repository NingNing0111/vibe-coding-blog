'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { apiGet, apiPut, apiPost } from '@/lib/api'
import { chunkedRequestMethod, onEpubProgress } from '@/lib/epubChunkedRequest'
import { Spin, Button, Typography, Modal, Input, message, Progress } from 'antd'
import { ArrowLeftOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useTheme } from '@/contexts/ThemeContext'

const ReactReader = dynamic(() => import('react-reader').then((m) => m.ReactReader), { ssr: false })

/** 划线注解（与后端一致） */
interface BookAnnotation {
  id: number
  book_id: number
  user_id: number
  username: string | null
  cfi_range: string
  selected_text: string
  note: string | null
  created_at: string
  updated_at: string
}

/** 阅读器主题：与站点主题一致 */
const READER_THEMES = {
  light: {
    body: {
      background: '#ffffff !important',
      color: '#171717 !important',
    },
  },
  dark: {
    body: {
      background: '#0f172a !important',
      color: '#e2e8f0 !important',
    },
  },
}

const FONT_SIZE_OPTIONS = [80, 100, 120, 140, 160, 180] as const
const READER_ZOOM_KEY = 'reader-font-size'

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
  const { theme } = useTheme()
  const bookId = Number(params?.id)
  const [book, setBook] = useState<Book | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [location, setLocation] = useState<string | number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fontSizePercent, setFontSizePercent] = useState(100)
  const [annotations, setAnnotations] = useState<BookAnnotation[]>([])
  const [annotationModal, setAnnotationModal] = useState<{ visible: boolean; cfiRange: string; selectedText: string; note: string }>({ visible: false, cfiRange: '', selectedText: '', note: '' })
  const [annotationSaving, setAnnotationSaving] = useState(false)
  const [markClickedInfo, setMarkClickedInfo] = useState<{ username: string; note: string | null; id: number } | null>(null)
  const [epubLoadPercent, setEpubLoadPercent] = useState<number | null>(null)
  const annotationsRef = useRef<BookAnnotation[]>([])
  useEffect(() => {
    annotationsRef.current = annotations
  }, [annotations])
  useEffect(() => {
    const saved = localStorage.getItem(READER_ZOOM_KEY)
    const n = saved ? parseInt(saved, 10) : 100
    const value = FONT_SIZE_OPTIONS.includes(n as (typeof FONT_SIZE_OPTIONS)[number]) ? n : 100
    setFontSizePercent(value)
  }, [])

  useEffect(() => {
    if (!book?.file_url) return
    setEpubLoadPercent(0)
    let hideTimeout: ReturnType<typeof setTimeout> | null = null
    const unsub = onEpubProgress((p) => {
      setEpubLoadPercent(p.percent)
      if (p.percent >= 100) {
        hideTimeout = setTimeout(() => setEpubLoadPercent(null), 400)
      }
    })
    return () => {
      unsub()
      if (hideTimeout) clearTimeout(hideTimeout)
      setEpubLoadPercent(null)
    }
  }, [book?.id])

  const renditionRef = useRef<{
    themes: { register: (t: Record<string, unknown>) => void; select: (n: string) => void; fontSize: (s: string) => void }
    annotations: { highlight: (cfi: string, data: Record<string, unknown>, cb: () => void, className?: string, styles?: Record<string, string>) => void }
    on: (ev: string, fn: (...args: unknown[]) => void) => void
    getContents: () => { range: (cfi: string) => { toString: () => string } }[]
  } | null>(null)
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
        const [bookData, progressData, annotationsData] = await Promise.all([
          apiGet<Book>(`/api/v1/books/${bookId}`),
          apiGet<Progress | null>(`/api/v1/books/${bookId}/progress`),
          apiGet<BookAnnotation[]>(`/api/v1/books/${bookId}/annotations`),
        ])
        setBook(bookData)
        setProgress(progressData ?? null)
        setAnnotations(Array.isArray(annotationsData) ? annotationsData : [])
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

  // 阅读器主题跟随页面主题
  useEffect(() => {
    const r = renditionRef.current
    if (!r?.themes) return
    const name = theme === 'dark' ? 'reader-dark' : 'reader-light'
    r.themes.select(name)
  }, [theme])

  // 字体缩放（沉浸式）
  useEffect(() => {
    const r = renditionRef.current
    if (!r?.themes) return
    r.themes.fontSize(`${fontSizePercent}%`)
  }, [fontSizePercent])

  const currentIndex = FONT_SIZE_OPTIONS.findIndex((o) => o >= fontSizePercent)
  const safeIndex = currentIndex >= 0 ? currentIndex : FONT_SIZE_OPTIONS.length - 1

  const zoomIn = () => {
    if (safeIndex < FONT_SIZE_OPTIONS.length - 1) {
      const next = FONT_SIZE_OPTIONS[safeIndex + 1]
      setFontSizePercent(next)
      localStorage.setItem(READER_ZOOM_KEY, String(next))
    }
  }
  const zoomOut = () => {
    if (safeIndex > 0) {
      const next = FONT_SIZE_OPTIONS[safeIndex - 1]
      setFontSizePercent(next)
      localStorage.setItem(READER_ZOOM_KEY, String(next))
    }
  }

  const applyAnnotationsToRendition = useCallback((r: typeof renditionRef.current, list: BookAnnotation[]) => {
    if (!r?.annotations) return
    list.forEach((a) => {
      try {
        r.annotations.highlight(
          a.cfi_range,
          { id: a.id, note: a.note ?? '', username: a.username ?? '' },
          () => {},
          'reader-annotation',
          { background: 'rgba(255,235,0,0.35)' }
        )
      } catch (_) {}
    })
  }, [])

  const handleAddAnnotation = useCallback(async () => {
    const { cfiRange, selectedText, note } = annotationModal
    if (!cfiRange || !selectedText.trim()) return
    setAnnotationSaving(true)
    try {
      const created = await apiPost<BookAnnotation>(`/api/v1/books/${bookId}/annotations`, {
        cfi_range: cfiRange,
        selected_text: selectedText.trim(),
        note: note.trim() || null,
      })
      setAnnotations((prev) => [...prev, created])
      renditionRef.current?.annotations?.highlight(
        created.cfi_range,
        { id: created.id, note: created.note ?? '', username: created.username ?? '' },
        () => {},
        'reader-annotation',
        { background: 'rgba(255,235,0,0.35)' }
      )
      message.success('划线已添加')
      setAnnotationModal({ visible: false, cfiRange: '', selectedText: '', note: '' })
    } catch (e) {
      message.error('添加失败')
    } finally {
      setAnnotationSaving(false)
    }
  }, [bookId, annotationModal])

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
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <Link href="/books">
          <Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回书架">
            返回书架
          </Button>
        </Link>
        <Title level={5} className="!mb-0 truncate flex-1 min-w-0">
          {book.title}
          {book.author && (
            <Text type="secondary" className="ml-2 font-normal hidden sm:inline">
              {book.author}
            </Text>
          )}
        </Title>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="text"
            icon={<ZoomOutOutlined />}
            onClick={zoomOut}
            disabled={safeIndex <= 0}
            aria-label="缩小"
          />
          <span className="text-sm text-slate-500 dark:text-gray-400 min-w-[2.5rem] text-center">
            {fontSizePercent}%
          </span>
          <Button
            type="text"
            icon={<ZoomInOutlined />}
            onClick={zoomIn}
            disabled={safeIndex >= FONT_SIZE_OPTIONS.length - 1}
            aria-label="放大"
          />
        </div>
      </div>
      <div style={{ height: 'calc(100vh - 56px)' }} className="bg-white dark:bg-gray-800 relative">
        {epubLoadPercent != null && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/90 dark:bg-gray-800/90">
            <Progress type="circle" percent={epubLoadPercent} size={64} strokeColor={{ '0%': '#3b82f6', '100%': '#2563eb' }} />
            <span className="text-sm text-slate-600 dark:text-gray-400">
              {epubLoadPercent >= 100 ? '正在解析…' : `加载中 ${epubLoadPercent}%`}
            </span>
          </div>
        )}
        <ReactReader
          url={book.file_url}
          title={book.title}
          location={location}
          locationChanged={handleLocationChange}
          showToc={true}
          epubInitOptions={{ requestMethod: chunkedRequestMethod }}
          readerStyles={
            // react-reader 类型要求完整 IReactReaderStyle，此处仅做部分覆盖
            (theme === 'dark'
              ? { reader: { background: '#0f172a' }, tocButton: { color: '#e2e8f0' } }
              : {}) as any
          }
          getRendition={(r) => {
            if (!r?.themes) return
            renditionRef.current = r as unknown as typeof renditionRef.current
            r.themes.register({ 'reader-light': READER_THEMES.light, 'reader-dark': READER_THEMES.dark })
            r.themes.select(theme === 'dark' ? 'reader-dark' : 'reader-light')
            r.themes.fontSize(`${fontSizePercent}%`)
            applyAnnotationsToRendition(renditionRef.current, annotationsRef.current)
            r.on('selected', (cfiRange: string, contents: { range: (cfi: string) => { toString: () => string } }) => {
              try {
                const range = contents?.range?.(cfiRange)
                const selectedText = range?.toString?.()?.trim?.()
                if (selectedText) {
                  setAnnotationModal({ visible: true, cfiRange, selectedText, note: '' })
                }
              } catch (_) {}
            })
            r.on('markClicked', (_cfi: string, data: { id?: number; username?: string; note?: string | null }) => {
              if (data?.username != null || data?.note != null) {
                setMarkClickedInfo({
                  id: data?.id ?? 0,
                  username: String(data?.username ?? '未知'),
                  note: data?.note ?? null,
                })
              }
            })
          }}
        />
        {markClickedInfo && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 max-w-[90%] sm:max-w-md rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg p-3">
            <div className="text-xs text-slate-500 dark:text-gray-400 mb-1">
              {markClickedInfo.username} 的划线
            </div>
            {markClickedInfo.note ? (
              <p className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{markClickedInfo.note}</p>
            ) : (
              <p className="text-sm text-slate-400 dark:text-gray-500 italic">无笔记</p>
            )}
            <Button type="text" size="small" className="mt-2" onClick={() => setMarkClickedInfo(null)}>
              关闭
            </Button>
          </div>
        )}
      </div>
      <Modal
        title="添加划线注解"
        open={annotationModal.visible}
        onOk={handleAddAnnotation}
        onCancel={() => setAnnotationModal({ visible: false, cfiRange: '', selectedText: '', note: '' })}
        confirmLoading={annotationSaving}
        okText="添加"
        cancelText="取消"
        destroyOnClose
      >
        <div className="mb-3 text-slate-600 dark:text-gray-400 text-sm">
          选中内容：
        </div>
        <div className="mb-4 p-3 rounded bg-slate-100 dark:bg-gray-700 text-slate-800 dark:text-gray-200 text-sm max-h-24 overflow-y-auto">
          {annotationModal.selectedText}
        </div>
        <div className="mb-1 text-slate-600 dark:text-gray-400 text-sm">
          笔记（可选）：
        </div>
        <Input.TextArea
          value={annotationModal.note}
          onChange={(e) => setAnnotationModal((prev) => ({ ...prev, note: e.target.value }))}
          placeholder="写下你的想法..."
          rows={3}
          maxLength={500}
          showCount
        />
      </Modal>
    </div>
  )
}
