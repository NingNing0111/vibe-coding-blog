from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.redis_client import get_cache, set_cache, delete_cache_pattern, delete_cache
from app.api.dependencies import get_current_user, get_current_admin, get_optional_admin
from app.schemas.post import PostCreate, PostUpdate, PostResponse, PostListResponse
from app.schemas.pagination import PaginatedResponse
from app.models.post import Post, PostStatus
from app.models.user import User
from app.models.category import Category
from app.models.tag import Tag
from app.models.comment import Comment
import json
import math

router = APIRouter()


@router.get("/published", response_model=PaginatedResponse[PostListResponse])
async def get_published_posts(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    category_id: Optional[int] = None,
    tag_id: Optional[int] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """获取已发布文章列表（不包含草稿）"""
    cache_key = f"post:list:published:page:{page}:size:{size}:category:{category_id}:tag:{tag_id}:search:{search}"
    cached = await get_cache(cache_key)
    if cached:
        return json.loads(cached)

    query = select(Post).options(
        selectinload(Post.author),
        selectinload(Post.categories),
        selectinload(Post.tags)
    ).where(Post.status == PostStatus.PUBLISHED)

    if category_id:
        query = query.join(Post.categories).where(Category.id == category_id)
    if tag_id:
        query = query.join(Post.tags).where(Tag.id == tag_id)
    if search:
        query = query.where(
            (Post.title.ilike(f"%{search}%")) | (Post.content.ilike(f"%{search}%"))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    query = query.order_by(desc(Post.published_at), desc(Post.created_at)).offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    posts = result.scalars().all()

    # 从评论表实时统计评论数，避免与 posts.comment_count 缓存不一致
    post_ids = [p.id for p in posts]
    comment_counts = {}
    if post_ids:
        count_stmt = (
            select(Comment.post_id, func.count(Comment.id).label("cnt"))
            .where(Comment.post_id.in_(post_ids), Comment.is_deleted == False)
            .group_by(Comment.post_id)
        )
        count_result = await db.execute(count_stmt)
        comment_counts = {row.post_id: row.cnt for row in count_result.all()}

    posts_data = []
    for p in posts:
        item = PostListResponse.model_validate(p).model_dump()
        item["comment_count"] = comment_counts.get(p.id, 0)
        posts_data.append(item)
    pages = math.ceil(total / size) if total > 0 else 1

    response_data = {
        "items": posts_data,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }

    await set_cache(cache_key, json.dumps(response_data, default=str), ttl=300)

    return response_data


@router.get("/", response_model=PaginatedResponse[PostListResponse])
async def get_posts(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    category_id: Optional[int] = None,
    tag_id: Optional[int] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_admin: Optional[User] = Depends(get_optional_admin)
):
    """获取文章列表（管理员可以查看所有状态）"""
    # 尝试从缓存获取
    cache_key = f"post:list:page:{page}:size:{size}:category:{category_id}:tag:{tag_id}:search:{search}:status:{status}:admin:{current_admin is not None}"
    cached = await get_cache(cache_key)
    if cached:
        return json.loads(cached)
    
    is_admin = current_admin is not None
    
    # 构建查询
    base_query = select(Post).options(
        selectinload(Post.author),
        selectinload(Post.categories),
        selectinload(Post.tags)
    )
    
    # 如果是管理员且没有指定status，则返回所有状态
    # 否则，按status过滤
    if is_admin and status is None:
        # 管理员且未指定status，返回所有状态
        query = base_query
    elif status == "DRAFT":
        # 只有管理员可以看到草稿
        if not is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
        query = base_query.where(Post.status == PostStatus.DRAFT)
    elif status == "PUBLISHED":
        query = base_query.where(Post.status == PostStatus.PUBLISHED)
    else:
        # 默认只返回已发布的文章
        query = base_query.where(Post.status == PostStatus.PUBLISHED)
    
    if category_id:
        query = query.join(Post.categories).where(Category.id == category_id)
    if tag_id:
        query = query.join(Post.tags).where(Tag.id == tag_id)
    if search:
        query = query.where(
            (Post.title.ilike(f"%{search}%")) | (Post.content.ilike(f"%{search}%"))
        )
    
    # 计算总数（复制查询条件但不包含分页和排序）
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0
    
    # 分页查询
    query = query.order_by(desc(Post.published_at), desc(Post.created_at)).offset((page - 1) * size).limit(size)
    
    result = await db.execute(query)
    posts = result.scalars().all()
    
    # 构建分页响应
    posts_data = [PostListResponse.model_validate(p).model_dump() for p in posts]
    pages = math.ceil(total / size) if total > 0 else 1
    
    response_data = {
        "items": posts_data,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }
    
    # 缓存结果
    await set_cache(cache_key, json.dumps(response_data, default=str), ttl=300)
    
    return response_data


@router.get("/id/{post_id}", response_model=PostResponse)
async def get_post_by_id(
    post_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """通过 ID 获取文章详情（仅管理员，不增加阅读量）"""
    result = await db.execute(
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.categories),
            selectinload(Post.tags)
        )
        .where(Post.id == post_id)
    )
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文章不存在"
        )
    
    # 管理员查看不增加阅读量
    post_data = PostResponse.model_validate(post).model_dump()
    
    return post_data


