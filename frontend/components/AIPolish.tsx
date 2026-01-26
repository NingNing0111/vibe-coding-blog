'use client'

import { useState } from 'react'
import { apiPost } from '@/lib/api'

interface AIPolishProps {
  content: string
  onPolishComplete: (polishedContent: string) => void
}

export default function AIPolish({ content, onPolishComplete }: AIPolishProps) {
  const [polishing, setPolishing] = useState(false)
  const [polishedText, setPolishedText] = useState('')

  const handlePolish = async () => {
    if (!content.trim()) {
      alert('请先输入内容')
      return
    }

    try {
      setPolishing(true)
      setPolishedText('')

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/ai/polish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({ content }),
        }
      )

      if (!response.ok) {
        throw new Error('润色失败')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应')
      }

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              setPolishing(false)
              onPolishComplete(polishedText)
              return
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                setPolishedText((prev) => prev + parsed.content)
              }
              if (parsed.error) {
                throw new Error(parsed.error)
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error: any) {
      alert(error.message || '润色失败')
      setPolishing(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handlePolish}
        disabled={polishing || !content.trim()}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {polishing ? '润色中...' : 'AI 润色'}
      </button>
      {polishing && polishedText && (
        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold mb-2">润色结果：</h3>
          <div className="prose max-w-none whitespace-pre-wrap">{polishedText}</div>
          <button
            onClick={() => {
              onPolishComplete(polishedText)
              setPolishedText('')
              setPolishing(false)
            }}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            使用此内容
          </button>
        </div>
      )}
    </div>
  )
}
