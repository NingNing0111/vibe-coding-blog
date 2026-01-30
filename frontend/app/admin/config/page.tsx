'use client'

import { useState, useEffect, useRef } from 'react'
import { apiGet, apiPut } from '@/lib/api'
import { Card, Form, Input, Button, message, Space, Select, InputNumber, Switch, Typography } from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons'

const { TextArea } = Input
const { Title, Paragraph } = Typography

interface SiteBasicConfig {
  site_title: string
  site_subtitle: string
  site_description: string
  site_keywords: string
  site_logo: string
  site_copyright: string
  site_url: string
  site_head_script: string
  site_footer_script: string
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

interface PromptConfig {
  polish_system_prompt: string
}

interface FriendlyLink {
  name: string
  url: string
  description?: string
}

interface FriendlyLinksConfig {
  links: FriendlyLink[]
}

interface OpenSourceProjectConfig {
  project_name: string
  project_description: string
  github_url: string
  cover_image: string
}

interface HeaderMenuItem {
  icon: string
  name: string
  url: string
}

interface HeaderMenuConfig {
  items: HeaderMenuItem[]
}

interface BackupConfig {
  enabled: boolean
  interval_days: number
}

interface AllConfigs {
  site_basic: SiteBasicConfig
  blogger: BloggerConfig
  oss: OSSConfig
  backup: BackupConfig
  email: EmailConfig
  llm: LLMConfig
  prompt: PromptConfig
  friendly_links: FriendlyLinksConfig
  open_source_projects: OpenSourceProjectConfig[]
  header_menu: HeaderMenuConfig
}

interface ConfigSectionMeta {
  key: string
  label: string
  description: string
}

const CONFIG_SECTIONS: ConfigSectionMeta[] = [
  {
    key: 'site_basic',
    label: '网站基本配置',
    description: '站点标题、副标题、SEO 描述、关键词、脚本等全局基础信息。',
  },
  {
    key: 'blogger',
    label: '个人博主配置',
    description: '博主头像、个性签名以及邮箱 / 社交账号等联系方式展示。',
  },
  {
    key: 'oss',
    label: 'OSS 服务配置',
    description: '对象存储访问密钥、区域、Bucket 与 Endpoint 等，用于上传图片 / 备份文件。',
  },
  {
    key: 'backup',
    label: '数据备份配置',
    description: '开启定期数据库备份，并上传备份文件到配置好的 OSS 存储。',
  },
  {
    key: 'email',
    label: '邮箱配置',
    description: 'SMTP 服务器、端口、账号和发件邮箱，用于发送注册 / 通知等系统邮件。',
  },
  {
    key: 'llm',
    label: 'LLM API 配置',
    description: 'OpenAI 兼容的 LLM API Key、Base URL 和模型名称，用于文案润色等 AI 能力。',
  },
  {
    key: 'prompt',
    label: '提示词配置',
    description: 'AI 文案润色所使用的系统提示词，会影响润色风格与语气。',
  },
  {
    key: 'friendly_links',
    label: '友链配置',
    description: '管理博客首页展示的友情链接列表（名称、URL 与描述）。',
  },
  {
    key: 'open_source_projects',
    label: '开源项目配置',
    description: '配置首页展示的个人开源项目卡片，包括名称、描述、GitHub 链接和封面图。',
  },
  {
    key: 'header_menu',
    label: '头部菜单项配置',
    description: '自定义网站头部导航菜单的图标、名称与跳转地址（支持站内路径和外链）。',
  },
]

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

const HEADER_MENU_ICONS = [
  { label: '无图标', value: '' },
  { label: '首页', value: 'HomeOutlined' },
  { label: '文章', value: 'BookOutlined' },
  { label: '代码', value: 'CodeOutlined' },
  { label: 'Github', value: 'GithubOutlined' },
  { label: '链接', value: 'LinkOutlined' },
  { label: '用户', value: 'UserOutlined' },
  { label: '标签', value: 'TagOutlined' },
  { label: '文件夹', value: 'FolderOutlined' },
  { label: '星标', value: 'StarOutlined' },
  { label: '设置', value: 'SettingOutlined' },
  { label: '全局', value: 'GlobalOutlined' },
]

export default function ConfigPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeKey, setActiveKey] = useState<string>('site_basic')
  /** 上次从服务端拉取的完整配置，用于保存时补齐未渲染的 Tab 字段（Ant Design 只包含当前挂载的 Form.Item） */
  const lastFetchedConfigRef = useRef<AllConfigs | null>(null)

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      const data = await apiGet<AllConfigs>('/api/v1/config/structured/all/admin')
      // 设置表单值，确保所有字段都有默认值
      form.setFieldsValue({
        site_basic: {
          site_title: data.site_basic?.site_title || process.env.NEXT_PUBLIC_SITE_TITLE || '',
          site_subtitle: data.site_basic?.site_subtitle || process.env.NEXT_PUBLIC_SITE_SUBTITLE || '',
          site_description: data.site_basic?.site_description || process.env.NEXT_PUBLIC_SITE_DESCRIPTION || '',
          site_keywords: data.site_basic?.site_keywords || '',
          site_logo: data.site_basic?.site_logo || '',
          site_copyright: data.site_basic?.site_copyright || '',
          site_url: data.site_basic?.site_url || process.env.NEXT_PUBLIC_SITE_ORIGIN || '',
          site_head_script: data.site_basic?.site_head_script || '',
          site_footer_script: data.site_basic?.site_footer_script || '',
        },
        blogger: {
          blogger_avatar: data.blogger?.blogger_avatar || '',
          blogger_signature: data.blogger?.blogger_signature || '',
          blogger_socials: data.blogger?.blogger_socials || [],
        },
        oss: {
          oss_type: data.oss?.oss_type || '',
          oss_access_key_id: data.oss?.oss_access_key_id || '',
          oss_secret_access_key: data.oss?.oss_secret_access_key || '',
          oss_region: data.oss?.oss_region || '',
          oss_bucket_name: data.oss?.oss_bucket_name || '',
          oss_endpoint: data.oss?.oss_endpoint || '',
        },
        backup: {
          enabled: data.backup?.enabled ?? false,
          interval_days: data.backup?.interval_days ?? 7,
        },
        email: {
          smtp_host: data.email?.smtp_host || '',
          smtp_port: data.email?.smtp_port || 587,
          smtp_user: data.email?.smtp_user || '',
          smtp_password: data.email?.smtp_password || '',
          smtp_from_email: data.email?.smtp_from_email || '',
        },
        llm: {
          llm_api_key: data.llm?.llm_api_key || '',
          llm_base_url: data.llm?.llm_base_url || 'https://api.openai.com/v1',
          llm_model: data.llm?.llm_model || 'gpt-3.5-turbo',
        },
        prompt: {
          polish_system_prompt: data.prompt?.polish_system_prompt || '你是一个专业的文案编辑助手。',
        },
        friendly_links: {
          links: data.friendly_links?.links || [],
        },
        open_source_projects: data.open_source_projects || [],
        header_menu: {
          items: data.header_menu?.items || [],
        },
      })
      lastFetchedConfigRef.current = data
    } catch (error) {
      console.error('获取配置失败:', error)
      message.error('获取配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setSaving(true)
      // 先校验表单（仅校验当前已渲染/受控的字段）
      await form.validateFields()
      const full = lastFetchedConfigRef.current
      if (!full) {
        message.error('配置未加载完成，请刷新后重试')
        return
      }
      // 仅当前 Tab 的 Form.Item 会被 getFieldsValue 收集，需与上次拉取的完整配置合并后提交
      const values = form.getFieldsValue(true)
      const payload: AllConfigs = { ...full, ...values }
      await apiPut('/api/v1/config/structured/all', payload)
      message.success('配置保存成功！页面刷新后将生效')
      // 延迟刷新页面，让用户看到成功消息
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        message.error('请检查表单填写是否正确')
      } else {
        message.error(error.message || '保存失败')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">系统配置</h1>
          <p className="text-gray-500 mt-1 text-sm">
            左侧选择配置分类，右侧编辑详细配置项。保存后部分配置需要刷新页面或重启服务生效。
          </p>
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          size="large"
          onClick={handleSubmit}
          loading={saving}
        >
          保存所有配置
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* 左侧配置项列表 */}
        <div className="md:col-span-1">
          <Card size="small" title="配置分类" bodyStyle={{ padding: 0 }}>
            <ul className="divide-y divide-gray-100">
              {CONFIG_SECTIONS.map((section) => (
                <li key={section.key}>
                  <button
                    type="button"
                    onClick={() => setActiveKey(section.key)}
                    className={`w-full text-left px-4 py-3 focus:outline-none ${
                      activeKey === section.key
                        ? 'bg-blue-50 border-l-4 border-l-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">{section.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{section.description}</div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* 右侧配置内容 */}
        <div className="md:col-span-3">
          <Form form={form} layout="vertical" className="space-y-6">
            {/* 网站基本配置 */}
            {activeKey === 'site_basic' && (
              <Card>
                <Title level={4}>网站基本配置</Title>
                <Paragraph type="secondary" className="mb-4">
                  配置站点标题、副标题、SEO 描述与关键词，以及需要注入到页面的自定义脚本。
                </Paragraph>
              <Form.Item
                label="网站标题"
                name={['site_basic', 'site_title']}
                rules={[{ required: true, message: '请输入网站标题' }]}
              >
                <Input placeholder="例如：我的技术博客" />
              </Form.Item>

              <Form.Item
                label="网站副标题"
                name={['site_basic', 'site_subtitle']}
              >
                <Input placeholder="例如：分享编程经验与技术见解" />
              </Form.Item>

              <Form.Item
                label="网站描述"
                name={['site_basic', 'site_description']}
              >
                <TextArea
                  rows={3}
                  placeholder="网站的描述信息，用于SEO"
                />
              </Form.Item>

              <Form.Item
                label="网站关键词"
                name={['site_basic', 'site_keywords']}
              >
                <Input placeholder="关键词1,关键词2,关键词3" />
              </Form.Item>

              <Form.Item
                label="站点 Logo URL"
                name={['site_basic', 'site_logo']}
              >
                <Input placeholder="https://example.com/logo.png" />
              </Form.Item>

              <Form.Item
                label="版权信息"
                name={['site_basic', 'site_copyright']}
              >
                <Input placeholder="例如：© 2024 我的博客. All rights reserved." />
              </Form.Item>

              <Form.Item
                label="站点地址"
                name={['site_basic', 'site_url']}
                tooltip="用于新文章发布通知邮件中的文章链接，如 https://你的域名.com"
              >
                <Input placeholder="https://你的域名.com" />
              </Form.Item>

              <Form.Item
                label="头部脚本"
                name={['site_basic', 'site_head_script']}
                tooltip="注入到页面的 <head> 中，可填写 <script>、<link> 等 HTML 或第三方统计代码"
              >
                <TextArea rows={4} placeholder="例如：<script>...</script> 或 Google Analytics 等统计代码" />
              </Form.Item>

              <Form.Item
                label="底部脚本"
                name={['site_basic', 'site_footer_script']}
                tooltip="注入到页面底部（</body> 前），适合统计、客服等脚本"
              >
                <TextArea rows={4} placeholder="例如：<script>...</script> 或百度统计等代码" />
              </Form.Item>
              </Card>
            )}

            {/* 个人博主配置 */}
            {activeKey === 'blogger' && (
              <Card>
                <Title level={4}>个人博主配置</Title>
                <Paragraph type="secondary" className="mb-4">
                  配置博客作者的头像、个性签名和多种社交方式，展示在站点显眼位置。
                </Paragraph>
              <Form.Item
                label="博主头像 URL"
                name={['blogger', 'blogger_avatar']}
              >
                <Input placeholder="https://example.com/avatar.jpg" />
              </Form.Item>

              <Form.Item
                label="个性签名"
                name={['blogger', 'blogger_signature']}
              >
                <TextArea
                  rows={3}
                  placeholder="一段简短的自我介绍"
                />
              </Form.Item>

              <Form.Item label="社交联系方式">
                <Form.List name={['blogger', 'blogger_socials']}>
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
                            <Select placeholder="选择类型" options={SOCIAL_TYPES} />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, 'value']}
                            rules={[{ required: true, message: '请输入联系方式' }]}
                            style={{ flex: 1 }}
                          >
                            <Input placeholder="例如：your-email@example.com 或 https://github.com/username" />
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
                        >
                          添加社交联系方式
                        </Button>
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </Form.Item>
              </Card>
            )}

            {/* OSS服务配置 */}
            {activeKey === 'oss' && (
              <Card>
                <Title level={4}>OSS 服务配置</Title>
                <Paragraph type="secondary" className="mb-4">
                  配置对象存储服务（如 AWS S3、阿里云 OSS 等），用于存储图片、附件以及备份文件。
                </Paragraph>
              <Form.Item
                label="OSS类型"
                name={['oss', 'oss_type']}
              >
                <Select placeholder="选择OSS服务类型" options={OSS_TYPES} />
              </Form.Item>

              <Form.Item
                label="Access Key ID"
                name={['oss', 'oss_access_key_id']}
              >
                <Input.Password placeholder="OSS访问密钥ID" />
              </Form.Item>

              <Form.Item
                label="Secret Access Key"
                name={['oss', 'oss_secret_access_key']}
              >
                <Input.Password placeholder="OSS访问密钥" />
              </Form.Item>

              <Form.Item
                label="区域"
                name={['oss', 'oss_region']}
              >
                <Input placeholder="例如：us-east-1 或 cn-hangzhou" />
              </Form.Item>

              <Form.Item
                label="Bucket名称"
                name={['oss', 'oss_bucket_name']}
              >
                <Input placeholder="OSS存储桶名称" />
              </Form.Item>

              <Form.Item
                label="Endpoint"
                name={['oss', 'oss_endpoint']}
              >
                <Input placeholder="OSS服务端点（可选）" />
              </Form.Item>
              </Card>
            )}

            {/* 数据备份配置 */}
            {activeKey === 'backup' && (
              <Card>
                <Title level={4}>数据备份配置</Title>
                <Paragraph type="secondary" className="mb-4">
                  定期将数据库中的关键数据导出，并上传到配置好的 OSS 存储中，提升数据安全性。
                </Paragraph>
              <Form.Item
                label="是否开启数据备份"
                name={['backup', 'enabled']}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Form.Item
                label="备份间隔（天）"
                name={['backup', 'interval_days']}
                rules={[{ required: true, message: '请输入备份间隔天数' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              </Card>
            )}

            {/* 邮箱配置 */}
            {activeKey === 'email' && (
              <Card>
                <Title level={4}>邮箱配置</Title>
                <Paragraph type="secondary" className="mb-4">
                  配置 SMTP 服务，用于发送注册确认、通知提醒等系统邮件。
                </Paragraph>
              <Form.Item
                label="SMTP服务器"
                name={['email', 'smtp_host']}
              >
                <Input placeholder="例如：smtp.gmail.com" />
              </Form.Item>

              <Form.Item
                label="SMTP端口"
                name={['email', 'smtp_port']}
              >
                <InputNumber
                  min={1}
                  max={65535}
                  placeholder="例如：587"
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item
                label="SMTP用户名"
                name={['email', 'smtp_user']}
              >
                <Input placeholder="SMTP登录用户名" />
              </Form.Item>

              <Form.Item
                label="SMTP密码"
                name={['email', 'smtp_password']}
              >
                <Input.Password placeholder="SMTP登录密码" />
              </Form.Item>

              <Form.Item
                label="发件人邮箱"
                name={['email', 'smtp_from_email']}
              >
                <Input placeholder="例如：noreply@example.com" />
              </Form.Item>
              </Card>
            )}

            {/* LLM API配置 */}
            {activeKey === 'llm' && (
              <Card>
                <Title level={4}>LLM API 配置（OpenAI API 规范）</Title>
                <Paragraph type="secondary" className="mb-4">
                  连接到符合 OpenAI API 规范的大语言模型服务，为文案润色等功能提供算力。
                </Paragraph>
              <Form.Item
                label="API Key"
                name={['llm', 'llm_api_key']}
              >
                <Input.Password placeholder="OpenAI API Key 或兼容的API Key" />
              </Form.Item>

              <Form.Item
                label="Base URL"
                name={['llm', 'llm_base_url']}
              >
                <Input placeholder="例如：https://api.openai.com/v1" />
              </Form.Item>

              <Form.Item
                label="模型名称"
                name={['llm', 'llm_model']}
              >
                <Input placeholder="例如：gpt-3.5-turbo" />
              </Form.Item>
              </Card>
            )}

            {/* 提示词配置 */}
            {activeKey === 'prompt' && (
              <Card>
                <Title level={4}>提示词配置</Title>
                <Paragraph type="secondary" className="mb-4">
                  自定义 AI 润色的系统提示词，用于控制生成内容的角色、语气和风格。
                </Paragraph>
              <Form.Item
                label="文案润色系统提示词"
                name={['prompt', 'polish_system_prompt']}
                tooltip="这是AI润色功能使用的系统提示词，用于指导AI如何润色文案"
              >
                <TextArea
                  rows={4}
                  placeholder="例如：你是一个专业的文案编辑助手。"
                />
              </Form.Item>
              <div className="text-sm text-gray-500 mt-2">
                <p>提示：系统提示词会影响AI润色的风格和效果，建议根据你的需求进行调整。</p>
              </div>
              </Card>
            )}

            {/* 友链配置 */}
            {activeKey === 'friendly_links' && (
              <Card>
                <Title level={4}>友链配置</Title>
                <Paragraph type="secondary" className="mb-4">
                  管理展示在站点上的友情链接列表，可为每个友链设置名称、链接和描述。
                </Paragraph>
              <Form.List name={['friendly_links', 'links']}>
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <div key={key} className="p-4 border border-gray-100 rounded-lg mb-4 bg-gray-50/50">
                        <div className="flex justify-between items-start mb-4">
                          <span className="font-medium text-gray-500">友链 #{name + 1}</span>
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Form.Item
                            {...restField}
                            label="名称"
                            name={[name, 'name']}
                            rules={[{ required: true, message: '请输入友链名称' }]}
                          >
                            <Input placeholder="例如：我的主页" />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            label="链接 URL"
                            name={[name, 'url']}
                            rules={[{ required: true, message: '请输入友链链接' }]}
                          >
                            <Input placeholder="https://example.com" />
                          </Form.Item>
                        </div>
                        <Form.Item
                          {...restField}
                          label="描述"
                          name={[name, 'description']}
                        >
                          <Input placeholder="可选的描述信息" />
                        </Form.Item>
                      </div>
                    ))}
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        block
                        icon={<PlusOutlined />}
                      >
                        添加友情链接
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
              </Card>
            )}

            {/* 首页开源项目配置 */}
            {activeKey === 'open_source_projects' && (
              <Card>
                <Title level={4}>首页开源项目配置</Title>
                <Paragraph type="secondary" className="mb-4">
                  配置首页展示的个人开源项目卡片，突出重要项目和代码仓库。
                </Paragraph>
              <Form.List name={['open_source_projects']}>
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <div key={key} className="p-4 border border-gray-100 rounded-lg mb-4 bg-gray-50/50">
                        <div className="flex justify-between items-start mb-4">
                          <span className="font-medium text-gray-500">开源项目 #{name + 1}</span>
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          />
                        </div>
                        <Form.Item
                          {...restField}
                          label="项目名称"
                          name={[name, 'project_name']}
                          rules={[{ required: true, message: '请输入项目名称' }]}
                        >
                          <Input placeholder="例如：vibe-coding-blog" />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          label="项目描述"
                          name={[name, 'project_description']}
                        >
                          <TextArea rows={3} placeholder="一句话介绍这个项目" />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          label="Github 地址"
                          name={[name, 'github_url']}
                          rules={[{ required: true, message: '请输入 Github 地址' }]}
                        >
                          <Input placeholder="https://github.com/xxx/yyy" />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          label="封面图 URL"
                          name={[name, 'cover_image']}
                        >
                          <Input placeholder="https://example.com/cover.png" />
                        </Form.Item>
                      </div>
                    ))}
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        block
                        icon={<PlusOutlined />}
                      >
                        添加开源项目
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
              </Card>
            )}

            {/* 首页头部菜单项配置 */}
            {activeKey === 'header_menu' && (
              <Card>
                <Title level={4}>首页头部菜单项配置</Title>
                <Paragraph type="secondary" className="mb-4">
                  自定义网站头部导航栏的菜单项与图标，引导用户快速访问重要页面或外部链接。
                </Paragraph>
              <p className="text-gray-500 text-sm mb-4">配置后将在网站头部导航展示，支持站内路径（如 /posts）或外链。</p>
              <Form.List name={['header_menu', 'items']}>
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <div key={key} className="p-4 border border-gray-100 rounded-lg mb-4 bg-gray-50/50">
                        <div className="flex justify-between items-start mb-4">
                          <span className="font-medium text-gray-500">菜单项 #{name + 1}</span>
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Form.Item
                            {...restField}
                            label="图标"
                            name={[name, 'icon']}
                            style={{ marginBottom: 0 }}
                          >
                            <Select placeholder="选择图标" options={HEADER_MENU_ICONS} allowClear />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            label="菜单名称"
                            name={[name, 'name']}
                            rules={[{ required: true, message: '请输入菜单名称' }]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="例如：文章" />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            label="跳转地址"
                            name={[name, 'url']}
                            rules={[{ required: true, message: '请输入跳转地址' }]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="/posts 或 https://..." />
                          </Form.Item>
                        </div>
                      </div>
                    ))}
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        block
                        icon={<PlusOutlined />}
                      >
                        添加菜单项
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
              </Card>
            )}
          </Form>
        </div>
      </div>
    </div>
  )
}
