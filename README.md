# Vibe Coding Blog

一个**自托管的个人博客系统**，基于 Next.js + FastAPI 构建，支持文章发布、评论互动、分类标签、媒体管理，并集成 **AI 文案润色**、**GitHub 热门仓库爬取与自动成文**、**定期全站备份**、**邮件订阅与通知**等能力，适合技术博客与知识沉淀。

---

## ✨ 核心功能

| 模块 | 说明 |
|------|------|
| **文章管理** | Markdown 编辑、草稿/发布、SEO 友好 slug、封面图、分类与多标签 |
| **用户与认证** | 邮箱注册/登录、JWT（Access + Refresh Token）、bcrypt 密码加密 |
| **评论系统** | 登录用户评论、树形回复、管理员审核、评论/回复邮件通知 |
| **AI 润色** | 兼容 OpenAI API，流式返回，后台编辑时一键润色文章 |
| **GitHub 热门** | 每日定时爬取 GitHub Trending，自动生成总结并可选发布为博客文章 |
| **全站备份** | 可配置周期（天）的全站数据备份至本地或 S3 |
| **媒体资源** | 封面/正文图/头像统一管理，支持 S3 直传，减轻后端压力 |
| **配置中心** | 邮件、OSS、博客信息、站点头尾脚本、LLM 等可后台配置 |
| **统计** | 文章与全站阅读量、评论量统计 |
| **订阅与退订** | 邮件订阅与退订链接，便于通知读者 |

首次部署支持**初始化引导**：配置管理员账号、OSS、邮件、LLM 等，开箱即用。

---

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18、Next.js 14（App Router）、TypeScript、Tailwind CSS、Radix UI / Ant Design、Markdown 编辑器 |
| **后端** | Python 3.11、FastAPI、SQLAlchemy 2.0（Async）、JWT、Alembic |
| **数据与缓存** | PostgreSQL 15+、Redis 7+ |
| **存储** | Amazon S3 兼容对象存储（boto3） |
| **部署** | Docker + Docker Compose、Nginx 可选 |

---

## 📁 项目结构

```
vibe-coding-blog/
├── frontend/          # Next.js 前端（SSR/SSG/RSC）
├── backend/           # FastAPI 后端、API、服务与迁移
├── nginx/             # Nginx 配置示例
├── docs/              # 设计文档与部署说明
├── docker-compose.yml # 一键部署
└── .env.example       # 环境变量示例
```

---

## 🚀 快速开始

### 使用 Docker Compose（推荐）

1. **克隆并进入项目**

   ```bash
   git clone <your-repo-url>
   cd vibe-coding-blog
   ```

2. **配置环境变量**

   ```bash
   cp .env.example .env
   # 编辑 .env，至少将 SECRET_KEY 改为随机字符串（如 openssl rand -hex 32）
   ```

3. **启动服务**

   ```bash
   docker-compose up -d
   ```

4. **访问**

   - 前端：<http://localhost:3000>
   - 后端 API：<http://localhost:8000>
   - API 文档：<http://localhost:8000/docs>

首次访问若未初始化，将进入 **Setup** 引导页，完成管理员与基础配置即可使用。

### 本地开发

- **后端**：`backend` 目录下创建虚拟环境，安装 `requirements.txt`，配置根目录 `.env`，执行 `alembic upgrade head` 后 `uvicorn main:app --reload`。
- **前端**：`frontend` 目录下 `pnpm install` 后 `pnpm dev`，并确保 `.env` 中 `NEXT_PUBLIC_API_URL` 指向本地后端（如 `http://localhost:8000`）。

详见 [docs/README_SETUP.md](docs/README_SETUP.md)。

---

## ⚙️ 环境变量说明

| 变量 | 说明 |
|------|------|
| `SECRET_KEY` | **必填**。JWT 等安全相关，建议使用 `openssl rand -hex 32` 生成 |
| `POSTGRES_*` / `REDIS_*` | 数据库与 Redis 连接（有默认值） |
| `NEXT_PUBLIC_API_URL` | 前端请求的后端地址；同域部署可设为 `/api` |
| `NEXT_PUBLIC_SITE_ORIGIN` | 同域部署时填站点域名，供服务端请求用 |
| `CORS_ORIGINS` | 允许的跨域来源，多域名逗号分隔 |

邮件、OSS、LLM、备份等可在**后台配置中心**或 `.env` 中按需配置，参见 `.env.example`。

---

## 📄 文档

- [PROJECT_DOC.md](docs/PROJECT_DOC.md) — 系统架构与模块设计
- [README_SETUP.md](docs/README_SETUP.md) — 安装与部署详解

---

## 📜 License

按项目仓库所声明的许可证使用。
