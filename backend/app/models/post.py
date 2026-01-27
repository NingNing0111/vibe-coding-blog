from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Integer as SQLInteger
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class PostStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    content = Column(Text, nullable=False)
    excerpt = Column(String, nullable=True)
    cover_image = Column(String, nullable=True)
    status = Column(String, default=PostStatus.DRAFT.value, nullable=False)
    view_count = Column(SQLInteger, default=0, nullable=False)
    comment_count = Column(SQLInteger, default=0, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    published_at = Column(DateTime, nullable=True)

    # Relationships
    author = relationship("User", back_populates="posts")
    categories = relationship("Category", secondary="post_categories", back_populates="posts")
    tags = relationship("Tag", secondary="post_tags", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
