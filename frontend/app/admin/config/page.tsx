'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPut } from '@/lib/api'
import { Card, Form, Input, Button, message, Collapse, Space, Select, InputNumber } from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons'

const { TextArea } = Input
const { Panel } = Collapse

interface SiteBasicConfig {
  site_title: string
  site_subtitle: string
  site_description: string
  site_keywords: string
  site_logo: string
  site_copyright: string
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

interface AllConfigs {
  site_basic: SiteBasicConfig
  blogger: BloggerConfig
  oss: OSSConfig
  email: EmailConfig
  llm: LLMConfig
  prompt: PromptConfig
  friendly_links: FriendlyLinksConfig
  open_source_projects: OpenSourceProjectConfig[]
  header_menu: HeaderMenuConfig
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
      const values = await form.validateFields()
      await apiPut('/api/v1/config/structured/all', values)
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
        <h1 className="text-3xl font-bold">系统配置</h1>
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

      <Form form={form} layout="vertical" className="space-y-6">
        <Collapse defaultActiveKey={['1', '2', '3', '4', '5', '6', '7', '8', '9']} ghost>
          {/* 网站基本配置 */}
          <Panel header="网站基本配置" key="1">
            <Card>
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
          </Panel>

          {/* 个人博主配置 */}
          <Panel header="个人博主配置" key="2">
            <Card>
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
          </Panel>

          {/* OSS服务配置 */}
          <Panel header="OSS服务配置" key="3">
            <Card>
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
          </Panel>

          {/* 邮箱配置 */}
          <Panel header="邮箱配置" key="4">
            <Card>
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
          </Panel>

          {/* LLM API配置 */}
          <Panel header="LLM API配置（OpenAI API规范）" key="5">
            <Card>
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
          </Panel>

          {/* 提示词配置 */}
          <Panel header="提示词配置" key="6">
            <Card>
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
          </Panel>

          {/* 友链配置 */}
          <Panel header="友链配置" key="7">
            <Card>
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
          </Panel>

          {/* 首页开源项目配置 */}
          <Panel header="首页开源项目配置（支持多个）" key="8">
            <Card>
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
          </Panel>

          {/* 首页头部菜单项配置 */}
          <Panel header="首页头部菜单项配置" key="9">
            <Card>
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
          </Panel>
        </Collapse>
      </Form>
    </div>
  )
}
