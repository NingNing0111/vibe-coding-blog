from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
import json

from app.core.database import get_db
from app.api.dependencies import get_current_admin
from app.schemas.config import (
    ConfigCreate, ConfigUpdate, ConfigResponse, 
    ConfigBatchUpdate, AllConfigs, SiteBasicConfig, 
    BloggerConfig, OSSConfig, BackupConfig, EmailConfig, LLMConfig, PromptConfig, PublicConfigs,
    FriendlyLinksConfig, OpenSourceProjectConfig, HeaderMenuConfig, HeaderMenuItem
)
from app.models.config import Config
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=Dict[str, Any])
async def get_configs(db: AsyncSession = Depends(get_db)):
    """获取所有配置（以字典形式返回）"""
    result = await db.execute(select(Config))
    configs = result.scalars().all()
    
    return {config.key: config.value for config in configs}


@router.get("/{key}", response_model=ConfigResponse)
async def get_config(key: str, db: AsyncSession = Depends(get_db)):
    """获取指定配置"""
    result = await db.execute(select(Config).where(Config.key == key))
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="配置不存在"
        )
    
    return config


@router.post("/", response_model=ConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_config(
    config_data: ConfigCreate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """创建配置（仅管理员）"""
    # 检查 key 是否已存在
    result = await db.execute(select(Config).where(Config.key == config_data.key))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该配置键已存在"
        )
    
    new_config = Config(**config_data.model_dump())
    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)
    
    return new_config


@router.put("/{key}", response_model=ConfigResponse)
async def update_config(
    key: str,
    config_data: ConfigUpdate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """更新配置（仅管理员）"""
    result = await db.execute(select(Config).where(Config.key == key))
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="配置不存在"
        )
    
    update_data = config_data.model_dump(exclude_unset=True)
    for key_attr, value in update_data.items():
        setattr(config, key_attr, value)
    
    await db.commit()
    await db.refresh(config)
    
    return config


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_config(
    key: str,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """删除配置（仅管理员）"""
    result = await db.execute(select(Config).where(Config.key == key))
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="配置不存在"
        )
    
    await db.delete(config)
    await db.commit()


