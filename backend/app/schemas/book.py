"""书库相关 Schema"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ---------- 书籍分类 ----------
class BookCategoryCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None


class BookCategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None


class BookCategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- 书籍 ----------
class BookCreate(BaseModel):
    title: str
    author: Optional[str] = None
    cover_url: Optional[str] = None
    file_url: str
    file_key: str
    file_size: int
    category_ids: Optional[List[int]] = None


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    cover_url: Optional[str] = None
    category_ids: Optional[List[int]] = None


class BookResponse(BaseModel):
    id: int
    title: str
    author: Optional[str] = None
    cover_url: Optional[str] = None
    file_url: str
    file_key: str
    file_size: int
    uploader_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    categories: Optional[List[BookCategoryResponse]] = None

    class Config:
        from_attributes = True


# ---------- 阅读进度 ----------
class BookReadingProgressUpdate(BaseModel):
    current_position: Optional[str] = None
    reading_duration_seconds: Optional[int] = None


class BookReadingProgressResponse(BaseModel):
    id: int
    user_id: int
    book_id: int
    current_position: Optional[str] = None
    reading_duration_seconds: int
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- 划线注解 ----------
class BookAnnotationCreate(BaseModel):
    cfi_range: str
    selected_text: str
    note: Optional[str] = None


class BookAnnotationUpdate(BaseModel):
    note: Optional[str] = None


class BookAnnotationResponse(BaseModel):
    id: int
    book_id: int
    user_id: int
    username: Optional[str] = None
    cfi_range: str
    selected_text: str
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
