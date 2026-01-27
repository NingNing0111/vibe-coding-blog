from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
from sqlalchemy.orm import selectinload
import math

from app.core.database import get_db
from app.core.config_loader import get_email_config
from app.api.dependencies import get_current_user, get_current_admin
from app.schemas.comment import CommentCreate, CommentResponse, CommentListResponse, UserInfo
from app.schemas.pagination import PaginatedResponse
from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User, UserRole
from app.services.email_service import email_service

router = APIRouter()


def build_comment_tree(comments: List[Comment]) -> List[CommentResponse]:
    """构建评论树结构。从 ORM 手动构造 CommentResponse，避免访问 c.replies 触发异步下的懒加载（MissingGreenlet）。"""
    comment_dict: dict[int, CommentResponse] = {}
    for c in comments:
        comment_dict[c.id] = CommentResponse(
            id=c.id,
            content=c.content,
            post_id=c.post_id,
            user=UserInfo.model_validate(c.user),
            parent_id=c.parent_id,
            replies=[],
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
    root_comments: List[CommentResponse] = []
    for c in comments:
        resp = comment_dict[c.id]
        if c.parent_id and c.parent_id in comment_dict:
            comment_dict[c.parent_id].replies.append(resp)
        else:
            root_comments.append(resp)
    return root_comments


@router.get("/post/{post_id}", response_model=List[CommentResponse])
async def get_comments_by_post(
    post_id: int,
    db: AsyncSession = Depends(get_db)
):
    """获取文章的所有评论"""
    # 检查文章是否存在
    result = await db.execute(select(Post).where(Post.id == post_id))
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文章不存在"
        )
    
    # 获取所有评论
    result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.user))
        .where(Comment.post_id == post_id, Comment.is_deleted == False)
        .order_by(Comment.created_at)
    )
    comments = result.scalars().all()
    
    return build_comment_tree(comments)


@router.post("/", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建评论"""
    # 检查文章是否存在
    result = await db.execute(select(Post).where(Post.id == comment_data.post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文章不存在"
        )
    
    # 如果是对评论的回复，检查父评论是否存在
    if comment_data.parent_id:
        result = await db.execute(select(Comment).where(Comment.id == comment_data.parent_id))
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="父评论不存在"
            )
    
    # 先统计当前评论数（必须在 add 之前，否则同一 session 的 count 会包含未提交的新评论导致多算）
    current_count = await db.scalar(
        select(func.count(Comment.id))
        .where(Comment.post_id == post.id, Comment.is_deleted == False)
    ) or 0

    # 创建评论
    new_comment = Comment(
        content=comment_data.content,
        post_id=comment_data.post_id,
        user_id=current_user.id,
        parent_id=comment_data.parent_id
    )
    db.add(new_comment)

    # 更新文章评论数
    post.comment_count = current_count + 1
    
    await db.commit()
    await db.refresh(new_comment)

    # 手动构建响应，避免触发 ORM 的 replies 懒加载（异步下会报 MissingGreenlet）
    response = CommentResponse(
        id=new_comment.id,
        content=new_comment.content,
        post_id=new_comment.post_id,
        user=UserInfo.model_validate(current_user),
        parent_id=new_comment.parent_id,
        replies=[],
        created_at=new_comment.created_at,
        updated_at=new_comment.updated_at,
    )
    
    # 从数据库读取邮箱配置并发送通知
    email_config = await get_email_config(db)
    # 1. 通知管理员有新评论
    admin_result = await db.execute(select(User).where(User.role == UserRole.ADMIN))
    admin = admin_result.scalar_one_or_none()
    if admin:
        await email_service.send_comment_notification(
            admin.email,
            post.title,
            comment_data.content,
            current_user.username,
            smtp_config=email_config,
        )
    # 2. 如果是回复，通知被回复的用户
    if comment_data.parent_id:
        parent_result = await db.execute(
            select(Comment)
            .options(selectinload(Comment.user))
            .where(Comment.id == comment_data.parent_id)
        )
        parent_comment = parent_result.scalar_one_or_none()
        if parent_comment and parent_comment.user.email:
            await email_service.send_reply_notification(
                parent_comment.user.email,
                post.title,
                comment_data.content,
                current_user.username,
                smtp_config=email_config,
            )
    
    return response


@router.get("/", response_model=PaginatedResponse[CommentListResponse])
async def get_comments(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """获取评论列表（分页，仅管理员）"""
    # 构建查询
    query = select(Comment).options(
        selectinload(Comment.user),
        selectinload(Comment.post)
    ).where(Comment.is_deleted == False)
    
    # 计算总数
    count_query = select(func.count(Comment.id)).where(Comment.is_deleted == False)
    total = await db.scalar(count_query) or 0
    
    # 分页查询
    query = query.order_by(desc(Comment.created_at)).offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    comments = result.scalars().all()
    
    # 构建分页响应
    comments_data = []
    for comment in comments:
        comment_dict = CommentListResponse.model_validate(comment).model_dump()
        if comment.post:
            comment_dict["post"] = {
                "id": comment.post.id,
                "title": comment.post.title,
                "slug": comment.post.slug
            }
        comments_data.append(comment_dict)
    
    pages = math.ceil(total / size) if total > 0 else 1
    
    return {
        "items": comments_data,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """删除评论（仅管理员）"""
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="评论不存在"
        )
    
    # 软删除
    comment.is_deleted = True
    await db.commit()

    # 更新文章评论数（软删后重查 post，再统计并提交）
    result = await db.execute(select(Post).where(Post.id == comment.post_id))
    post = result.scalar_one_or_none()
    if post:
        post.comment_count = await db.scalar(
            select(func.count(Comment.id))
            .where(Comment.post_id == post.id, Comment.is_deleted == False)
        )
        await db.commit()
