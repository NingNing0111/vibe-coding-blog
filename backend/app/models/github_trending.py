"""GitHub Trending 爬取数据与 LLM 扩展信息表。"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime

from app.core.database import Base


class GitHubTrending(Base):
    """GitHub Trending 原始爬取数据。"""
    __tablename__ = "github_trending"
    __table_args__ = (UniqueConstraint("trend_date", "full_name", name="uq_github_trending_date_name"),)

    id = Column(Integer, primary_key=True, index=True)
    trend_date = Column(Date, nullable=False, index=True)
    full_name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    language = Column(String(64), nullable=True)
    stars = Column(Integer, nullable=True)
    forks = Column(Integer, nullable=True)
    stars_today = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class GitHubTrendingLlm(Base):
    """GitHub Trending 经 LLM 生成的介绍、官网、标签。"""
    __tablename__ = "github_trending_llm"
    __table_args__ = (UniqueConstraint("trend_date", "full_name", name="uq_github_trending_llm_date_name"),)

    id = Column(Integer, primary_key=True, index=True)
    trend_date = Column(Date, nullable=False, index=True)
    full_name = Column(String(255), nullable=False, index=True)
    intro = Column(Text, nullable=True)
    website = Column(Text, nullable=True)
    tags = Column(JSONB, default=list, nullable=False)  # list[str]
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
