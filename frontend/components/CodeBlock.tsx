'use client'

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from '@/contexts/ThemeContext'

interface CodeBlockProps {
  language?: string
  children: string
}

export default function CodeBlock({ language, children }: CodeBlockProps) {
  const { theme } = useTheme()
  const codeStyle = theme === 'dark' ? vscDarkPlus : oneLight
  
  return (
    <div className="relative my-6 w-full group">
      {/* 语言标签 */}
      {language && (
        <div className="absolute top-3 right-4 text-xs text-slate-500 dark:text-slate-400 uppercase font-mono z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-2.5 py-1 rounded-md border border-slate-200/50 dark:border-gray-700/50 shadow-sm">
          {language}
        </div>
      )}
      {/* 代码块容器 */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200/60 dark:border-gray-700/60 bg-slate-50 dark:bg-gray-900 shadow-lg dark:shadow-2xl">
        <SyntaxHighlighter
          language={language || 'text'}
          style={codeStyle}
          PreTag="div"
          className="!rounded-xl !p-5 !my-0 !overflow-x-auto !w-full !bg-transparent"
          customStyle={{
            margin: 0,
            padding: '1.25rem',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            lineHeight: '1.7',
            background: 'transparent',
            border: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
          codeTagProps={{
            style: {
              display: 'block',
              width: '100%',
              overflow: 'visible',
            }
          }}
          showLineNumbers
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
