from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1 import api_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - 添加重试逻辑以确保数据库连接
    max_retries = 5
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("数据库连接成功，表结构已创建/验证")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"数据库连接失败 (尝试 {attempt + 1}/{max_retries}): {e}")
                logger.info(f"等待 {retry_delay} 秒后重试...")
                await asyncio.sleep(retry_delay)
            else:
                logger.error(f"数据库连接失败，已达到最大重试次数: {e}")
                raise
    
    yield
    # Shutdown
    await engine.dispose()
    logger.info("数据库连接已关闭")


app = FastAPI(
    title="个人博客系统 API",
    description="基于 FastAPI 的个人博客系统后端",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "个人博客系统 API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
