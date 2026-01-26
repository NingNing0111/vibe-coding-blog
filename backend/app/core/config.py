from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, computed_field
from typing import List
import json
import os
from pathlib import Path


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
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    
    model_config = SettingsConfigDict(
        env_file=get_env_file_path(),
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()
