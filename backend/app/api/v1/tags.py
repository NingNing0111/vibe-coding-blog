from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
import json
import re
import math

from app.core.database import get_db
from app.core.redis_client import get_cache, set_cache, delete_cache_pattern
from app.api.dependencies import get_current_admin
from app.schemas.tag import TagCreate, TagResponse
from app.schemas.pagination import PaginatedResponse
from app.models.tag import Tag
from app.models.user import User

router = APIRouter()


def slugify(text: str) -> str:
    """将文本转换为 slug"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text


@router.get("/", response_model=PaginatedResponse[TagResponse])
async def get_tags(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """获取标签列表（分页）"""
    # 尝试从缓存获取
    cache_key = f"tag:list:page:{page}:size:{size}"
    cached = await get_cache(cache_key)
    if cached:
        return json.loads(cached)
    
    # 构建查询
    query = select(Tag).order_by(Tag.name)
    
    # 计算总数
    count_query = select(func.count(Tag.id))
    total = await db.scalar(count_query) or 0
    
    # 分页查询
    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    tags = result.scalars().all()
    
    # 构建分页响应
    tags_data = [TagResponse.model_validate(t).model_dump() for t in tags]
    pages = math.ceil(total / size) if total > 0 else 1
    
    response_data = {
        "items": tags_data,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }
    
    # 缓存结果
    await set_cache(cache_key, json.dumps(response_data, default=str), ttl=600)
    
    return response_data


@router.post("/", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    tag_data: TagCreate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """创建标签（仅管理员）"""
    # 如果没有提供 slug，自动生成
    if not tag_data.slug:
        tag_data.slug = slugify(tag_data.name)
    
    # 检查 slug 是否已存在
    result = await db.execute(select(Tag).where(Tag.slug == tag_data.slug))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该 slug 已被使用"
        )
    
    new_tag = Tag(**tag_data.model_dump())
    db.add(new_tag)
    await db.commit()
    await db.refresh(new_tag)
    
    # 清除缓存（必须在返回前完成）
    await delete_cache_pattern("tag:list*")
    await delete_cache_pattern("post:list:*")
    
    return new_tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """删除标签（仅管理员）"""
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="标签不存在"
        )
    
    await db.delete(tag)
    await db.commit()
    
    # 清除缓存（必须在返回前完成）
    await delete_cache_pattern("tag:list*")
    await delete_cache_pattern("post:list:*")
