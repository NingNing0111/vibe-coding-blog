# 个人博客系统 - 安装与部署指南

## 前置要求

- Docker 和 Docker Compose
- 或本地安装：
  - Node.js 18+
  - Python 3.11+
  - PostgreSQL 15+
  - Redis 7+

## 快速开始

### 使用 Docker Compose（推荐）

1. 克隆项目到本地

2. 配置环境变量

   ```bash
   # 统一使用项目根目录的 .env 文件
   cp .env.example .env
   # 编辑 .env 文件，配置所有环境变量（数据库、Redis、JWT密钥、API URL等）
   ```
   
   **注意**：本项目已统一使用项目根目录的 `.env` 文件，所有服务（后端、前端、Docker）都会从此文件读取环境变量。

3. 启动服务

   ```bash
   docker-compose up -d
   ```

4. 访问应用

   - 前端：http://localhost:3000
   - 后端 API：http://localhost:8000
   - API 文档：http://localhost:8000/docs

### 本地开发

#### 后端

1. 进入后端目录

   ```bash
   cd backend
   ```

2. 创建虚拟环境并安装依赖

   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. 配置环境变量

   ```bash
   # 从项目根目录复制环境变量文件
   cp ../.env.example ../.env
   # 编辑项目根目录的 .env 文件
   ```
   
   **注意**：后端会自动从项目根目录读取 `.env` 文件，无需在 `backend` 目录下创建 `.env` 文件。

4. 运行数据库迁移

   ```bash
   alembic upgrade head
   ```

5. 启动服务

   ```bash
   uvicorn main:app --reload
   ```

#### 前端

1. 进入前端目录

   ```bash
   cd frontend
   ```

2. 安装依赖

   ```bash
   npm install
   ```

3. 配置环境变量

   ```bash
   # 从项目根目录复制环境变量文件
   cp ../.env.example ../.env
   # 编辑项目根目录的 .env 文件
   ```
   
   **注意**：前端会自动从项目根目录读取 `.env` 文件中的 `NEXT_PUBLIC_*` 变量，无需在 `frontend` 目录下创建 `.env.local` 文件。

4. 启动开发服务器

   ```bash
   npm run dev
   ```

## 首次配置

系统首次启动后，需要：

1. 创建管理员账户（通过注册接口或直接操作数据库）
2. 配置 S3 对象存储（可选）
3. 配置邮件服务（可选）
4. 配置 LLM 服务（可选）

## 数据库迁移

使用 Alembic 进行数据库迁移：

```bash
# 创建迁移
alembic revision --autogenerate -m "描述"

# 应用迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

## 生产环境部署

1. 修改 `docker-compose.yml` 中的配置
2. 使用 HTTPS（配置 Nginx SSL）
3. 设置强密码和密钥
4. 配置备份策略
5. 监控和日志

## 常见问题

### 数据库连接失败

检查 `DATABASE_URL` 配置是否正确，确保数据库服务已启动。

### Redis 连接失败

检查 `REDIS_URL` 配置是否正确，确保 Redis 服务已启动。

### 前端无法访问后端 API

检查 `NEXT_PUBLIC_API_URL` 配置，确保 CORS 设置正确。

## 技术支持

如有问题，请查看项目文档或提交 Issue。
