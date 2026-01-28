'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Card, Row, Col, Space, Typography, Avatar, Tag, Divider, Spin, Empty } from 'antd'
import {
  CodeOutlined,
  BookOutlined,
  ThunderboltOutlined,
  GithubOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  EyeOutlined,
  MessageOutlined,
  UserOutlined,
  MailOutlined,
  TwitterOutlined,
  LinkedinOutlined,
  GlobalOutlined
} from '@ant-design/icons'
import { apiGet } from '@/lib/api'
import Link from 'next/link'
import { useConfig } from '@/contexts/ConfigContext'

// --- Interfaces ---

interface Post {
  id: number
  title: string
  slug: string
  excerpt: string | null
  cover_image: string | null
  view_count: number
  comment_count: number
  created_at: string
  published_at: string | null
  author: {
    id: number
    username: string
    avatar: string | null
  }
  categories: Array<{
    id: number
    name: string
    slug: string
  }>
  tags: Array<{
    id: number
    name: string
    slug: string
  }>
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
}

// --- Helper Components ---

const SocialIcon = ({ type }: { type: string }) => {
  switch (type.toLowerCase()) {
    case 'github': return <GithubOutlined />
    case 'email': return <MailOutlined />
    case 'twitter': return <TwitterOutlined />
    case 'linkedin': return <LinkedinOutlined />
    default: return <GlobalOutlined />
  }
}

