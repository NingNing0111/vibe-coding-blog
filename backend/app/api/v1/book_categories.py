"""书库分类 API（管理员 CRUD）"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import math

from app.core.database import get_db
from app.api.dependencies import get_current_admin, get_current_user
from app.schemas.book import BookCategoryCreate, BookCategoryUpdate, BookCategoryResponse
from app.schemas.pagination import PaginatedResponse
from app.models.book import BookCategory
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[BookCategoryResponse])
async def get_book_categories(
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """获取书库分类列表（分页，管理员）"""
    count_query = select(func.count(BookCategory.id))
    total = await db.scalar(count_query) or 0
    query = (
        select(BookCategory)
        .order_by(BookCategory.name)
        .offset((page - 1) * size)
        .limit(size)
    )
    result = await db.execute(query)
    categories = result.scalars().all()
    items = [BookCategoryResponse.model_validate(c) for c in categories]
    pages = math.ceil(total / size) if total > 0 else 1
    return {"items": items, "total": total, "page": page, "size": size, "pages": pages}


@router.get("/list", response_model=list[BookCategoryResponse])
async def list_all_book_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取全部书库分类（不分页，供书架筛选，需登录）"""
    result = await db.execute(select(BookCategory).order_by(BookCategory.name))
    categories = result.scalars().all()
    return [BookCategoryResponse.model_validate(c) for c in categories]


@router.get("/{category_id}", response_model=BookCategoryResponse)
async def get_book_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """获取书库分类详情"""
    result = await db.execute(select(BookCategory).where(BookCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类不存在")
    return category


@router.post("/", response_model=BookCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_book_category(
    data: BookCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """创建书库分类"""
    result = await db.execute(select(BookCategory).where(BookCategory.slug == data.slug))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该 slug 已被使用")
    category = BookCategory(**data.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.put("/{category_id}", response_model=BookCategoryResponse)
async def update_book_category(
    category_id: int,
    data: BookCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """更新书库分类"""
    result = await db.execute(select(BookCategory).where(BookCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类不存在")
    update_data = data.model_dump(exclude_unset=True)
    if "slug" in update_data and update_data["slug"] != category.slug:
        r = await db.execute(select(BookCategory).where(BookCategory.slug == update_data["slug"]))
        if r.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该 slug 已被使用")
    for k, v in update_data.items():
        setattr(category, k, v)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """删除书库分类"""
    result = await db.execute(select(BookCategory).where(BookCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类不存在")
    await db.delete(category)
    await db.commit()
