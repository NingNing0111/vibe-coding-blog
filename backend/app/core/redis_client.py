import json
import redis.asyncio as redis
from typing import Optional, Any

from app.core.config import settings

redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    global redis_client
    if redis_client is None:
        redis_client = await redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
    return redis_client


async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.close()
        redis_client = None


async def set_cache(key: str, value: Any, ttl: int = 3600):
    """设置缓存"""
    r = await get_redis()
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False)
    await r.setex(key, ttl, value)


async def get_cache(key: str) -> Optional[str]:
    """获取缓存"""
    r = await get_redis()
    return await r.get(key)


async def delete_cache(key: str):
    """删除缓存"""
    r = await get_redis()
    await r.delete(key)


async def delete_cache_pattern(pattern: str):
    """按模式删除缓存"""
    r = await get_redis()
    keys = await r.keys(pattern)
    if keys:
        await r.delete(*keys)
