"""书库 API：书籍 CRUD、列表检索（需登录）、阅读进度"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, delete
from sqlalchemy.orm import selectinload, joinedload
from typing import Optional
import math

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_admin
from app.schemas.book import (
    BookCreate,
    BookUpdate,
    BookResponse,
    BookCategoryResponse,
    BookReadingProgressUpdate,
    BookReadingProgressResponse,
    BookAnnotationCreate,
    BookAnnotationUpdate,
    BookAnnotationResponse,
)
from app.schemas.pagination import PaginatedResponse
from app.models.book import Book, BookCategory, BookReadingProgress, BookAnnotation, book_categories
from app.models.user import User

router = APIRouter()

# epub MIME
EPUB_MIME = "application/epub+zip"


def _book_to_response(book: Book, include_categories: bool = True) -> dict:
    data = {
        "id": book.id,
        "title": book.title,
        "author": book.author,
        "cover_url": book.cover_url,
        "file_url": book.file_url,
        "file_key": book.file_key,
        "file_size": book.file_size,
        "uploader_id": book.uploader_id,
        "created_at": book.created_at,
        "updated_at": book.updated_at,
    }
    if include_categories and book.categories:
        data["categories"] = [BookCategoryResponse.model_validate(c) for c in book.categories]
    else:
        data["categories"] = []
    return data


# ---------- 读者/登录用户：书架列表、书籍详情、阅读进度 ----------


@router.get("/", response_model=PaginatedResponse[BookResponse])
async def list_books(
    page: int = Query(1, ge=1),
    size: int = Query(12, ge=1, le=100),
    category_id: Optional[int] = Query(None, description="按分类筛选"),
    keyword: Optional[str] = Query(None, description="按书名/作者检索"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """书架列表：分页、按分类、按书名/作者检索（仅登录用户）"""
    query = select(Book).options(selectinload(Book.categories))
    if category_id is not None:
        query = query.join(Book.categories).where(BookCategory.id == category_id).distinct()
    if keyword and keyword.strip():
        q = keyword.strip()
        query = query.where(or_(Book.title.ilike(f"%{q}%"), Book.author.ilike(f"%{q}%")))
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0
    query = query.order_by(desc(Book.created_at)).offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    books = result.unique().scalars().all()
    items = [_book_to_response(b) for b in books]
    pages = math.ceil(total / size) if total > 0 else 1
    return {"items": items, "total": total, "page": page, "size": size, "pages": pages}


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """书籍详情（仅登录用户）"""
    result = await db.execute(
        select(Book).options(selectinload(Book.categories)).where(Book.id == book_id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")
    return _book_to_response(book)


@router.get("/{book_id}/progress", response_model=Optional[BookReadingProgressResponse])
async def get_reading_progress(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户对某书的阅读进度"""
    result = await db.execute(
        select(BookReadingProgress).where(
            BookReadingProgress.book_id == book_id,
            BookReadingProgress.user_id == current_user.id,
        )
    )
    progress = result.scalar_one_or_none()
    if not progress:
        return None
    return progress


