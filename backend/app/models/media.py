from sqlalchemy import Column, Integer, String, DateTime, BigInteger
from datetime import datetime

from app.core.database import Base


class Media(Base):
    __tablename__ = "media"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, nullable=False, index=True)
    file_size = Column(BigInteger, nullable=False)  # 文件大小（字节）
    file_type = Column(String, nullable=False)  # MIME类型，如 image/jpeg, application/pdf
    file_url = Column(String, nullable=False)  # OSS URL
    file_key = Column(String, nullable=False, unique=True, index=True)  # OSS中的key
    uploader_id = Column(Integer, nullable=True)  # 上传者ID（可选）
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
