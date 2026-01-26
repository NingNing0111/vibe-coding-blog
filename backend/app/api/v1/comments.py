from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
from sqlalchemy.orm import selectinload
import math

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_admin
from app.schemas.comment import CommentCreate, CommentResponse, CommentListResponse
from app.schemas.pagination import PaginatedResponse
from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User, UserRole
from app.services.email_service import email_service

router = APIRouter()


def build_comment_tree(comments: List[Comment]) -> List[CommentResponse]:
    """构建评论树结构"""
    comment_dict = {c.id: CommentResponse.model_validate(c) for c in comments}
    root_comments = []
    
    for comment in comments:
        comment_response = comment_dict[comment.id]
        if comment.parent_id:
            parent = comment_dict.get(comment.parent_id)
            if parent:
                if not hasattr(parent, 'replies') or parent.replies is None:
                    parent.replies = []
                parent.replies.append(comment_response)
        else:
            root_comments.append(comment_response)
    
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
    
    # 创建评论
    new_comment = Comment(
        content=comment_data.content,
        post_id=comment_data.post_id,
        user_id=current_user.id,
        parent_id=comment_data.parent_id
    )
    db.add(new_comment)
    
    # 更新文章评论数
    post.comment_count = await db.scalar(
        select(func.count(Comment.id))
        .where(Comment.post_id == post.id, Comment.is_deleted == False)
    ) + 1
    
    await db.commit()
    await db.refresh(new_comment)
    
    # 发送邮件通知
    # 1. 通知管理员有新评论
    admin_result = await db.execute(select(User).where(User.role == UserRole.ADMIN))
    admin = admin_result.scalar_one_or_none()
    if admin:
        await email_service.send_comment_notification(
            admin.email,
            post.title,
            comment_data.content,
            current_user.username
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
                current_user.username
            )
    
    return new_comment


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
    
    # 更新文章评论数
    result = await db.execute(select(Post).where(Post.id == comment.post_id))
    post = result.scalar_one_or_none()
    if post:
        post.comment_count = await db.scalar(
            select(func.count(Comment.id))
            .where(Comment.post_id == post.id, Comment.is_deleted == False)
        )