@router.put("/batch", response_model=Dict[str, Any])
async def batch_update_configs(
    batch_data: ConfigBatchUpdate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """批量更新配置（仅管理员）"""
    updated_configs = {}
    
    for key, value in batch_data.configs.items():
        result = await db.execute(select(Config).where(Config.key == key))
        config = result.scalar_one_or_none()
        
        if config:
            # 更新现有配置
            config.value = value
            updated_configs[key] = value
        else:
            # 创建新配置
            new_config = Config(key=key, value=value)
            db.add(new_config)
            updated_configs[key] = value
    
    await db.commit()
    
    # 返回所有配置
    result = await db.execute(select(Config))
    configs = result.scalars().all()
    return {config.key: config.value for config in configs}

def _build_site_basic(configs: Dict[str, Any]) -> SiteBasicConfig:
    return SiteBasicConfig(
        site_title=configs.get("site_title", ""),
        site_subtitle=configs.get("site_subtitle", ""),
        site_description=configs.get("site_description", ""),
        site_keywords=configs.get("site_keywords", ""),
        site_logo=configs.get("site_logo", ""),
        site_copyright=configs.get("site_copyright", ""),
        site_head_script=configs.get("site_head_script", ""),
        site_footer_script=configs.get("site_footer_script", ""),
    )


def _parse_blogger_socials(configs: Dict[str, Any]) -> List[Dict[str, str]]:
    blogger_socials: List[Dict[str, str]] = []
    try:
        if configs.get("blogger_socials"):
            blogger_socials = json.loads(configs["blogger_socials"])
    except (json.JSONDecodeError, TypeError):
        pass
    return blogger_socials


def _build_blogger(configs: Dict[str, Any]) -> BloggerConfig:
    return BloggerConfig(
        blogger_avatar=configs.get("blogger_avatar", ""),
        blogger_signature=configs.get("blogger_signature", ""),
        blogger_socials=_parse_blogger_socials(configs),
    )


def _build_friendly_links(configs: Dict[str, Any]) -> FriendlyLinksConfig:
    links = []
    try:
        if configs.get("friendly_links"):
            links = json.loads(configs["friendly_links"])
    except (json.JSONDecodeError, TypeError):
        pass
    return FriendlyLinksConfig(links=links)


def _build_open_source_projects(configs: Dict[str, Any]) -> List[OpenSourceProjectConfig]:
    """构建开源项目列表，数据以 JSON 字符串形式存储在 open_source_projects 配置键中"""
    projects: List[OpenSourceProjectConfig] = []
    try:
        raw = configs.get("open_source_projects")
        if raw:
            data = json.loads(raw)
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        projects.append(OpenSourceProjectConfig(**item))
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    return projects


def _build_header_menu(configs: Dict[str, Any]) -> HeaderMenuConfig:
    items = []
    try:
        if configs.get("header_menu_items"):
            raw = json.loads(configs["header_menu_items"])
            if isinstance(raw, list):
                items = [HeaderMenuItem(**x) if isinstance(x, dict) else HeaderMenuItem() for x in raw]
    except (json.JSONDecodeError, TypeError):
        pass
    return HeaderMenuConfig(items=items)


def _build_all_configs(configs: Dict[str, Any]) -> AllConfigs:
    oss = OSSConfig(
        oss_type=configs.get("oss_type", ""),
        oss_access_key_id=configs.get("oss_access_key_id", ""),
        oss_secret_access_key=configs.get("oss_secret_access_key", ""),
        oss_region=configs.get("oss_region", ""),
        oss_bucket_name=configs.get("oss_bucket_name", ""),
        oss_endpoint=configs.get("oss_endpoint", ""),
    )

    email = EmailConfig(
        smtp_host=configs.get("smtp_host", ""),
        smtp_port=int(configs.get("smtp_port", "587")) if configs.get("smtp_port") else 587,
        smtp_user=configs.get("smtp_user", ""),
        smtp_password=configs.get("smtp_password", ""),
        smtp_from_email=configs.get("smtp_from_email", ""),
    )

    llm = LLMConfig(
        llm_api_key=configs.get("llm_api_key", ""),
        llm_base_url=configs.get("llm_base_url", "https://api.openai.com/v1"),
        llm_model=configs.get("llm_model", "gpt-3.5-turbo"),
    )

    prompt = PromptConfig(
        polish_system_prompt=configs.get("polish_system_prompt", "你是一个专业的文案编辑助手。"),
    )

    # 备份配置
    def _parse_bool(value: Any, default: bool = False) -> bool:
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

    backup = BackupConfig(
        enabled=_parse_bool(configs.get("backup_enabled"), False),
        interval_days=int(configs.get("backup_interval_days", "7") or 7),
    )

    return AllConfigs(
        site_basic=_build_site_basic(configs),
        blogger=_build_blogger(configs),
        oss=oss,
        backup=backup,
        email=email,
        llm=llm,
        prompt=prompt,
        friendly_links=_build_friendly_links(configs),
        open_source_projects=_build_open_source_projects(configs),
        header_menu=_build_header_menu(configs),
    )


def _build_public_configs(configs: Dict[str, Any]) -> PublicConfigs:
    return PublicConfigs(
        site_basic=_build_site_basic(configs),
        blogger=_build_blogger(configs),
        friendly_links=_build_friendly_links(configs),
        open_source_projects=_build_open_source_projects(configs),
        header_menu=_build_header_menu(configs),
    )


@router.get("/structured/all", response_model=PublicConfigs)
async def get_structured_configs(db: AsyncSession = Depends(get_db)):
    """获取结构化配置（对外公开的部分）"""
    result = await db.execute(select(Config))
    configs = {config.key: config.value for config in result.scalars().all()}
    return _build_public_configs(configs)


@router.get("/structured/all/admin", response_model=AllConfigs)
async def get_admin_structured_configs(
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """获取结构化配置（管理员全量）"""
    result = await db.execute(select(Config))
    configs = {config.key: config.value for config in result.scalars().all()}
    return _build_all_configs(configs)


@router.put("/structured/all", response_model=AllConfigs)
async def update_structured_configs(
    configs_data: AllConfigs,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """更新结构化配置（仅管理员）"""
    # 准备批量更新的配置字典
    configs_dict = {}
    
    # 网站基本配置
    configs_dict["site_title"] = configs_data.site_basic.site_title
    configs_dict["site_subtitle"] = configs_data.site_basic.site_subtitle
    configs_dict["site_description"] = configs_data.site_basic.site_description
    configs_dict["site_keywords"] = configs_data.site_basic.site_keywords
    configs_dict["site_logo"] = configs_data.site_basic.site_logo
    configs_dict["site_copyright"] = configs_data.site_basic.site_copyright
    configs_dict["site_head_script"] = configs_data.site_basic.site_head_script
    configs_dict["site_footer_script"] = configs_data.site_basic.site_footer_script
    
    # 博主配置
    configs_dict["blogger_avatar"] = configs_data.blogger.blogger_avatar
    configs_dict["blogger_signature"] = configs_data.blogger.blogger_signature
    configs_dict["blogger_socials"] = json.dumps(configs_data.blogger.blogger_socials, ensure_ascii=False)
    
    # OSS配置
    configs_dict["oss_type"] = configs_data.oss.oss_type
    configs_dict["oss_access_key_id"] = configs_data.oss.oss_access_key_id
    configs_dict["oss_secret_access_key"] = configs_data.oss.oss_secret_access_key
    configs_dict["oss_region"] = configs_data.oss.oss_region
    configs_dict["oss_bucket_name"] = configs_data.oss.oss_bucket_name
    configs_dict["oss_endpoint"] = configs_data.oss.oss_endpoint

    # 数据备份配置
    configs_dict["backup_enabled"] = "true" if configs_data.backup.enabled else "false"
    configs_dict["backup_interval_days"] = str(configs_data.backup.interval_days)
    
    # 邮箱配置
    configs_dict["smtp_host"] = configs_data.email.smtp_host
    configs_dict["smtp_port"] = str(configs_data.email.smtp_port)
    configs_dict["smtp_user"] = configs_data.email.smtp_user
    configs_dict["smtp_password"] = configs_data.email.smtp_password
    configs_dict["smtp_from_email"] = configs_data.email.smtp_from_email
    
    # LLM配置
    configs_dict["llm_api_key"] = configs_data.llm.llm_api_key
    configs_dict["llm_base_url"] = configs_data.llm.llm_base_url
    configs_dict["llm_model"] = configs_data.llm.llm_model
    
    # 提示词配置
    configs_dict["polish_system_prompt"] = configs_data.prompt.polish_system_prompt
    
    # 友链配置
    configs_dict["friendly_links"] = json.dumps([link.model_dump() for link in configs_data.friendly_links.links], ensure_ascii=False)

    # 首页个人开源项目配置（列表，以 JSON 形式整体存储）
    configs_dict["open_source_projects"] = json.dumps(
        [project.model_dump() for project in configs_data.open_source_projects],
        ensure_ascii=False
    )

    # 首页头部菜单项配置
    configs_dict["header_menu_items"] = json.dumps(
        [item.model_dump() for item in configs_data.header_menu.items],
        ensure_ascii=False
    )
    
    # 批量更新配置
    for key, value in configs_dict.items():
        result = await db.execute(select(Config).where(Config.key == key))
        config = result.scalar_one_or_none()
        
        if config:
            # 更新现有配置
            config.value = value
        else:
            # 创建新配置
            new_config = Config(key=key, value=value)
            db.add(new_config)
    
    await db.commit()
    
    # 返回更新后的结构化配置
    result = await db.execute(select(Config))
    configs = {config.key: config.value for config in result.scalars().all()}
    return _build_all_configs(configs)
