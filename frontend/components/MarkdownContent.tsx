'use client'

import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import type { Root, Heading } from 'mdast'
import type { Plugin } from 'unified'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from '@/contexts/ThemeContext'
import { Copy, Check } from 'lucide-react'

interface MarkdownContentProps {
  content: string
}

/** 在解析阶段为 h2/h3 分配稳定 id，服务端与客户端一致，避免 hydration 不匹配 */
const remarkHeadingId: Plugin<[], Root> = () => (tree) => {
  let index = 0
  visit(tree, 'heading', (node: Heading) => {
    if (node.depth !== 2 && node.depth !== 3) return
    if (!node.data) node.data = {}
    ;(node.data as Record<string, unknown>).hProperties = {
      ...((node.data as Record<string, unknown>).hProperties as object),
      id: `heading-${index++}`,
    }
  })
}

function CodeBlock({ children, language, theme, codeStyle }: { children: string; language: string; theme: string; codeStyle: any }) {
  const [copied, setCopied] = useState(false)
  const codeContent = String(children).replace(/\n$/, '')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  return (
    <div className="my-4 w-full">
      {/* 操作栏 */}
      <div className="flex items-center justify-between mb-1 px-1">
        {/* 语言标签 */}
        <div className="text-xs text-slate-500 dark:text-gray-400 uppercase font-mono">
          {language}
        </div>
        {/* 复制按钮 */}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700 shadow-sm transition-all duration-200 hover:shadow-md"
          title={copied ? '已复制' : '复制代码'}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-slate-600 dark:text-gray-400" />
          )}
        </button>
      </div>
      {/* 代码块 */}
      <SyntaxHighlighter
        style={codeStyle}
        language={language}
        PreTag="div"
        className={`!rounded-lg !p-3 !my-0 !overflow-x-auto !w-full ${theme === 'dark' ? '!bg-gray-900' : '!bg-slate-50'}`}
        customStyle={{
          margin: 0,
          padding: '0.75rem',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          lineHeight: '1.6',
          background: theme === 'dark' ? '#111827' : '#f8fafc',
          border: 'none',
          color: theme === 'dark' ? '#f3f4f6' : '#0f172a',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflowWrap: 'break-word',
          wordBreak: 'break-all',
        }}
        codeTagProps={{
          style: {
            display: 'block',
            width: '100%',
            maxWidth: '100%',
            overflow: 'auto',
            wordBreak: 'break-all',
            whiteSpace: 'pre',
          }
        }}
      >
        {codeContent}
      </SyntaxHighlighter>
    </div>
  )
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  const { theme } = useTheme()
  const codeStyle = theme === 'dark' ? vscDarkPlus : oneLight
  const remarkPlugins = useMemo(() => [remarkGfm, remarkHeadingId], [])

  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      components={{
        h2({ node, children, ...props }) {
          // id 由 remarkHeadingId 写入 mdast，remark-rehype 转为 hast.properties
          const id = (node as { properties?: { id?: string } })?.properties?.id
          return (
            <h2 id={id} className="scroll-mt-16" {...props}>
              {children}
            </h2>
          )
        },
        h3({ node, children, ...props }) {
          const id = (node as { properties?: { id?: string } })?.properties?.id
          return (
            <h3 id={id} className="scroll-mt-16" {...props}>
              {children}
            </h3>
          )
        },
        code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode; [key: string]: any }) {
          const match = /language-(\w+)/.exec(className || '')
          const language = match ? match[1] : ''
          
          return !inline && match ? (
            <CodeBlock language={language} theme={theme} codeStyle={codeStyle}>
              {String(children)}
            </CodeBlock>
          ) : (
            <code 
              className="bg-slate-100 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md text-sm font-mono border border-slate-200 dark:border-gray-700 transition-colors duration-200" 
              {...props}
            >
              {children}
            </code>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
