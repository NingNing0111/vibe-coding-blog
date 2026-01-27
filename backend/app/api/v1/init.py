from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.config import Config
from app.schemas.config import AllConfigs
from app.core.security import get_password_hash
import json

router = APIRouter()


class SetupRequest(BaseModel):
    """初始化请求，包含管理员信息和配置信息（无需验证码）"""
    email: EmailStr
    username: str
    password: str
    configs: AllConfigs


@router.get("/check")
async def check_initialization(db: AsyncSession = Depends(get_db)):
    """检查系统是否已初始化"""
    # 检查是否有管理员用户
    result = await db.execute(
        select(func.count(User.id)).where(User.role == UserRole.ADMIN)
    )
    admin_count = result.scalar_one_or_none() or 0
    
    return {
        "initialized": admin_count > 0,
        "admin_count": admin_count
    }


@router.post("/setup")
async def setup_system(
    setup_data: SetupRequest,
    db: AsyncSession = Depends(get_db)
):
    """初始化系统（创建管理员账户并设置配置）"""
    # 检查是否已初始化
    result = await db.execute(
        select(func.count(User.id)).where(User.role == UserRole.ADMIN)
    )
    admin_count = result.scalar_one_or_none() or 0
    
    if admin_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="系统已初始化，无法重复初始化"
        )
    
    # 检查用户是否已存在
    result = await db.execute(select(User).where(User.email == setup_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱已被注册"
        )
    
    result = await db.execute(select(User).where(User.username == setup_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该用户名已被使用"
        )
    
    # 创建管理员用户
    hashed_password = get_password_hash(setup_data.password)
    new_admin = User(
        email=setup_data.email,
        username=setup_data.username,
        hashed_password=hashed_password,
        role=UserRole.ADMIN
    )
    db.add(new_admin)
    
    # 保存配置信息
    configs_dict = {}
    
    # 网站基本配置
    configs_dict["site_title"] = setup_data.configs.site_basic.site_title
    configs_dict["site_subtitle"] = setup_data.configs.site_basic.site_subtitle
    configs_dict["site_description"] = setup_data.configs.site_basic.site_description
    configs_dict["site_keywords"] = setup_data.configs.site_basic.site_keywords
    configs_dict["site_logo"] = setup_data.configs.site_basic.site_logo
    configs_dict["site_copyright"] = setup_data.configs.site_basic.site_copyright
    
    # 博主配置
    configs_dict["blogger_avatar"] = setup_data.configs.blogger.blogger_avatar
    configs_dict["blogger_signature"] = setup_data.configs.blogger.blogger_signature
    configs_dict["blogger_socials"] = json.dumps(setup_data.configs.blogger.blogger_socials, ensure_ascii=False)
    
    # OSS配置
    configs_dict["oss_type"] = setup_data.configs.oss.oss_type
    configs_dict["oss_access_key_id"] = setup_data.configs.oss.oss_access_key_id
    configs_dict["oss_secret_access_key"] = setup_data.configs.oss.oss_secret_access_key
    configs_dict["oss_region"] = setup_data.configs.oss.oss_region
    configs_dict["oss_bucket_name"] = setup_data.configs.oss.oss_bucket_name
    configs_dict["oss_endpoint"] = setup_data.configs.oss.oss_endpoint
    
    # 邮箱配置
    configs_dict["smtp_host"] = setup_data.configs.email.smtp_host
    configs_dict["smtp_port"] = str(setup_data.configs.email.smtp_port)
    configs_dict["smtp_user"] = setup_data.configs.email.smtp_user
    configs_dict["smtp_password"] = setup_data.configs.email.smtp_password
    configs_dict["smtp_from_email"] = setup_data.configs.email.smtp_from_email
    
    # LLM配置
    configs_dict["llm_api_key"] = setup_data.configs.llm.llm_api_key
    configs_dict["llm_base_url"] = setup_data.configs.llm.llm_base_url
    configs_dict["llm_model"] = setup_data.configs.llm.llm_model
    
    # 批量创建配置（只保存非空值）
    for key, value in configs_dict.items():
        if value and str(value).strip():  # 只保存非空且非纯空格的值
            new_config = Config(key=key, value=str(value).strip())
            db.add(new_config)
    
    await db.commit()
    await db.refresh(new_admin)
    
    return {
        "message": "系统初始化成功",
        "admin": {
            "id": new_admin.id,
            "email": new_admin.email,
            "username": new_admin.username
        }
    }
