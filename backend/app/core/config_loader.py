"""
配置读取工具函数
提供便捷的配置读取接口，供服务端使用
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Dict, Any
import json
from app.models.config import Config


async def get_config_value(
    db: AsyncSession,
    key: str,
    default: Optional[str] = None
) -> Optional[str]:
    """
    获取单个配置值
    
    Args:
        db: 数据库会话
        key: 配置键
        default: 默认值（如果配置不存在）
    
    Returns:
        配置值或默认值
    """
    result = await db.execute(select(Config).where(Config.key == key))
    config = result.scalar_one_or_none()
    return config.value if config and config.value else default


async def get_config_dict(db: AsyncSession) -> Dict[str, str]:
    """
    获取所有配置（以字典形式返回）
    
    Args:
        db: 数据库会话
    
    Returns:
        配置字典 {key: value}
    """
    result = await db.execute(select(Config))
    configs = result.scalars().all()
    return {config.key: config.value for config in configs if config.value is not None}


async def get_site_basic_config(db: AsyncSession) -> Dict[str, str]:
    """
    获取网站基本配置
    
    Returns:
        网站基本配置字典
    """
    configs = await get_config_dict(db)
    return {
        'site_title': configs.get('site_title', ''),
        'site_subtitle': configs.get('site_subtitle', ''),
        'site_description': configs.get('site_description', ''),
        'site_keywords': configs.get('site_keywords', ''),
        'site_logo': configs.get('site_logo', ''),
        'site_copyright': configs.get('site_copyright', ''),
        'site_url': configs.get('site_url', ''),
    }


async def get_blogger_config(db: AsyncSession) -> Dict[str, Any]:
    """
    获取博主配置
    
    Returns:
        博主配置字典，包含 avatar, signature, socials
    """
    configs = await get_config_dict(db)
    blogger_socials = []
    try:
        if configs.get('blogger_socials'):
            blogger_socials = json.loads(configs['blogger_socials'])
    except (json.JSONDecodeError, TypeError):
        pass
    
    return {
        'blogger_avatar': configs.get('blogger_avatar', ''),
        'blogger_signature': configs.get('blogger_signature', ''),
        'blogger_socials': blogger_socials,
    }


async def get_oss_config(db: AsyncSession) -> Dict[str, str]:
    """
    获取OSS配置
    
    Returns:
        OSS配置字典
    """
    configs = await get_config_dict(db)
    return {
        'oss_type': configs.get('oss_type', ''),
        'oss_access_key_id': configs.get('oss_access_key_id', ''),
        'oss_secret_access_key': configs.get('oss_secret_access_key', ''),
        'oss_region': configs.get('oss_region', ''),
        'oss_bucket_name': configs.get('oss_bucket_name', ''),
        'oss_endpoint': configs.get('oss_endpoint', ''),
    }


async def get_email_config(db: AsyncSession) -> Dict[str, Any]:
    """
    获取邮箱配置
    
    Returns:
        邮箱配置字典
    """
    configs = await get_config_dict(db)
    return {
        'smtp_host': configs.get('smtp_host', ''),
        'smtp_port': int(configs.get('smtp_port', '587')) if configs.get('smtp_port') else 587,
        'smtp_user': configs.get('smtp_user', ''),
        'smtp_password': configs.get('smtp_password', ''),
        'smtp_from_email': configs.get('smtp_from_email', ''),
    }


async def get_llm_config(db: AsyncSession) -> Dict[str, str]:
    """
    获取LLM API配置
    
    Returns:
        LLM配置字典
    """
    configs = await get_config_dict(db)
    return {
        'llm_api_key': configs.get('llm_api_key', ''),
        'llm_base_url': configs.get('llm_base_url', 'https://api.openai.com/v1'),
        'llm_model': configs.get('llm_model', 'gpt-3.5-turbo'),
    }


def _parse_bool(value, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if s in {"1", "true", "yes", "y", "on"}:
        return True
    if s in {"0", "false", "no", "n", "off"}:
        return False
    return default


async def get_github_trending_config(db: AsyncSession) -> Dict[str, Any]:
    """
    获取 Github 热门仓库爬取与每日热点总结配置
    
    Returns:
        配置字典：enabled, project_summary_prompt, daily_summary_prompt, daily_summary_default_status
    """
    configs = await get_config_dict(db)
    return {
        'github_trending_enabled': _parse_bool(configs.get('github_trending_enabled'), False),
        'github_trending_project_summary_prompt': configs.get('github_trending_project_summary_prompt', ''),
        'github_trending_daily_summary_prompt': configs.get('github_trending_daily_summary_prompt', ''),
        'github_trending_daily_summary_default_status': configs.get('github_trending_daily_summary_default_status', 'DRAFT'),
    }
