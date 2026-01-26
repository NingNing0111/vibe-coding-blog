from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
import json
import math

from app.core.database import get_db
from app.core.redis_client import get_cache, set_cache, delete_cache_pattern
from app.api.dependencies import get_current_admin
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.schemas.pagination import PaginatedResponse
from app.models.category import Category
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[CategoryResponse])
async def get_categories(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """获取分类列表（分页）"""
    # 尝试从缓存获取
    cache_key = f"category:list:page:{page}:size:{size}"
    cached = await get_cache(cache_key)
    if cached:
        return json.loads(cached)
    
    # 构建查询
    query = select(Category).order_by(Category.name)
    
    # 计算总数
    count_query = select(func.count(Category.id))
    total = await db.scalar(count_query) or 0
    
    # 分页查询
    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    categories = result.scalars().all()
    
    # 构建分页响应
    categories_data = [CategoryResponse.model_validate(c).model_dump() for c in categories]
    pages = math.ceil(total / size) if total > 0 else 1
    
    response_data = {
        "items": categories_data,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }
    
    # 缓存结果
    await set_cache(cache_key, json.dumps(response_data, default=str), ttl=600)
    
    return response_data


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: int, db: AsyncSession = Depends(get_db)):
    """获取分类详情"""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分类不存在"
        )
    
    return category


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """创建分类（仅管理员）"""
    # 检查 slug 是否已存在
    result = await db.execute(select(Category).where(Category.slug == category_data.slug))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该 slug 已被使用"
        )
    
    # 检查父分类是否存在
    if category_data.parent_id:
        result = await db.execute(select(Category).where(Category.id == category_data.parent_id))
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="父分类不存在"
            )
    
    new_category = Category(**category_data.model_dump())
    db.add(new_category)
    await db.commit()
    await db.refresh(new_category)
    
    # 清除缓存
    await delete_cache_pattern("category:list")
    await delete_cache_pattern("post:list:*")
    
    return new_category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """更新分类（仅管理员）"""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分类不存在"
        )
    
    # 更新字段
    update_data = category_data.model_dump(exclude_unset=True)
    if "slug" in update_data and update_data["slug"] != category.slug:
        # 检查新 slug 是否冲突
        result = await db.execute(select(Category).where(Category.slug == update_data["slug"]))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该 slug 已被使用"
            )
    
    if "parent_id" in update_data and update_data["parent_id"]:
        result = await db.execute(select(Category).where(Category.id == update_data["parent_id"]))
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="父分类不存在"
            )
    
    for key, value in update_data.items():
        setattr(category, key, value)
    
    await db.commit()
    await db.refresh(category)
    
    # 清除缓存
    await delete_cache_pattern("category:list")
    await delete_cache_pattern("post:list:*")
    
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """删除分类（仅管理员）"""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分类不存在"
        )
    
    # 检查是否有子分类
    result = await db.execute(select(Category).where(Category.parent_id == category_id))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该分类下存在子分类，无法删除"
        )
    
    await db.delete(category)
    await db.commit()
    
    # 清除缓存
    await delete_cache_pattern("category:list")
    await delete_cache_pattern("post:list:*")
