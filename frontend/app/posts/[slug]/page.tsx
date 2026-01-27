import { apiGet } from '@/lib/api'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Calendar, Eye, MessageCircle, User, Tag, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import MarkdownContent from '@/components/MarkdownContent'

const CommentsSection = dynamic(() => import('@/components/CommentsSection'), { ssr: false })

interface Post {
  id: number
  title: string
  slug: string
  content: string
  excerpt: string | null
  cover_image: string | null
  view_count: number
  comment_count: number
  created_at: string
  published_at: string | null
  author: {
    id: number
    username: string
    avatar: string | null
  }
  categories: Array<{
    id: number
    name: string
    slug: string
  }>
  tags: Array<{
    id: number
    name: string
    slug: string
  }>
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  let post: Post | null = null
  try {
    post = await apiGet<Post>(`/api/v1/posts/${params.slug}`)
  } catch (error) {
    notFound()
  }

  if (!post) {
    notFound()
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          href="/posts"
          className="inline-flex items-center gap-2 text-slate-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">返回文章列表</span>
        </Link>

        <article className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-lg dark:shadow-xl">
          {post.cover_image && (
            <div className="relative h-96 w-full overflow-hidden bg-slate-100 dark:bg-gray-700">
              <img
                src={post.cover_image}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <div className="p-8 sm:p-10">
            {/* Categories */}
            {post.categories && post.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {post.categories.map((cat) => (
                  <span key={cat.id} className="inline-block px-4 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/50 dark:to-purple-900/50 text-indigo-700 dark:text-indigo-300 text-sm font-semibold rounded-full border border-indigo-100 dark:border-indigo-800">
                    {cat.name}
                  </span>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-gray-100 mb-6 leading-tight tracking-tight">
              {post.title}
            </h1>

            {/* Meta Information */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-slate-500 dark:text-gray-400 mb-8 pb-6 border-b border-slate-200 dark:border-gray-700">
              <div className="flex items-center gap-2.5">
                {post.author.avatar ? (
                  <img
                    src={post.author.avatar}
                    alt={post.author.username}
                    className="w-9 h-9 rounded-full ring-2 ring-slate-200 dark:ring-gray-700"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 flex items-center justify-center ring-2 ring-slate-200 dark:ring-gray-700">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
                <span className="font-semibold text-slate-900 dark:text-gray-100">{post.author.username}</span>
              </div>
              {post.published_at && (
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-gray-400">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(post.published_at).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-gray-400">
                <Eye className="h-4 w-4" />
                <span>{post.view_count} 次阅读</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-gray-400">
                <MessageCircle className="h-4 w-4" />
                <span>{post.comment_count} 条评论</span>
              </div>
            </div>

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="mb-8 flex gap-2 flex-wrap">
                {post.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors border border-slate-200 dark:border-gray-600"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="prose prose-indigo dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-relaxed prose-a:font-medium">
              <MarkdownContent content={post.content} />
            </div>
          </div>
        </article>

      {/* Comments Section */}
      <div className="mt-10">
        <CommentsSection postId={post.id} />
      </div>
    </main>
  )
}
