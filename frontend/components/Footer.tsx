'use client'

import Link from 'next/link'
import { CodeOutlined, GithubOutlined } from '@ant-design/icons'
import { useConfig } from '@/contexts/ConfigContext'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  const { config } = useConfig()

  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-3 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* 品牌信息 */}
          <div>
            <Link
              href="/"
              className="flex items-center gap-2.5 mb-4 no-underline hover:opacity-80 transition-opacity"
            >
              {config?.site_basic?.site_logo ? (
                <img
                  src={config.site_basic.site_logo}
                  alt="Logo"
                  style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                />
              ) : (
                <CodeOutlined style={{ fontSize: '24px', color: '#1677ff' }} />
              )}
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {config?.site_basic?.site_title || process.env.NEXT_PUBLIC_SITE_TITLE || 'Tech Blog'}
              </span>
            </Link>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              {config?.site_basic?.site_description || process.env.NEXT_PUBLIC_SITE_DESCRIPTION || '分享编程经验、技术见解与开发心得的技术博客'}
            </p>
          </div>

          {/* 快速链接 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">快速链接</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/posts"
                  className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm no-underline"
                >
                  文章列表
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm no-underline"
                >
                  登录
                </Link>
              </li>
            </ul>
          </div>

          {/* 关于 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">关于</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
              一个专注于技术分享的博客平台
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                aria-label="GitHub"
              >
                <GithubOutlined style={{ fontSize: '20px' }} />
              </a>
            </div>
          </div>

          {/* 友情链接 */}
          {config?.friendly_links?.links && config.friendly_links.links.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">友情链接</h3>
              <ul className="space-y-2">
                {config.friendly_links.links.map((link, index) => (
                  <li key={index}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm no-underline"
                      title={link.description}
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6  border-gray-200 dark:border-gray-800 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {config?.site_basic?.site_copyright ? (
              config.site_basic.site_copyright.replace('{year}', currentYear.toString())
            ) : (
              `© ${currentYear} ${config?.site_basic?.site_title || process.env.NEXT_PUBLIC_SITE_TITLE || 'Tech Blog'}. All rights reserved.`
            )}
          </p>
        </div>
      </div>
    </footer>
  )
}
