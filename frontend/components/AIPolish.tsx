'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost } from '@/lib/api'
import MarkdownContent from '@/components/MarkdownContent'
import { Modal } from 'antd'

interface AIPolishProps {
  content: string
  onPolishComplete: (polishedContent: string) => void
}

interface LLMConfig {
  llm_api_key: string
  llm_base_url: string
  llm_model: string
}

interface AllConfigs {
  llm: LLMConfig
}

export default function AIPolish({ content, onPolishComplete }: AIPolishProps) {
  const router = useRouter()
  const [polishing, setPolishing] = useState(false)
  const [polishedText, setPolishedText] = useState('')
  const [showComparison, setShowComparison] = useState(false)
  const [originalContent, setOriginalContent] = useState('')
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null)
  const [checkingConfig, setCheckingConfig] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    checkLLMConfig()
  }, [])

  const checkLLMConfig = async () => {
    try {
      setCheckingConfig(true)
      const data = await apiGet<AllConfigs>('/api/v1/config/structured/all/admin')
      const hasApiKey = !!(data.llm?.llm_api_key && data.llm.llm_api_key.trim())
      setLlmConfigured(hasApiKey)
    } catch (error) {
      console.error('检查LLM配置失败:', error)
      setLlmConfigured(false)
    } finally {
      setCheckingConfig(false)
    }
  }

  const handlePolish = async () => {
    if (!content.trim()) {
      alert('请先输入内容')
      return
    }

    try {
      setPolishing(true)
      setPolishedText('')
      setOriginalContent(content) // 保存原始内容用于对比
      setShowComparison(false)
      setModalVisible(true) // 打开弹窗

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
              setShowComparison(true) // 显示对比界面，而不是直接覆盖
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
      setShowComparison(false)
      setModalVisible(false)
    }
  }

  const handleAccept = () => {
    onPolishComplete(polishedText)
    setPolishedText('')
    setShowComparison(false)
    setOriginalContent('')
    setModalVisible(false) // 关闭弹窗
  }

  const handleCancel = () => {
    setPolishedText('')
    setShowComparison(false)
    setOriginalContent('')
    setModalVisible(false) // 关闭弹窗
  }

  const handleModalClose = () => {
    if (!polishing) {
      // 只有在非润色中时才能关闭弹窗
      handleCancel()
    }
  }

  const handleGoToConfig = () => {
    router.push('/admin/config')
  }

  // 如果正在检查配置，显示加载状态
  if (checkingConfig) {
    return (
      <div className="space-y-2">
        <button
          disabled
          className="px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed opacity-50"
        >
          检查配置中...
        </button>
      </div>
    )
  }

  // 如果未配置LLM API，显示禁用按钮和提示
  if (llmConfigured === false) {
    return (
      <div className="space-y-2">
        <button
          disabled
          className="px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed opacity-50"
          title="LLM API未配置"
        >
          AI 润色（未配置）
        </button>
        <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
          <span className="text-amber-600">⚠️</span>
          <div className="flex-1">
            <p className="font-medium mb-1">LLM API 未配置</p>
            <p className="text-xs text-amber-700 mb-2">
              请前往配置管理页面配置 LLM API 后使用 AI 润色功能。
            </p>
            <button
              onClick={handleGoToConfig}
              className="text-xs text-amber-700 underline hover:text-amber-800 font-medium"
            >
              前往配置管理 →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={handlePolish}
        disabled={polishing || !content.trim()}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {polishing ? '润色中...' : 'AI 润色'}
      </button>

      <Modal
        title={polishing ? 'AI 润色中...' : '润色结果对比'}
        open={modalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={1200}
        closable={!polishing}
        maskClosable={!polishing}
        destroyOnClose={true}
      >
        {/* 润色中显示 */}
        {polishing && (
          <div className="w-full">
            <div className="prose max-w-none text-gray-600 h-[500px] overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
              {polishedText ? (
                <MarkdownContent content={polishedText} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <span>正在润色，请稍候...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 润色完成后的对比界面 */}
        {showComparison && polishedText && (
          <div className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* 原内容 */}
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="text-sm font-medium text-gray-600 mb-2 flex items-center">
                  <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                  原内容
                </div>
                <div className="prose max-w-none text-sm text-gray-700 h-[500px] overflow-y-auto">
                  <MarkdownContent content={originalContent || '（空）'} />
                </div>
              </div>

              {/* 润色后内容 */}
              <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50">
                <div className="text-sm font-medium text-indigo-600 mb-2 flex items-center">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                  润色后
                </div>
                <div className="prose max-w-none text-sm text-gray-800 h-[500px] overflow-y-auto">
                  <MarkdownContent content={polishedText} />
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 justify-end pt-3 border-t border-gray-200">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAccept}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                采用润色内容
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
