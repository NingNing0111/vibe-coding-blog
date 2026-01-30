'use client'

import { useCallback, useMemo } from 'react'
import { List } from 'lucide-react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import type { Root, Heading } from 'mdast'

export interface TocItem {
  id: string
  level: 2 | 3
  text: string
}

/** 从标题节点提取纯文本（遍历子节点中所有 text 节点，与渲染结果一致） */
function headingToText(node: Heading): string {
  const parts: string[] = []
  visit(node, (n) => {
    if (n.type === 'text' && 'value' in n) parts.push(String((n as { value: string }).value))
  })
  return parts.join('').trim()
}

/**
 * 使用与 ReactMarkdown 相同的 remark + remark-gfm 解析 Markdown，
 * 按文档顺序提取 h2/h3 标题，保证目录与正文一一对应。
 */
function parseHeadings(markdown: string): TocItem[] {
  const items: TocItem[] = []
  let index = 0
  let tree: Root
  try {
    tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root
  } catch {
    return []
  }
  visit(tree, 'heading', (node: Heading) => {
    if (node.depth !== 2 && node.depth !== 3) return
    const text = headingToText(node)
    if (!text) return
    items.push({
      id: `heading-${index++}`,
      level: node.depth as 2 | 3,
      text,
    })
  })
  return items
}

interface ArticleTOCProps {
  content: string
  className?: string
}

/** 顶栏高度（与 Header 的 64px 一致），用于滚动后标题落在顶栏下方 */
const HEADER_OFFSET = 64

export default function ArticleTOC({ content, className = '' }: ArticleTOCProps) {
  const items = useMemo(() => parseHeadings(content), [content])

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    // 让点击的标题紧贴顶栏下方：标题顶部 = 视口顶部 + 顶栏高度
    const rect = el.getBoundingClientRect()
    const targetScrollY = window.scrollY + rect.top - HEADER_OFFSET
    window.scrollTo({ top: Math.max(0, targetScrollY), behavior: 'smooth' })
  }, [])

  if (items.length === 0) {
    return null
  }

  return (
    <nav
      className={`rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-800/80 p-4 ${className}`}
      aria-label="文章目录"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-gray-300 mb-3">
        <List className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
        <span>目录</span>
      </div>
      <ul className="space-y-1.5 text-sm">
        {items.map((item) => (
          <li
            key={item.id}
            style={{ paddingLeft: item.level === 3 ? '1rem' : 0 }}
            className={item.level === 3 ? 'border-l-2 border-slate-200 dark:border-gray-600 ml-1 pl-2' : ''}
          >
            <button
              type="button"
              onClick={() => scrollTo(item.id)}
              className="text-left w-full text-slate-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate"
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
