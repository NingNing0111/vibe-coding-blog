import Link from 'next/link'

export default function AdminPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">管理后台</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          href="/admin/posts"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">文章管理</h2>
          <p className="text-gray-600 mb-4">管理博客文章</p>
          <span className="text-blue-600 hover:underline">进入 →</span>
        </Link>
        <Link
          href="/admin/categories"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">分类管理</h2>
          <p className="text-gray-600 mb-4">管理文章分类</p>
          <span className="text-blue-600 hover:underline">进入 →</span>
        </Link>
        <Link
          href="/admin/tags"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">标签管理</h2>
          <p className="text-gray-600 mb-4">管理文章标签</p>
          <span className="text-blue-600 hover:underline">进入 →</span>
        </Link>
        <Link
          href="/admin/comments"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">评论管理</h2>
          <p className="text-gray-600 mb-4">管理用户评论</p>
          <span className="text-blue-600 hover:underline">进入 →</span>
        </Link>
        <Link
          href="/admin/config"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h2 className="text-xl font-semibold mb-2">配置管理</h2>
          <p className="text-gray-600 mb-4">管理系统配置</p>
          <span className="text-blue-600 hover:underline">进入 →</span>
        </Link>
      </div>
    </div>
  )
}
