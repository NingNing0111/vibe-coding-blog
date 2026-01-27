from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.post import Post
from app.models.comment import Comment

router = APIRouter()


def _compute_stats(db_result_views, db_result_comments, db_result_posts):
    """共用统计逻辑"""
    return {
        "total_views": int(db_result_views or 0),
        "total_comments": int(db_result_comments or 0),
        "total_posts": int(db_result_posts or 0),
    }


@router.get("/")
async def get_statistics(db: AsyncSession = Depends(get_db)):
    """获取全站统计信息（前端仪表盘用）"""
    total_views = await db.scalar(
        select(func.sum(Post.view_count)).where(Post.status == "PUBLISHED")
    )
    total_comments = await db.scalar(
        select(func.count(Comment.id)).where(Comment.is_deleted == False)
    )
    total_posts = await db.scalar(
        select(func.count(Post.id)).where(Post.status == "PUBLISHED")
    )
    return _compute_stats(total_views, total_comments, total_posts)


@router.get("/overview")
async def get_statistics_overview(db: AsyncSession = Depends(get_db)):
    """获取全站统计信息（overview 别名，与 / 返回一致）"""
    total_views = await db.scalar(
        select(func.sum(Post.view_count)).where(Post.status == "PUBLISHED")
    )
    total_comments = await db.scalar(
        select(func.count(Comment.id)).where(Comment.is_deleted == False)
    )
    total_posts = await db.scalar(
        select(func.count(Post.id)).where(Post.status == "PUBLISHED")
    )
    return _compute_stats(total_views, total_comments, total_posts)
