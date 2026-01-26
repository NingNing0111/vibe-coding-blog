from pydantic import BaseModel
from datetime import datetime


class TagCreate(BaseModel):
    name: str
    slug: str


class TagResponse(BaseModel):
    id: int
    name: str
    slug: str
    created_at: datetime

    class Config:
        from_attributes = True
