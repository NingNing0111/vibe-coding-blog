# 项目结构说明

## 目录结构

```
vibe-coding-blog/
├── backend/                 # 后端 FastAPI 应用
│   ├── app/
│   │   ├── api/            # API 路由
│   │   │   └── v1/         # API v1 版本
│   │   ├── core/           # 核心配置和工具
│   │   ├── models/         # 数据库模型
│   │   ├── schemas/        # Pydantic 模式
│   │   └── services/       # 业务服务层
│   ├── alembic/            # 数据库迁移
│   ├── main.py             # FastAPI 应用入口
│   ├── requirements.txt    # Python 依赖
│   └── Dockerfile          # Docker 镜像配置
│
├── frontend/               # 前端 Next.js 应用
│   ├── app/                # Next.js App Router
│   │   ├── admin/          # 管理后台页面
│   │   ├── posts/          # 文章相关页面
│   │   ├── login/          # 登录页面
│   │   ├── register/       # 注册页面
│   │   └── setup/          # 初始化页面
│   ├── lib/                # 工具函数
│   ├── package.json        # Node.js 依赖
│   └── Dockerfile          # Docker 镜像配置
│
├── nginx/                  # Nginx 配置
│   └── nginx.conf          # Nginx 配置文件
│
├── docker-compose.yml      # Docker Compose 配置
├── README.md               # 项目说明文档
├── README_SETUP.md         # 安装部署指南
└── .gitignore             # Git 忽略文件
```

## 核心模块说明

### 后端模块

1. **认证模块** (`app/api/v1/auth.py`)
   - 用户注册/登录
   - JWT 令牌管理
   - 邮箱验证码

2. **文章模块** (`app/api/v1/posts.py`)
   - 文章 CRUD
   - 文章列表和详情
   - 阅读量统计

3. **分类模块** (`app/api/v1/categories.py`)
   - 分类管理（支持层级结构）

4. **标签模块** (`app/api/v1/tags.py`)
   - 标签管理

5. **评论模块** (`app/api/v1/comments.py`)
   - 评论 CRUD
   - 树形结构回复
   - 邮件通知

6. **配置模块** (`app/api/v1/config.py`)
   - 系统配置管理

7. **上传模块** (`app/api/v1/upload.py`)
   - S3 预签名 URL 生成

8. **AI 模块** (`app/api/v1/ai.py`)
   - 文案润色（流式返回）

9. **初始化模块** (`app/api/v1/init.py`)
   - 系统初始化检查
   - 管理员账户创建

### 前端模块

1. **首页** (`app/page.tsx`)
   - 系统初始化检查
   - 导航

2. **文章列表** (`app/posts/page.tsx`)
   - 文章列表展示

3. **文章详情** (`app/posts/[slug]/page.tsx`)
   - Markdown 渲染
   - 评论展示

4. **管理后台** (`app/admin/`)
   - 文章管理
   - 分类管理
   - 标签管理

5. **认证页面** (`app/login/`, `app/register/`)
   - 用户登录/注册

6. **初始化页面** (`app/setup/page.tsx`)
   - 系统首次配置

## 数据模型

- **User**: 用户表（管理员/普通用户）
- **Post**: 文章表
- **Category**: 分类表（支持层级）
- **Tag**: 标签表
- **Comment**: 评论表（树形结构）
- **Config**: 配置表

## 技术栈

### 后端
- FastAPI
- SQLAlchemy 2.0 (Async)
- PostgreSQL
- Redis
- JWT 认证
- Alembic 迁移

### 前端
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React Markdown

## 部署

使用 Docker Compose 一键部署所有服务：
- PostgreSQL 数据库
- Redis 缓存
- FastAPI 后端
- Next.js 前端
- Nginx 反向代理

详见 `README_SETUP.md`
