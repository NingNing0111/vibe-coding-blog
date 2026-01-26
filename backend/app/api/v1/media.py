from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from typing import Optional
import math

from app.core.database import get_db
from app.api.dependencies import get_current_admin
from app.schemas.media import MediaResponse
from app.schemas.pagination import PaginatedResponse
from app.models.media import Media
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[MediaResponse])
async def get_media_list(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(10, ge=1, le=100, description="每页数量"),
    file_type: Optional[str] = Query(None, description="文件类型过滤（MIME类型，如 image/jpeg）"),
    keyword: Optional[str] = Query(None, description="搜索关键词（文件名）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取媒体资源列表（分页）"""
    # 构建查询
    base_query = select(Media)
    
    # 文件类型过滤
    if file_type:
        base_query = base_query.where(Media.file_type.like(f"%{file_type}%"))
    
    # 关键词搜索（文件名）
    if keyword:
        base_query = base_query.where(Media.file_name.ilike(f"%{keyword}%"))
    
    # 计算总数
    count_query = select(func.count()).select_from(base_query.subquery())
    total = await db.scalar(count_query)
    
    # 分页查询
    query = base_query.order_by(desc(Media.created_at)).offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    media_list = result.scalars().all()
    
    # 构建分页响应
    media_data = [MediaResponse.model_validate(m).model_dump() for m in media_list]
    pages = math.ceil(total / size) if total > 0 else 1
    
    return {
        "items": media_data,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }


@router.get("/{media_id}", response_model=MediaResponse)
async def get_media(
    media_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """获取单个媒体资源详情"""
    result = await db.execute(select(Media).where(Media.id == media_id))
    media = result.scalar_one_or_none()
    
    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="媒体资源不存在"
        )
    
    return media


@router.delete("/{media_id}")
async def delete_media(
    media_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """删除媒体资源"""
    result = await db.execute(select(Media).where(Media.id == media_id))
    media = result.scalar_one_or_none()
    
    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="媒体资源不存在"
        )
    
    # TODO: 可选：从OSS删除文件
    # 这里只删除数据库记录，OSS中的文件保留（避免误删）
    
    await db.delete(media)
    await db.commit()
    
    return {"message": "删除成功"}
