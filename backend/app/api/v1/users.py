"""用户管理 API（仅管理员）"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
import math

from app.core.database import get_db
from app.api.dependencies import get_current_admin
from app.models.user import User, UserRole
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.pagination import PaginatedResponse

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[UserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None, description="按邮箱或用户名搜索"),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取用户列表（分页，仅管理员）"""
    base = select(User).order_by(User.created_at.desc())
    count_base = select(func.count(User.id))

    if search and search.strip():
        term = f"%{search.strip()}%"
        cond = or_(User.email.ilike(term), User.username.ilike(term))
        base = base.where(cond)
        count_base = count_base.where(cond)

    total = await db.scalar(count_base) or 0
    query = base.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    users = result.scalars().all()

    items = [UserResponse.model_validate(u) for u in users]
    pages = math.ceil(total / size) if total > 0 else 1
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
    }


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取单个用户详情（仅管理员）"""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UserUpdate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """更新用户（仅管理员）：用户名、角色、启用状态"""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    if body.username is not None:
        if body.username.strip() != user.username:
            existing = await db.execute(select(User).where(User.username == body.username.strip()))
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该用户名已被使用")
        user.username = body.username.strip()

    if body.role is not None:
        try:
            user.role = UserRole(body.role)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的角色")

    if body.is_active is not None:
        # 禁止管理员禁用自己
        if user.id == current_user.id and not body.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能禁用当前登录的管理员账户")
        user.is_active = body.is_active

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """删除用户（仅管理员）。不能删除自己。"""
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能删除当前登录的管理员账户")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    await db.delete(user)
    await db.commit()
