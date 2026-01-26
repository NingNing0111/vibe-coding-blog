from fastapi import APIRouter

from app.api.v1 import auth, posts, categories, tags, comments, config, upload, ai, init, stats, media

api_router = APIRouter()

api_router.include_router(init.router, prefix="/init", tags=["初始化"])
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(posts.router, prefix="/posts", tags=["文章"])
api_router.include_router(categories.router, prefix="/categories", tags=["分类"])
api_router.include_router(tags.router, prefix="/tags", tags=["标签"])
api_router.include_router(comments.router, prefix="/comments", tags=["评论"])
api_router.include_router(config.router, prefix="/config", tags=["配置"])
api_router.include_router(upload.router, prefix="/upload", tags=["上传"])
api_router.include_router(media.router, prefix="/media", tags=["媒体资源"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI"])
api_router.include_router(stats.router, prefix="/stats", tags=["统计"])
