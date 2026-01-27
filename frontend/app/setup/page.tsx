'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost } from '@/lib/api'
import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon } from 'lucide-react'
import { Card, Form, Input, Button, Collapse, Space, Select, InputNumber, message } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'

const { TextArea } = Input
const { Panel } = Collapse

// 标记为动态渲染，避免静态生成时的预渲染错误
export const dynamic = 'force-dynamic'

interface SiteBasicConfig {
  site_title: string
  site_subtitle: string
  site_description: string
  site_keywords: string
  site_logo: string
  site_copyright: string
}

interface BloggerSocial {
  type: string
  value: string
}

interface BloggerConfig {
  blogger_avatar: string
  blogger_signature: string
  blogger_socials: BloggerSocial[]
}

interface OSSConfig {
  oss_type: string
  oss_access_key_id: string
  oss_secret_access_key: string
  oss_region: string
  oss_bucket_name: string
  oss_endpoint: string
}

interface EmailConfig {
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  smtp_from_email: string
}

interface LLMConfig {
  llm_api_key: string
  llm_base_url: string
  llm_model: string
}

interface AllConfigs {
  site_basic: SiteBasicConfig
  blogger: BloggerConfig
  oss: OSSConfig
  email: EmailConfig
  llm: LLMConfig
}

const SOCIAL_TYPES = [
  { label: '邮箱', value: 'email' },
  { label: 'Github', value: 'github' },
  { label: 'Twitter', value: 'twitter' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Weibo', value: 'weibo' },
  { label: 'Zhihu', value: 'zhihu' },
  { label: 'Bilibili', value: 'bilibili' },
  { label: '其他', value: 'other' },
]

const OSS_TYPES = [
  { label: 'AWS S3', value: 's3' },
  { label: '阿里云OSS', value: 'aliyun' },
  { label: '七牛云', value: 'qiniu' },
  { label: '腾讯云COS', value: 'tencent' },
  { label: '其他', value: 'other' },
]

export default function SetupPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [mounted, setMounted] = useState(false)
  const themeContext = useTheme()
  const { theme, toggleTheme } = mounted ? themeContext : { theme: 'light' as const, toggleTheme: () => {} }
  const [initialized, setInitialized] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0) // 0: 管理员信息, 1: 配置信息
  const [step1Data, setStep1Data] = useState<{ email: string; username: string; password: string } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    checkInitialization()
  }, [])

  const checkInitialization = async () => {
    try {
      const response = await apiGet<{ initialized: boolean }>('/api/v1/init/check')
      setInitialized(response.initialized)
      if (response.initialized) {
        router.push('/')
      }
    } catch (error) {
      console.error('检查初始化状态失败:', error)
    }
  }

  const handleNext = async () => {
    try {
      // 验证第一步（管理员信息）并保存，供提交时使用（第二步时第一步表单项已卸载）
      const step1Values = await form.validateFields(['email', 'username', 'password'])
      setStep1Data({
        email: step1Values.email,
        username: step1Values.username,
        password: step1Values.password,
      })
      setCurrentStep(1)
    } catch (error) {
      console.error('验证失败:', error)
    }
  }

  const handleSubmit = async () => {
    try {
      setError('')
      setLoading(true)

      // 第二步时只校验配置项；管理员信息来自 step1Data
      const values = await form.validateFields()
      const admin = step1Data ?? {
        email: values.email,
        username: values.username,
        password: values.password,
      }

      const submitData = {
        email: admin.email,
        username: admin.username,
        password: admin.password,
        configs: {
          site_basic: {
            site_title: values.site_title ?? process.env.NEXT_PUBLIC_SITE_TITLE ?? '',
            site_subtitle: values.site_subtitle ?? process.env.NEXT_PUBLIC_SITE_SUBTITLE ?? '',
            site_description: values.site_description ?? process.env.NEXT_PUBLIC_SITE_DESCRIPTION ?? '',
            site_keywords: values.site_keywords ?? '',
            site_logo: values.site_logo ?? '',
            site_copyright: values.site_copyright ?? '',
          },
          blogger: {
            blogger_avatar: values.blogger_avatar ?? '',
            blogger_signature: values.blogger_signature ?? '',
            blogger_socials: values.blogger_socials ?? [],
          },
          oss: {
            oss_type: values.oss_type ?? '',
            oss_access_key_id: values.oss_access_key_id ?? '',
            oss_secret_access_key: values.oss_secret_access_key ?? '',
            oss_region: values.oss_region ?? '',
            oss_bucket_name: values.oss_bucket_name ?? '',
            oss_endpoint: values.oss_endpoint ?? '',
          },
          email: {
            smtp_host: values.smtp_host ?? '',
            smtp_port: values.smtp_port ?? 587,
            smtp_user: values.smtp_user ?? '',
            smtp_password: values.smtp_password ?? '',
            smtp_from_email: values.smtp_from_email ?? '',
          },
          llm: {
            llm_api_key: values.llm_api_key ?? '',
            llm_base_url: values.llm_base_url ?? 'https://api.openai.com/v1',
            llm_model: values.llm_model ?? 'gpt-3.5-turbo',
          },
          prompt: {
            polish_system_prompt: values.polish_system_prompt ?? '你是一个专业的文案编辑助手。',
          },
          friendly_links: {
            links: values.friendly_links ?? [],
          },
        },
      }

      await apiPost('/api/v1/init/setup', submitData)

      message.success('系统初始化成功！')
      router.push('/login')
    } catch (err: any) {
      setError(err.message || '初始化失败')
      message.error(err.message || '初始化失败')
    } finally {
      setLoading(false)
    }
  }

  if (initialized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p>检查系统状态...</p>
        </div>
      </div>
    )
  }

  if (initialized) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4">
      {/* 主题切换按钮 - 位于右上角 */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-all duration-200 z-50"
        aria-label="切换主题"
      >
        {theme === 'light' ? (
          <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        ) : (
          <Sun className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        )}
      </button>

      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            系统初始化
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {currentStep === 0 ? '步骤 1/2: 创建管理员账户' : '步骤 2/2: 配置系统信息'}
          </p>
        </div>

        <Form
          form={form}
          layout="vertical"
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
          initialValues={{
            site_title: process.env.NEXT_PUBLIC_SITE_TITLE || 'Tech Blog',
            site_subtitle: process.env.NEXT_PUBLIC_SITE_SUBTITLE || '分享编程经验、技术见解与开发心得',
            site_description: process.env.NEXT_PUBLIC_SITE_DESCRIPTION || '一个专注于技术分享的博客平台',
          }}
        >
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* 步骤1: 管理员信息 */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <Form.Item
                label="管理员邮箱"
                name="email"
                rules={[
                  { required: true, message: '请输入管理员邮箱地址' },
                  { type: 'email', message: '请输入有效的邮箱地址' },
                ]}
              >
                <Input
                  placeholder="请输入管理员邮箱地址"
                  className="dark:bg-gray-700 dark:text-gray-100"
                />
              </Form.Item>

              <Form.Item
                label="管理员用户名"
                name="username"
                rules={[{ required: true, message: '请输入管理员用户名' }]}
              >
                <Input
                  placeholder="请输入管理员用户名"
                  className="dark:bg-gray-700 dark:text-gray-100"
                />
              </Form.Item>

              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  placeholder="请输入密码"
                  className="dark:bg-gray-700 dark:text-gray-100"
                />
              </Form.Item>

              <div className="flex justify-end">
                <Button
                  type="primary"
                  onClick={handleNext}
                  size="large"
                >
                  下一步：配置系统信息
                </Button>
              </div>
            </div>
          )}

          {/* 步骤2: 配置信息 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <Collapse defaultActiveKey={['1']} ghost>
                {/* 网站基本配置 */}
                <Panel header="网站基本配置" key="1">
                  <div className="space-y-4">
                    <Form.Item
                      label="网站标题"
                      name="site_title"
                      rules={[{ required: true, message: '请输入网站标题' }]}
                    >
                      <Input placeholder="例如：我的技术博客" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="网站副标题"
                      name="site_subtitle"
                    >
                      <Input placeholder="例如：分享编程经验与技术见解" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="网站描述"
                      name="site_description"
                    >
                      <TextArea
                        rows={3}
                        placeholder="网站的描述信息，用于SEO"
                        className="dark:bg-gray-700 dark:text-gray-100"
                      />
                    </Form.Item>

                    <Form.Item
                      label="网站关键词"
                      name="site_keywords"
                    >
                      <Input placeholder="关键词1,关键词2,关键词3" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="站点 Logo URL"
                      name="site_logo"
                    >
                      <Input placeholder="https://example.com/logo.png" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="版权信息"
                      name="site_copyright"
                    >
                      <Input placeholder="例如：© 2024 我的博客. All rights reserved." className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>
                  </div>
                </Panel>

                {/* 个人博主配置 */}
                <Panel header="个人博主配置" key="2">
                  <div className="space-y-4">
                    <Form.Item
                      label="博主头像 URL"
                      name="blogger_avatar"
                    >
                      <Input placeholder="https://example.com/avatar.jpg" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="个性签名"
                      name="blogger_signature"
                    >
                      <TextArea
                        rows={3}
                        placeholder="一段简短的自我介绍"
                        className="dark:bg-gray-700 dark:text-gray-100"
                      />
                    </Form.Item>

                    <Form.Item label="社交联系方式">
                      <Form.List name="blogger_socials">
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map(({ key, name, ...restField }) => (
                              <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                <Form.Item
                                  {...restField}
                                  name={[name, 'type']}
                                  rules={[{ required: true, message: '请选择社交类型' }]}
                                  style={{ width: 150 }}
                                >
                                  <Select placeholder="选择类型" options={SOCIAL_TYPES} className="dark:bg-gray-700" />
                                </Form.Item>
                                <Form.Item
                                  {...restField}
                                  name={[name, 'value']}
                                  rules={[{ required: true, message: '请输入联系方式' }]}
                                  style={{ flex: 1 }}
                                >
                                  <Input placeholder="例如：your-email@example.com 或 https://github.com/username" className="dark:bg-gray-700 dark:text-gray-100" />
                                </Form.Item>
                                <Button
                                  type="text"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => remove(name)}
                                />
                              </Space>
                            ))}
                            <Form.Item>
                              <Button
                                type="dashed"
                                onClick={() => add()}
                                block
                                icon={<PlusOutlined />}
                                className="dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                              >
                                添加社交联系方式
                              </Button>
                            </Form.Item>
                          </>
                        )}
                      </Form.List>
                    </Form.Item>
                  </div>
                </Panel>

                {/* OSS服务配置 */}
                <Panel header="OSS服务配置（可选）" key="3">
                  <div className="space-y-4">
                    <Form.Item
                      label="OSS类型"
                      name="oss_type"
                    >
                      <Select placeholder="选择OSS服务类型" options={OSS_TYPES} className="dark:bg-gray-700" />
                    </Form.Item>

                    <Form.Item
                      label="Access Key ID"
                      name="oss_access_key_id"
                    >
                      <Input.Password placeholder="OSS访问密钥ID" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="Secret Access Key"
                      name="oss_secret_access_key"
                    >
                      <Input.Password placeholder="OSS访问密钥" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="区域"
                      name="oss_region"
                    >
                      <Input placeholder="例如：us-east-1 或 cn-hangzhou" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="Bucket名称"
                      name="oss_bucket_name"
                    >
                      <Input placeholder="OSS存储桶名称" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="Endpoint"
                      name="oss_endpoint"
                    >
                      <Input placeholder="OSS服务端点（可选）" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>
                  </div>
                </Panel>

                {/* 邮箱配置 */}
                <Panel header="邮箱配置（可选）" key="4">
                  <div className="space-y-4">
                    <Form.Item
                      label="SMTP服务器"
                      name="smtp_host"
                    >
                      <Input placeholder="例如：smtp.gmail.com" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="SMTP端口"
                      name="smtp_port"
                    >
                      <InputNumber
                        min={1}
                        max={65535}
                        placeholder="例如：587"
                        style={{ width: '100%' }}
                        className="dark:bg-gray-700 dark:text-gray-100"
                      />
                    </Form.Item>

                    <Form.Item
                      label="SMTP用户名"
                      name="smtp_user"
                    >
                      <Input placeholder="SMTP登录用户名" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="SMTP密码"
                      name="smtp_password"
                    >
                      <Input.Password placeholder="SMTP登录密码" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="发件人邮箱"
                      name="smtp_from_email"
                    >
                      <Input placeholder="例如：noreply@example.com" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>
                  </div>
                </Panel>

                {/* LLM API配置 */}
                <Panel header="LLM API配置（可选）" key="5">
                  <div className="space-y-4">
                    <Form.Item
                      label="API Key"
                      name="llm_api_key"
                    >
                      <Input.Password placeholder="OpenAI API Key 或兼容的API Key" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="Base URL"
                      name="llm_base_url"
                    >
                      <Input placeholder="例如：https://api.openai.com/v1" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>

                    <Form.Item
                      label="模型名称"
                      name="llm_model"
                    >
                      <Input placeholder="例如：gpt-3.5-turbo" className="dark:bg-gray-700 dark:text-gray-100" />
                    </Form.Item>
                  </div>
                </Panel>
              </Collapse>

              <div className="flex justify-between mt-6">
                <Button
                  onClick={() => setCurrentStep(0)}
                  size="large"
                  className="dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                >
                  上一步
                </Button>
                <Button
                  type="primary"
                  onClick={handleSubmit}
                  loading={loading}
                  size="large"
                >
                  {loading ? '初始化中...' : '完成初始化'}
                </Button>
              </div>
            </div>
          )}
        </Form>
      </div>
    </div>
  )
}
