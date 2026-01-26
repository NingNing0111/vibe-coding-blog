# 环境变量配置优化说明

## 优化概述

本次优化统一了项目环境变量配置，所有服务（后端、前端、Docker）现在统一使用项目根目录的 `.env` 文件。

## 主要变更

### 1. 统一环境变量文件位置
- **之前**：后端使用 `backend/.env`，前端使用 `frontend/.env.local`
- **现在**：所有服务统一使用项目根目录的 `.env` 文件

### 2. 更新的文件

#### 配置文件
- ✅ `.env` - 添加了所有必要的环境变量（包括 DATABASE_URL 和 REDIS_URL）
- ✅ `.env.example` - 更新了示例文件，包含所有变量和详细注释
- ✅ `backend/app/core/config.py` - 修改为从项目根目录读取 `.env` 文件
- ✅ `docker-compose.yml` - 使用 `env_file` 统一从最外层读取环境变量
- ✅ `frontend/Dockerfile` - 在构建时从最外层读取环境变量

#### 文档文件
- ✅ `README_SETUP.md` - 更新了环境变量配置说明
- ✅ `backend/.env.example` - 添加了说明注释
- ✅ `frontend/.env.example` - 添加了说明注释

## 使用方法

### Docker 部署
```bash
# 1. 复制环境变量文件
cp .env.example .env

# 2. 编辑 .env 文件，配置所有环境变量
# 注意：Docker 环境下的 DATABASE_URL 和 REDIS_URL 会自动使用服务名

# 3. 启动服务
docker-compose up -d
```

### 本地开发

#### 后端
```bash
# 后端会自动从项目根目录读取 .env 文件
# 无需在 backend 目录下创建 .env 文件
cd backend
uvicorn main:app --reload
```

#### 前端
```bash
# Next.js 会自动从项目根目录读取 .env 文件中的 NEXT_PUBLIC_* 变量
# 无需在 frontend 目录下创建 .env.local 文件
cd frontend
npm run dev
```

## 环境变量说明

所有环境变量都在项目根目录的 `.env` 文件中配置：

- **数据库配置**：`DATABASE_URL`（Docker 环境会自动使用服务名）
- **Redis 配置**：`REDIS_URL`（Docker 环境会自动使用服务名）
- **JWT 配置**：`SECRET_KEY`、`ACCESS_TOKEN_EXPIRE_MINUTES`、`REFRESH_TOKEN_EXPIRE_DAYS`
- **CORS 配置**：`CORS_ORIGINS`
- **S3 配置**（可选）：`AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`、`AWS_REGION`、`S3_BUCKET_NAME`
- **邮件配置**（可选）：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM_EMAIL`
- **OpenAI 配置**（可选）：`OPENAI_API_KEY`、`OPENAI_BASE_URL`
- **前端配置**：`NEXT_PUBLIC_API_URL`

## 注意事项

1. **Docker 环境**：`DATABASE_URL` 和 `REDIS_URL` 在 docker-compose.yml 中会自动覆盖为使用服务名（`postgres` 和 `redis`）
2. **本地开发**：需要将 `DATABASE_URL` 和 `REDIS_URL` 中的主机名改为 `localhost`
3. **生产环境**：请确保修改 `SECRET_KEY` 为强随机密钥
4. **向后兼容**：子目录的 `.env.example` 文件已添加说明，但实际配置应使用根目录的 `.env` 文件

## 迁移指南

如果之前使用了子目录的 `.env` 文件：

1. 将 `backend/.env` 和 `frontend/.env.local` 中的配置合并到项目根目录的 `.env` 文件
2. 删除子目录的 `.env` 文件（可选，但建议删除以避免混淆）
3. 确保根目录的 `.env` 文件包含所有必要的环境变量
