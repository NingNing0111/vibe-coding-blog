"""书库相关模型：书籍分类、书籍、阅读进度"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table, BigInteger
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base

# 书籍与分类多对多
book_categories = Table(
    "book_categories",
    Base.metadata,
    Column("book_id", Integer, ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", Integer, ForeignKey("book_category_list.id", ondelete="CASCADE"), primary_key=True),
)


class BookCategory(Base):
    """书籍分类（书库专用，与文章分类独立）"""
    __tablename__ = "book_category_list"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(64), nullable=False, index=True)
    slug = Column(String(64), unique=True, index=True, nullable=False)
    description = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    books = relationship("Book", secondary=book_categories, back_populates="categories")


class Book(Base):
    """书籍（仅支持 epub）"""
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(256), nullable=False, index=True)
    author = Column(String(128), nullable=True, index=True)
    cover_url = Column(String(512), nullable=True)  # 封面图 URL
    file_url = Column(String(512), nullable=False)  # epub 文件 URL
    file_key = Column(String(512), nullable=False, unique=True, index=True)
    file_size = Column(BigInteger, nullable=False)
    uploader_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    categories = relationship("BookCategory", secondary=book_categories, back_populates="books")
    reading_progress = relationship("BookReadingProgress", back_populates="book", cascade="all, delete-orphan")


class BookReadingProgress(Base):
    """用户阅读进度与阅读时长"""
    __tablename__ = "book_reading_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    current_position = Column(String(512), nullable=True)  # epub 位置，如 CFI 或 chapter+offset
    reading_duration_seconds = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    book = relationship("Book", back_populates="reading_progress")
