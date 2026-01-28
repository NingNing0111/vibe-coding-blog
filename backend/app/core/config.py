from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field
from typing import List, Dict
import json
from pathlib import Path

from sqlalchemy import create_engine, text


def get_env_file_path() -> str:
    """
    获取项目根目录的 .env 文件路径
    优先查找项目根目录的 .env，如果不存在则查找当前目录的 .env
    """
    # 获取当前文件的目录（backend/app/core）
    current_file = Path(__file__)
    # 项目根目录应该是 backend 的父目录
    project_root = current_file.parent.parent.parent.parent
    root_env_file = project_root / ".env"

    # 如果项目根目录存在 .env，使用它
    if root_env_file.exists():
        return str(root_env_file)

    # 否则尝试当前目录的 .env（向后兼容）
    current_env_file = Path(".env")
    if current_env_file.exists():
        return str(current_env_file.absolute())

    # 如果都不存在，返回项目根目录的路径（让 pydantic 使用环境变量）
    return str(root_env_file)


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # JWT
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS - 定义为字符串，避免 pydantic-settings 自动 JSON 解析
    CORS_ORIGINS: str = "http://localhost:3000"
    
    @computed_field
    @property
    def cors_origins_list(self) -> List[str]:
        """将 CORS_ORIGINS 字符串解析为列表"""
        if not self.CORS_ORIGINS or not self.CORS_ORIGINS.strip():
            return ["http://localhost:3000"]
        # 尝试解析 JSON
        try:
            parsed = json.loads(self.CORS_ORIGINS)
            if isinstance(parsed, list):
                return parsed if parsed else ["http://localhost:3000"]
        except (json.JSONDecodeError, TypeError):
            pass
        # 如果不是 JSON，按逗号分割
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(',') if origin.strip()]
        return origins if origins else ["http://localhost:3000"]
    
    # S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = ""
    
    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    
    # OpenAI / LLM
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    # 可选的 OSS 自定义 Endpoint（如阿里云、七牛等的兼容 S3 接口）
    OSS_ENDPOINT: str = ""

    model_config = SettingsConfigDict(
        env_file=get_env_file_path(),
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


# 数据库 configs.key -> Settings 属性名 的映射（与 config_loader / 管理端使用的 key 一致）
_DB_KEY_TO_SETTINGS_ATTR = {
    "secret_key": "SECRET_KEY",
    "access_token_expire_minutes": "ACCESS_TOKEN_EXPIRE_MINUTES",
    "refresh_token_expire_days": "REFRESH_TOKEN_EXPIRE_DAYS",
    "cors_origins": "CORS_ORIGINS",
    "aws_access_key_id": "AWS_ACCESS_KEY_ID",
    "aws_secret_access_key": "AWS_SECRET_ACCESS_KEY",
    "aws_region": "AWS_REGION",
    "s3_bucket_name": "S3_BUCKET_NAME",
    "smtp_host": "SMTP_HOST",
    "smtp_port": "SMTP_PORT",
    "smtp_user": "SMTP_USER",
    "smtp_password": "SMTP_PASSWORD",
    "smtp_from_email": "SMTP_FROM_EMAIL",
    "llm_api_key": "OPENAI_API_KEY",
    "llm_base_url": "OPENAI_BASE_URL",
}
# OSS 使用 oss_ 前缀时也映射到 Settings 的 AWS/S3 字段
_OSS_TO_SETTINGS = {
    "oss_access_key_id": "AWS_ACCESS_KEY_ID",
    "oss_secret_access_key": "AWS_SECRET_ACCESS_KEY",
    "oss_region": "AWS_REGION",
    "oss_bucket_name": "S3_BUCKET_NAME",
    "oss_endpoint": "OSS_ENDPOINT",
}


def _override_settings_from_db(settings: Settings) -> Settings:
    """
    使用数据库 configs 表中的配置覆盖除 DATABASE_URL / REDIS_URL 之外的其它配置。

    - PG / Redis 连接：始终从 .env / 环境变量读取。
    - 其它配置：若数据库中存在对应 key，则覆盖；通过 model_copy(update=...) 生成新实例，确保生效。
    """
    db_url = getattr(settings, "DATABASE_URL", None)
    if not db_url:
        return settings

    sync_db_url = db_url.replace("+asyncpg", "")
    try:
        engine = create_engine(sync_db_url, future=True)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT key, value FROM configs"))
            rows = result.fetchall()
    except Exception:
        return settings

    config_map: Dict[str, str] = {row[0]: row[1] for row in rows if row[1] is not None}

    int_attrs = {"ACCESS_TOKEN_EXPIRE_MINUTES", "REFRESH_TOKEN_EXPIRE_DAYS", "SMTP_PORT"}
    key_to_attr = {**_DB_KEY_TO_SETTINGS_ATTR, **_OSS_TO_SETTINGS}
    overrides: Dict[str, object] = {}

    for db_key, attr_name in key_to_attr.items():
        if db_key not in config_map:
            continue
        raw = config_map[db_key]
        if attr_name in int_attrs:
            try:
                overrides[attr_name] = int(raw)
            except (TypeError, ValueError):
                pass
        else:
            overrides[attr_name] = raw

    if not overrides:
        return settings
    return settings.model_copy(update=overrides)


# 先从 .env / 环境变量构建 Settings（包含 DATABASE_URL / REDIS_URL 等）
_base_settings = Settings()
# 使用数据库中的配置覆盖其它字段
settings = _override_settings_from_db(_base_settings)