export default function Home() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const { config, loading: configLoading } = useConfig()
  const [loading, setLoading] = useState(true)
  const [recentPosts, setRecentPosts] = useState<Post[]>([])
  const hasCheckedInit = useRef(false)

  useEffect(() => {
    // 检查登录状态
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    setIsLoggedIn(!!token)

    // 检查系统是否已初始化
    if (!hasCheckedInit.current) {
      hasCheckedInit.current = true
      apiGet<{ initialized: boolean }>('/api/v1/init/check', true)
        .then((response) => {
          if (!response.initialized) {
            router.push('/setup')
          }
        })
        .catch(() => { })
    }

    // 获取文章
    const fetchPosts = async () => {
      try {
        setLoading(true)
        const postsData = await apiGet<PaginatedResponse<Post>>('/api/v1/posts/published?page=1&size=3')
        setRecentPosts(postsData.items || [])
      } catch (error) {
        console.error('Failed to fetch recent posts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [router])

  const siteTitle = config?.site_basic?.site_title || process.env.NEXT_PUBLIC_SITE_TITLE || '我的技术博客'
  const siteSubtitle = config?.site_basic?.site_subtitle || process.env.NEXT_PUBLIC_SITE_SUBTITLE || '分享编程经验、技术见解与开发心得'
  const siteDescription = config?.site_basic?.site_description || process.env.NEXT_PUBLIC_SITE_DESCRIPTION
  const openSourceProjects = config?.open_source_projects || []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 px-6">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 mb-8 transition-colors duration-300 shadow-sm">
            {config?.site_basic?.site_logo ? (
              <img
                src={config.site_basic.site_logo}
                alt="Logo"
                className="w-16 h-16 object-contain"
              />
            ) : (
              <CodeOutlined style={{ fontSize: '40px', color: '#1677ff' }} />
            )}
          </div>

          <Typography.Title level={1} className="!text-5xl md:!text-6xl !font-bold !text-gray-900 dark:!text-gray-100 !mb-6 tracking-tight">
            {siteTitle}
          </Typography.Title>

          <Typography.Paragraph className="!text-xl md:!text-2xl !text-gray-600 dark:!text-gray-400 !mb-4 !max-w-2xl !mx-auto !leading-relaxed">
            {siteSubtitle}
          </Typography.Paragraph>

          {siteDescription && (
            <Typography.Paragraph className="!text-base !text-gray-500 dark:!text-gray-400 !mb-10 !max-w-2xl !mx-auto !leading-relaxed opacity-80">
              {siteDescription}
            </Typography.Paragraph>
          )}

          <Space size="middle" wrap className="justify-center">
            <Link href="/posts">
              <Button type="primary" size="large" icon={<BookOutlined />} className="h-12 px-8 text-lg rounded-full shadow-lg shadow-blue-500/20">
                阅读文章
              </Button>
            </Link>
            {!isLoggedIn && (
              <Link href="/login">
                <Button size="large" className="h-12 px-8 text-lg rounded-full border-gray-300 dark:border-gray-700">
                  即刻加入
                </Button>
              </Link>
            )}
          </Space>
        </div>
      </section>

      {/* Featured Articles */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <Typography.Title level={2} className="!mb-2 dark:!text-gray-100">近期发布</Typography.Title>
            <Typography.Paragraph type="secondary" className="!mb-0">探索最新的技术见解和实战经验</Typography.Paragraph>
          </div>
          <Link href="/posts" className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium group">
            查看更多 <ArrowRightOutlined className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {loading || configLoading ? (
          <div className="py-20 text-center"><Spin size="large" /></div>
        ) : recentPosts.length > 0 ? (
          <Row gutter={[32, 32]}>
            {recentPosts.map((post) => (
              <Col xs={24} md={8} key={post.id}>
                <Link href={`/posts/${post.slug}`} className="group block h-full">
                  <Card
                    hoverable
                    className="h-full rounded-2xl overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 dark:bg-gray-900"
                    styles={{ body: { padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' } }}
                    cover={
                      <div className="h-48 overflow-hidden relative">
                        {post.cover_image ? (
                          <img
                            src={post.cover_image}
                            alt={post.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <BookOutlined className="text-4xl text-white/50" />
                          </div>
                        )}
                      </div>
                    }
                  >
                    <Typography.Title level={4} className="!mb-3 !line-clamp-2 dark:!text-gray-100 group-hover:text-blue-600 transition-colors">
                      {post.title}
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" className="!mb-4 !line-clamp-2 !text-sm !min-h-[40px]">
                      {post.excerpt && post.excerpt.trim() ? post.excerpt : '暂无描述'}
                    </Typography.Paragraph>
                    <div className="flex items-center gap-2 flex-wrap mb-4">
                      {post.categories && post.categories.map((cat) => (
                        <Tag key={cat.id} color="blue" className="!m-0 !px-2 !py-0.5 !rounded">
                          {cat.name}
                        </Tag>
                      ))}
                      {post.tags && post.tags.map((tag) => (
                        <Tag key={tag.id} className="!m-0 !px-2 !py-0.5 !rounded !bg-gray-100 dark:!bg-gray-700 dark:!text-gray-300 !border-0">
                          #{tag.name}
                        </Tag>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <Avatar size="small" src={post.author.avatar} icon={<UserOutlined />} />
                        <span className="text-xs text-gray-500">{post.author.username}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><EyeOutlined /> {post.view_count}</span>
                        <span className="flex items-center gap-1"><MessageOutlined /> {post.comment_count}</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无文章" />
        )}
      </section>

      {/* Author & Features */}
      <section className="py-20 bg-white dark:bg-gray-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6">
          <Row gutter={[48, 48]} align="middle">
            <Col xs={24} md={10}>
              <div className="p-8 rounded-3xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                  <Avatar
                    size={100}
                    src={config?.blogger?.blogger_avatar}
                    icon={<UserOutlined />}
                    className="border-4 border-white dark:border-gray-700 shadow-lg mb-6"
                  />
                  <Typography.Title level={3} className="!mb-2 dark:!text-gray-100">
                    关于博主
                  </Typography.Title>
                  <div className="!text-gray-600 dark:!text-gray-400 !mb-8 !text-lg !italic prose dark:prose-invert max-w-none prose-p:my-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {config?.blogger?.blogger_signature
                        ? `${config.blogger.blogger_signature}`
                        : '追求卓越，进无止境。'}
                    </ReactMarkdown>
                  </div>
                  <div className="flex gap-4">
                    {config?.blogger?.blogger_socials?.map((social, index) => (
                      <a
                        key={index}
                        href={social.value.startsWith('http') ? social.value : `mailto:${social.value}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-10 h-10 rounded-full bg-white dark:bg-gray-700 shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-blue-500 hover:text-white transition-all duration-300"
                      >
                        <SocialIcon type={social.type} />
                      </a>
                    ))}
                  </div>
                </div>
                <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
              </div>
            </Col>

            <Col xs={24} md={14}>
              <Typography.Title level={2} className="!mb-10 dark:!text-gray-100">为什么阅读我的博客？</Typography.Title>
              <Row gutter={[24, 24]}>
                {[
                  { icon: <CodeOutlined />, title: '深度技术解析', desc: '不只是代码片段，更有底层的设计思考与实现细节。' },
                  { icon: <ThunderboltOutlined />, title: '实战经验总结', desc: '记录开发中遇到的真实挑战，以及经过验证的解决方案。' },
                  { icon: <BookOutlined />, title: '知识体系构建', desc: '成系列的技术文章，助你系统性地掌握一门技术或框架。' },
                  { icon: <GithubOutlined />, title: '开源项目动态', desc: '分享个人开源项目的开发进展，与社区共同成长。' },
                ].map((item, index) => (
                  <Col xs={24} sm={12} key={index}>
                    <div className="flex gap-4 group">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                        {item.icon}
                      </div>
                      <div>
                        <Typography.Title level={4} className="!mb-1 !text-lg dark:!text-gray-100">{item.title}</Typography.Title>
                        <Typography.Text type="secondary" className="!text-sm">{item.desc}</Typography.Text>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Col>
          </Row>
        </div>
      </section>

      {/* Open Source Projects */}
      {openSourceProjects.length > 0 && (
        <section className="py-20 px-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <div>
              <Typography.Title level={2} className="!mb-2 dark:!text-gray-100">个人开源项目</Typography.Title>
              <Typography.Paragraph type="secondary" className="!mb-0">持续迭代中，欢迎 Star / Issue / PR</Typography.Paragraph>
            </div>
          </div>

          <Row gutter={[24, 24]}>
            {openSourceProjects.map((project, index) => (
              <Col xs={24} md={12} lg={8} key={index}>
                <Card
                  hoverable
                  className="h-full rounded-2xl overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 dark:bg-gray-900"
                  styles={{ body: { padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' } }}
                  cover={
                    project.cover_image ? (
                      <div className="h-48 overflow-hidden relative">
                        <img
                          src={project.cover_image}
                          alt={project.project_name || 'Open Source Project'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : undefined
                  }
                >
                  <Typography.Title level={4} className="!mb-2 dark:!text-gray-100">
                    {project.project_name || '我的开源项目'}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" className="!mb-4 !text-sm !line-clamp-3">
                    {project.project_description || '一个持续打磨的开源项目，欢迎关注与参与。'}
                  </Typography.Paragraph>
                  {project.github_url && (
                    <div className="mt-auto">
                      <a href={project.github_url} target="_blank" rel="noreferrer">
                        <Button type="primary" icon={<GithubOutlined />}>
                          访问 Github
                        </Button>
                      </a>
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </section>
      )}

      {/* Footer / CTA */}
      <section className="py-24 text-center px-6">
        <Typography.Title level={2} className="!mb-6 dark:!text-gray-100">准备好开启学习之旅了吗？</Typography.Title>
        <Typography.Paragraph type="secondary" className="!text-lg !mb-10 !max-w-2xl !mx-auto">
          加入我们的社区，获取最新的技术动态和深度好文。
        </Typography.Paragraph>
        <Link href="/posts">
          <Button type="primary" size="large" className="h-14 px-12 text-lg rounded-full">
            立即开始浏览
          </Button>
        </Link>
      </section>
    </div>
  )
}