@router.put("/{book_id}/progress", response_model=BookReadingProgressResponse)
async def update_reading_progress(
    book_id: int,
    data: BookReadingProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新当前用户对某书的阅读进度（upsert）"""
    result = await db.execute(select(Book).where(Book.id == book_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")
    result = await db.execute(
        select(BookReadingProgress).where(
            BookReadingProgress.book_id == book_id,
            BookReadingProgress.user_id == current_user.id,
        )
    )
    progress = result.scalar_one_or_none()
    if progress:
        if data.current_position is not None:
            progress.current_position = data.current_position
        if data.reading_duration_seconds is not None:
            progress.reading_duration_seconds = data.reading_duration_seconds
        await db.commit()
        await db.refresh(progress)
        return progress
    progress = BookReadingProgress(
        user_id=current_user.id,
        book_id=book_id,
        current_position=data.current_position,
        reading_duration_seconds=data.reading_duration_seconds or 0,
    )
    db.add(progress)
    await db.commit()
    await db.refresh(progress)
    return progress


# ---------- 划线注解（所有人可见，仅登录用户可创建/改删自己的） ----------


@router.get("/{book_id}/annotations", response_model=list[BookAnnotationResponse])
async def list_book_annotations(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取某本书的全部划线注解（所有人可见）"""
    result = await db.execute(select(Book).where(Book.id == book_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")
    result = await db.execute(
        select(BookAnnotation)
        .options(joinedload(BookAnnotation.user))
        .where(BookAnnotation.book_id == book_id)
        .order_by(BookAnnotation.created_at)
    )
    annotations = result.unique().scalars().all()
    return [
        BookAnnotationResponse(
            id=a.id,
            book_id=a.book_id,
            user_id=a.user_id,
            username=a.user.username if a.user else None,
            cfi_range=a.cfi_range,
            selected_text=a.selected_text,
            note=a.note,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in annotations
    ]


@router.post("/{book_id}/annotations", response_model=BookAnnotationResponse, status_code=status.HTTP_201_CREATED)
async def create_book_annotation(
    book_id: int,
    data: BookAnnotationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建划线注解"""
    result = await db.execute(select(Book).where(Book.id == book_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")
    ann = BookAnnotation(
        book_id=book_id,
        user_id=current_user.id,
        cfi_range=data.cfi_range,
        selected_text=data.selected_text,
        note=data.note,
    )
    db.add(ann)
    await db.commit()
    await db.refresh(ann)
    return BookAnnotationResponse(
        id=ann.id,
        book_id=ann.book_id,
        user_id=ann.user_id,
        username=current_user.username,
        cfi_range=ann.cfi_range,
        selected_text=ann.selected_text,
        note=ann.note,
        created_at=ann.created_at,
        updated_at=ann.updated_at,
    )


@router.put("/{book_id}/annotations/{annotation_id}", response_model=BookAnnotationResponse)
async def update_book_annotation(
    book_id: int,
    annotation_id: int,
    data: BookAnnotationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新自己的划线注解"""
    result = await db.execute(
        select(BookAnnotation)
        .options(joinedload(BookAnnotation.user))
        .where(BookAnnotation.id == annotation_id, BookAnnotation.book_id == book_id)
    )
    ann = result.scalar_one_or_none()
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注解不存在")
    if ann.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能修改自己的注解")
    if data.note is not None:
        ann.note = data.note
    await db.commit()
    await db.refresh(ann)
    return BookAnnotationResponse(
        id=ann.id,
        book_id=ann.book_id,
        user_id=ann.user_id,
        username=ann.user.username if ann.user else None,
        cfi_range=ann.cfi_range,
        selected_text=ann.selected_text,
        note=ann.note,
        created_at=ann.created_at,
        updated_at=ann.updated_at,
    )


@router.delete("/{book_id}/annotations/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book_annotation(
    book_id: int,
    annotation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除自己的划线注解"""
    result = await db.execute(
        select(BookAnnotation).where(
            BookAnnotation.id == annotation_id,
            BookAnnotation.book_id == book_id,
        )
    )
    ann = result.scalar_one_or_none()
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="注解不存在")
    if ann.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能删除自己的注解")
    await db.delete(ann)
    await db.commit()


# ---------- 管理员：书籍 CRUD ----------


@router.post("/", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def create_book(
    data: BookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """创建书籍（仅管理员），仅支持 epub"""
    category_ids = data.category_ids or []
    if category_ids:
        r = await db.execute(select(BookCategory).where(BookCategory.id.in_(category_ids)))
        if r.scalars().all().__len__() != len(category_ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="部分分类不存在")
    book = Book(
        title=data.title,
        author=data.author,
        cover_url=data.cover_url,
        file_url=data.file_url,
        file_key=data.file_key,
        file_size=data.file_size,
        uploader_id=current_user.id,
    )
    db.add(book)
    await db.flush()
    for cid in category_ids:
        await db.execute(book_categories.insert().values(book_id=book.id, category_id=cid))
    await db.commit()
    result = await db.execute(select(Book).options(selectinload(Book.categories)).where(Book.id == book.id))
    book = result.scalar_one_or_none()
    return _book_to_response(book)


@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: int,
    data: BookUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """更新书籍（仅管理员）"""
    result = await db.execute(select(Book).options(selectinload(Book.categories)).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")
    update_data = data.model_dump(exclude_unset=True)
    category_ids = update_data.pop("category_ids", None)
    for k, v in update_data.items():
        setattr(book, k, v)
    if category_ids is not None:
        await db.execute(delete(book_categories).where(book_categories.c.book_id == book_id))
        for cid in category_ids:
            await db.execute(book_categories.insert().values(book_id=book_id, category_id=cid))
    await db.commit()
    await db.refresh(book)
    result = await db.execute(select(Book).options(selectinload(Book.categories)).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    return _book_to_response(book)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """删除书籍（仅管理员）"""
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="书籍不存在")
    await db.delete(book)
    await db.commit()
