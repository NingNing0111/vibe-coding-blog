import random
import json
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.config_loader import get_email_config
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token,
    verify_unsubscribe_token,
)
from app.core.redis_client import get_redis, set_cache, get_cache, delete_cache
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.models.user import User, UserRole
from app.api.dependencies import get_current_user
from app.services.email_service import email_service

router = APIRouter()


@router.post("/send-verification-code", status_code=status.HTTP_200_OK)
async def send_verification_code(email: str, db: AsyncSession = Depends(get_db)):
    """发送邮箱验证码"""
    # 检查邮箱是否已注册，已注册则不发送验证码
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱已被注册"
        )

    # 生成6位验证码
    code = str(random.randint(100000, 999999))
    
    # 存储到 Redis，TTL 5分钟
    redis = await get_redis()
    await set_cache(
        f"email:verify:{email}",
        json.dumps({"code": code, "type": "register"}),
        ttl=300
    )
    
    # 从数据库读取邮箱配置并发送
    email_config = await get_email_config(db)
    await email_service.send_verification_code(email, code, smtp_config=email_config)
    
    response = {"message": "验证码已发送"}
    # 邮箱未配置时在响应里带出验证码，便于开发调试
    if not (email_config.get("smtp_host") and email_config.get("smtp_user") and email_config.get("smtp_password")):
        response["code"] = code
    return response


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """用户注册"""
    # 验证验证码
    redis = await get_redis()
    cache_key = f"email:verify:{user_data.email}"
    cached_data = await get_cache(cache_key)
    
    if not cached_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码已过期或不存在"
        )
    
    verify_data = json.loads(cached_data)
    if verify_data["code"] != user_data.verification_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误"
        )
    
    # 检查用户是否已存在
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱已被注册"
        )
    
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该用户名已被使用"
        )
    
    # 创建用户
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        role=UserRole.USER
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # 删除验证码
    await delete_cache(cache_key)
    
    return new_user


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """用户登录"""
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户已被禁用"
        )
    
    # 生成令牌
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str):
    """刷新访问令牌"""
    payload = verify_token(refresh_token, token_type="refresh")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的刷新令牌"
        )
    
    user_id = payload.get("sub")
    new_access_token = create_access_token(data={"sub": user_id})
    new_refresh_token = create_refresh_token(data={"sub": user_id})
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return current_user


@router.get("/unsubscribe")
async def get_unsubscribe_info(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """根据取消订阅 token 返回邮箱信息，供前端确认页展示（不修改订阅状态）"""
    user_id = verify_unsubscribe_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="链接无效或已过期，请使用邮件中的最新链接",
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )
    return {"email": user.email, "username": user.username}


class UnsubscribeRequest(BaseModel):
    token: str


@router.post("/unsubscribe")
async def unsubscribe(
    body: UnsubscribeRequest,
    db: AsyncSession = Depends(get_db),
):
    """根据取消订阅 token 将用户设为未订阅，不再接收新文章邮件"""
    token = body.token
    user_id = verify_unsubscribe_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="链接无效或已过期，请使用邮件中的最新链接",
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )
    user.is_subscribed = False
    await db.commit()
    return {"message": "已成功取消订阅，您将不再收到新文章通知邮件。"}
