import asyncio
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional

import boto3
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.config import Config
from app.models.user import User
from app.models.post import Post
from app.models.category import Category
from app.models.tag import Tag
from app.models.comment import Comment
from app.models.media import Media


logger = logging.getLogger(__name__)


BACKUP_ENABLED_KEY = "backup_enabled"
BACKUP_INTERVAL_DAYS_KEY = "backup_interval_days"
BACKUP_LAST_RUN_AT_KEY = "backup_last_run_at"


def _get_backup_dir() -> Path:
    """获取备份文件目录（相对于 backend/app/ 上级）"""
    base_dir = Path(__file__).resolve().parent.parent  # backend/app
    backup_dir = base_dir / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


async def _get_backup_settings() -> Tuple[bool, int, Optional[datetime]]:
    """从 configs 表中获取备份配置"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Config).where(
                Config.key.in_(
                    [BACKUP_ENABLED_KEY, BACKUP_INTERVAL_DAYS_KEY, BACKUP_LAST_RUN_AT_KEY]
                )
            )
        )
        rows: List[Config] = result.scalars().all()
        kv: Dict[str, str] = {row.key: row.value for row in rows if row.value is not None}

        enabled = str(kv.get(BACKUP_ENABLED_KEY, "false")).strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        try:
            interval_days = int(kv.get(BACKUP_INTERVAL_DAYS_KEY, "7") or 7)
        except (TypeError, ValueError):
            interval_days = 7

        last_run_at: Optional[datetime] = None
        raw_last = kv.get(BACKUP_LAST_RUN_AT_KEY)
        if raw_last:
            try:
                last_run_at = datetime.fromisoformat(raw_last)
            except ValueError:
                last_run_at = None

        return enabled, interval_days, last_run_at


def _row_to_dict(obj: Any) -> Dict[str, Any]:
    data = {}
    for key, value in obj.__dict__.items():
        if key.startswith("_"):
            continue
        data[key] = value
    return data


async def export_database_to_file() -> Path:
    """将主要业务表导出为 JSON 备份文件"""
    backup_dir = _get_backup_dir()
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    file_path = backup_dir / f"backup_{timestamp}.json"

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = [_row_to_dict(u) for u in result.scalars().all()]

        result = await session.execute(select(Post))
        posts = [_row_to_dict(p) for p in result.scalars().all()]

        result = await session.execute(select(Category))
        categories = [_row_to_dict(c) for c in result.scalars().all()]

        result = await session.execute(select(Tag))
        tags = [_row_to_dict(t) for t in result.scalars().all()]

        result = await session.execute(select(Comment))
        comments = [_row_to_dict(c) for c in result.scalars().all()]

        result = await session.execute(select(Media))
        media_items = [_row_to_dict(m) for m in result.scalars().all()]

        result = await session.execute(select(Config))
        configs = [_row_to_dict(c) for c in result.scalars().all()]

    data = {
        "generated_at": datetime.utcnow().isoformat(),
        "users": users,
        "posts": posts,
        "categories": categories,
        "tags": tags,
        "comments": comments,
        "media": media_items,
        "configs": configs,
    }

    file_path.write_text(json.dumps(data, ensure_ascii=False, default=str, indent=2), encoding="utf-8")

    logger.info("数据库备份已导出到本地文件: %s", file_path)
    return file_path


def upload_backup_to_oss(file_path: Path) -> Optional[str]:
    """
    将备份文件上传到 OSS（目前按 S3 兼容接口实现）
    返回对象 Key，失败时返回 None
    """
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        logger.warning("OSS 上传未配置 AWS 密钥，跳过上传")
        return None

    if not settings.S3_BUCKET_NAME:
        logger.warning("OSS 上传未配置 S3 Bucket，跳过上传")
        return None

    endpoint_url = getattr(settings, "OSS_ENDPOINT", "") or None

    session = boto3.session.Session(
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )

    client = session.client("s3", endpoint_url=endpoint_url)

    object_key = f"backups/{file_path.name}"

    try:
        client.upload_file(str(file_path), settings.S3_BUCKET_NAME, object_key)
        logger.info("备份文件已上传到 OSS: bucket=%s, key=%s", settings.S3_BUCKET_NAME, object_key)
        return object_key
    except Exception as e:
        logger.exception("上传备份文件到 OSS 失败: %s", e)
        return None


async def perform_backup_once() -> None:
    """执行一次完整的备份流程：导出数据库 -> 上传 OSS -> 更新最后执行时间"""
    file_path = await export_database_to_file()
    upload_backup_to_oss(file_path)

    # 更新最后执行时间
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Config).where(Config.key == BACKUP_LAST_RUN_AT_KEY))
        cfg: Optional[Config] = result.scalar_one_or_none()
        now_str = datetime.utcnow().isoformat()
        if cfg:
            cfg.value = now_str
        else:
            cfg = Config(key=BACKUP_LAST_RUN_AT_KEY, value=now_str)
            session.add(cfg)
        await session.commit()


async def backup_scheduler_loop() -> None:
    """
    后台定时任务循环：
    - 读取数据库中的备份配置
    - 满足条件时执行备份
    - 定期休眠后再次检查
    """
    logger.info("数据备份调度任务启动")
    try:
        while True:
            try:
                enabled, interval_days, last_run_at = await _get_backup_settings()
                if not enabled or interval_days <= 0:
                    # 未开启时，每小时检查一次配置是否开启
                    await asyncio.sleep(3600)
                    continue

                now = datetime.utcnow()
                should_run = False
                if last_run_at is None:
                    should_run = True
                else:
                    delta = now - last_run_at
                    if delta >= timedelta(days=interval_days):
                        should_run = True

                if should_run:
                    logger.info("达到数据备份触发条件，开始执行备份")
                    await perform_backup_once()
                # 正常情况下，每小时检查一次是否需要备份
                await asyncio.sleep(3600)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.exception("备份调度任务发生异常: %s", e)
                # 出错时等待一段时间再重试
                await asyncio.sleep(600)
    except asyncio.CancelledError:
        logger.info("数据备份调度任务已取消，准备退出")

