from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CommentCreate(BaseModel):
    content: str
    post_id: int
    parent_id: Optional[int] = None


class UserInfo(BaseModel):
    id: int
    username: str
    avatar: Optional[str] = None

    class Config:
        from_attributes = True


class CommentResponse(BaseModel):
    id: int
    content: str
    post_id: int
    user: UserInfo
    parent_id: Optional[int] = None
    replies: List["CommentResponse"] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PostInfo(BaseModel):
    id: int
    title: str
    slug: str

    class Config:
        from_attributes = True


class CommentListResponse(BaseModel):
    """评论列表响应（用于管理后台）"""
    id: int
    content: str
    post_id: int
    post: Optional[PostInfo] = None
    user: UserInfo
    parent_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


CommentResponse.model_rebuild()
