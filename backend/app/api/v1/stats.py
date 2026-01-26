from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.post import Post
from app.models.comment import Comment

router = APIRouter()


@router.get("/overview")
async def get_statistics_overview(db: AsyncSession = Depends(get_db)):
    """获取全站统计信息"""
    # 总阅读量
    total_views = await db.scalar(
        select(func.sum(Post.view_count))
        .where(Post.status == "PUBLISHED")
    ) or 0
    
    # 总评论数
    total_comments = await db.scalar(
        select(func.count(Comment.id))
        .where(Comment.is_deleted == False)
    ) or 0
    
    # 文章总数
    total_posts = await db.scalar(
        select(func.count(Post.id))
        .where(Post.status == "PUBLISHED")
    ) or 0
    
    return {
        "total_views": int(total_views),
        "total_comments": int(total_comments),
        "total_posts": int(total_posts)
    }
