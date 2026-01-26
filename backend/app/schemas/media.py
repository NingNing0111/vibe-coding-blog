from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class MediaBase(BaseModel):
    """媒体资源基础Schema"""
    file_name: str
    file_size: int
    file_type: str
    file_url: str
    file_key: str


class MediaCreate(MediaBase):
    """创建媒体资源Schema"""
    uploader_id: Optional[int] = None


class MediaResponse(MediaBase):
    """媒体资源响应Schema"""
    id: int
    uploader_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