@router.get("/{slug}", response_model=PostResponse)
async def get_post(slug: str, db: AsyncSession = Depends(get_db)):
    """获取文章详情"""
    # 尝试从缓存获取
    cache_key = f"post:detail:{slug}"
    cached = await get_cache(cache_key)
    if cached:
        return json.loads(cached)
    
    result = await db.execute(
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.categories),
            selectinload(Post.tags)
        )
        .where(Post.slug == slug)
    )
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文章不存在"
        )
    
    # 增加阅读量
    post.view_count += 1
    await db.commit()
    
    # 缓存结果
    post_data = PostResponse.model_validate(post).model_dump()
    await set_cache(cache_key, json.dumps(post_data, default=str), ttl=300)
    
    return post_data


@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: PostCreate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """创建文章（仅管理员）"""
    # 检查 slug 是否已存在
    result = await db.execute(select(Post).where(Post.slug == post_data.slug))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该 slug 已被使用"
        )
    
    # 检查分类是否存在
    if post_data.category_ids:
        result = await db.execute(select(Category).where(Category.id.in_(post_data.category_ids)))
        categories = result.scalars().all()
        if len(categories) != len(post_data.category_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="部分分类不存在"
            )
    else:
        categories = []
    
    # 检查标签是否存在
    if post_data.tag_ids:
        result = await db.execute(select(Tag).where(Tag.id.in_(post_data.tag_ids)))
        tags = result.scalars().all()
        if len(tags) != len(post_data.tag_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="部分标签不存在"
            )
    else:
        tags = []
    
    # 创建文章
    new_post = Post(
        title=post_data.title,
        slug=post_data.slug,
        content=post_data.content,
        excerpt=post_data.excerpt,
        cover_image=post_data.cover_image,
        status=post_data.status,
        author_id=current_user.id,
        published_at=datetime.utcnow() if post_data.status == PostStatus.PUBLISHED.value else None
    )
    new_post.categories = categories
    new_post.tags = tags
    
    db.add(new_post)
    await db.commit()
    await db.refresh(new_post)
    
    # 重新查询以加载关联数据（author, categories, tags）
    result = await db.execute(
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.categories),
            selectinload(Post.tags)
        )
        .where(Post.id == new_post.id)
    )
    post = result.scalar_one()
    
    # 清除相关缓存
    await delete_cache_pattern("post:list:*")
    
    return post


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: int,
    post_data: PostUpdate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """更新文章（仅管理员）"""
    result = await db.execute(
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.categories),
            selectinload(Post.tags)
        )
        .where(Post.id == post_id)
    )
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文章不存在"
        )
    
    # 更新字段
    if post_data.title is not None:
        post.title = post_data.title
    if post_data.slug is not None:
        # 检查新 slug 是否冲突
        if post_data.slug != post.slug:
            result = await db.execute(select(Post).where(Post.slug == post_data.slug))
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="该 slug 已被使用"
                )
        post.slug = post_data.slug
    if post_data.content is not None:
        post.content = post_data.content
    if post_data.excerpt is not None:
        post.excerpt = post_data.excerpt
    if post_data.cover_image is not None:
        post.cover_image = post_data.cover_image
    if post_data.status is not None:
        post.status = post_data.status
        if post_data.status == PostStatus.PUBLISHED.value and not post.published_at:
            post.published_at = datetime.utcnow()
    if post_data.category_ids is not None:
        result = await db.execute(select(Category).where(Category.id.in_(post_data.category_ids)))
        post.categories = result.scalars().all()
    if post_data.tag_ids is not None:
        result = await db.execute(select(Tag).where(Tag.id.in_(post_data.tag_ids)))
        post.tags = result.scalars().all()
    
    await db.commit()
    
    # 重新查询以加载关联数据（author, categories, tags）
    result = await db.execute(
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.categories),
            selectinload(Post.tags)
        )
        .where(Post.id == post_id)
    )
    updated_post = result.scalar_one()
    
    # 清除相关缓存
    await delete_cache_pattern("post:list:*")
    await delete_cache(f"post:detail:{updated_post.slug}")
    
    return updated_post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """删除文章（仅管理员）"""
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文章不存在"
        )
    
    await db.delete(post)
    await db.commit()
    
    # 清除相关缓存
    await delete_cache_pattern("post:list:*")
    await delete_cache(f"post:detail:{post.slug}")
