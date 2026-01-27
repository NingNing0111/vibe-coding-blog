from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime


class ConfigCreate(BaseModel):
    key: str
    value: Optional[str] = None
    description: Optional[str] = None


class ConfigUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = None


class ConfigResponse(BaseModel):
    id: int
    key: str
    value: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConfigBatchUpdate(BaseModel):
    """批量更新配置"""
    configs: Dict[str, Optional[str]]


# 配置结构定义
class SiteBasicConfig(BaseModel):
    """网站基本配置"""
    site_title: str = ""
    site_subtitle: str = ""
    site_description: str = ""
    site_keywords: str = ""
    site_logo: str = ""
    site_copyright: str = ""


class BloggerConfig(BaseModel):
    """个人博主配置"""
    blogger_avatar: str = ""
    blogger_signature: str = ""
    blogger_socials: List[Dict[str, str]] = []  # [{"type": "email", "value": "xxx@example.com"}, ...]


class OSSConfig(BaseModel):
    """OSS服务配置"""
    oss_type: str = ""  # s3, aliyun, qiniu, etc.
    oss_access_key_id: str = ""
    oss_secret_access_key: str = ""
    oss_region: str = ""
    oss_bucket_name: str = ""
    oss_endpoint: str = ""


class EmailConfig(BaseModel):
    """邮箱配置"""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""


class LLMConfig(BaseModel):
    """LLM API配置（OpenAI API规范）"""
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-3.5-turbo"


class PromptConfig(BaseModel):
    """提示词配置"""
    polish_system_prompt: str = "你是一个专业的文案编辑助手。"


class FriendlyLink(BaseModel):
    """友链配置"""
    name: str
    url: str
    description: Optional[str] = ""


class FriendlyLinksConfig(BaseModel):
    """友链列表配置"""
    links: List[FriendlyLink] = []


class AllConfigs(BaseModel):
    """所有配置的集合"""
    site_basic: SiteBasicConfig
    blogger: BloggerConfig
    oss: OSSConfig
    email: EmailConfig
    llm: LLMConfig
    prompt: PromptConfig
    friendly_links: FriendlyLinksConfig


class PublicConfigs(BaseModel):
    """对外可见的配置集合"""
    site_basic: SiteBasicConfig
    blogger: BloggerConfig
    friendly_links: FriendlyLinksConfig
