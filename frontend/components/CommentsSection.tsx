'use client'

import { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { MessageCircle, Send, Clock, Reply } from 'lucide-react'

interface Comment {
  id: number
  content: string
  post_id: number
  user: {
    id: number
    username: string
    avatar: string | null
  }
  parent_id: number | null
  replies: Comment[]
  created_at: string
}

interface CommentsSectionProps {
  postId: number
}

export default function CommentsSection({ postId }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [content, setContent] = useState('')
  const [parentId, setParentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const fetchingRef = useRef(false)

  useEffect(() => {
    checkAuth()
    fetchComments()
  }, [postId])

  const checkAuth = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    setIsLoggedIn(!!token)
  }

  const fetchComments = async () => {
    // 防止重复请求
    if (fetchingRef.current) {
      return
    }
    
    try {
      fetchingRef.current = true
      setLoading(true)
      const data = await apiGet<Comment[]>(`/api/v1/comments/post/${postId}`, true)
      setComments(data)
    } catch (error) {
      console.error('获取评论失败:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoggedIn) {
      alert('请先登录')
      window.location.href = '/login'
      return
    }

    if (!content.trim()) {
      return
    }

    try {
      setSubmitting(true)
      await apiPost('/api/v1/comments/', {
        content: content.trim(),
        post_id: postId,
        parent_id: parentId,
      })
      setContent('')
      setParentId(null)
      fetchComments()
    } catch (error: any) {
      alert(error.message || '发表评论失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReply = (commentId: number) => {
    setParentId(commentId)
    const textarea = document.getElementById('comment-content') as HTMLTextAreaElement
    if (textarea) {
      textarea.focus()
    }
  }

  const cancelReply = () => {
    setParentId(null)
  }

  const renderComment = (comment: Comment, depth: number = 0) => {
    return (
      <div key={comment.id} className={depth > 0 ? 'ml-6 md:ml-8 mt-4 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : 'mt-6'}>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {comment.user.avatar ? (
                <img
                  src={comment.user.avatar}
                  alt={comment.user.username}
                  className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                  {comment.user.username[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{comment.user.username}</span>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(comment.created_at).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                </div>
              </div>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed mb-3">{comment.content}</div>
              {isLoggedIn && depth < 3 && (
                <button
                  onClick={() => handleReply(comment.id)}
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors"
                >
                  <Reply className="h-3 w-3" />
                  回复
                </button>
              )}
            </div>
          </div>
        </div>
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
      <div className="flex items-center gap-2 mb-8">
        <MessageCircle className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">评论</h2>
        <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-full">
          {comments.length}
        </span>
      </div>

      {isLoggedIn ? (
        <form onSubmit={handleSubmit} className="mb-8">
          {parentId && (
            <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-between">
              <span className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">正在回复评论...</span>
              <button
                type="button"
                onClick={cancelReply}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors"
              >
                取消
              </button>
            </div>
          )}
          <textarea
            id="comment-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写下你的想法..."
            rows={5}
            required
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
          />
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
            >
              <Send className="h-4 w-4" />
              {submitting ? '提交中...' : '发表评论'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 text-center">
          <MessageCircle className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-3" />
          <p className="text-gray-700 dark:text-gray-300 mb-4 font-medium">请登录后发表评论</p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
          >
            立即登录
          </a>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400 mb-3"></div>
          <p className="text-gray-500 dark:text-gray-400">加载评论中...</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">暂无评论</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">快来发表第一条评论吧！</p>
        </div>
      ) : (
        <div className="space-y-4">{comments.map((comment) => renderComment(comment))}</div>
      )}
    </div>
  )
}
