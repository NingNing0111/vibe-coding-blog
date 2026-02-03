import boto3
from fastapi import APIRouter, Depends, HTTPException, status, Query
from botocore.exceptions import ClientError
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import Dict, Optional
import mimetypes
import uuid
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db
from app.core.config_loader import get_oss_config
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.media import Media
from app.schemas.media import MediaCreate, MediaResponse

router = APIRouter()


class PresignedUrlRequest(BaseModel):
    """获取预签名URL的请求模型"""
    file_name: str
    file_size: Optional[int] = 0  # 默认为0，兼容旧接口
    file_type: Optional[str] = None


def get_s3_client_from_config(oss_config: Dict[str, str]):
    """根据OSS配置创建S3客户端"""
    oss_type = oss_config.get('oss_type', '').lower()
    
    if oss_type == 's3' or not oss_type:
        # AWS S3
        return boto3.client(
            's3',
            aws_access_key_id=oss_config.get('oss_access_key_id') or settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=oss_config.get('oss_secret_access_key') or settings.AWS_SECRET_ACCESS_KEY,
            region_name=oss_config.get('oss_region') or settings.AWS_REGION
        )
    elif oss_type == 'aliyun':
        # 阿里云OSS（兼容S3协议）
        endpoint = oss_config.get('oss_endpoint', '')
        if not endpoint.startswith('http'):
            endpoint = f'https://{endpoint}'
        return boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=oss_config.get('oss_access_key_id', ''),
            aws_secret_access_key=oss_config.get('oss_secret_access_key', ''),
            region_name=oss_config.get('oss_region', '')
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的OSS类型: {oss_type}"
        )


def generate_file_url(oss_config: Dict[str, str], file_key: str) -> str:
    """生成文件访问URL"""
    oss_type = oss_config.get('oss_type', '').lower()
    bucket_name = oss_config.get('oss_bucket_name') or settings.S3_BUCKET_NAME
    region = oss_config.get('oss_region') or settings.AWS_REGION
    endpoint = oss_config.get('oss_endpoint', '')
    
    if oss_type == 's3' or not oss_type:
        # AWS S3
        return f"https://{bucket_name}.s3.{region}.amazonaws.com/{file_key}"
    elif oss_type == 'aliyun':
        # 阿里云OSS
        if endpoint:
            if not endpoint.startswith('http'):
                endpoint = f'https://{endpoint}'
            return f"{endpoint}/{file_key}"
        else:
            return f"https://{bucket_name}.oss-{region}.aliyuncs.com/{file_key}"
    else:
        # 默认使用endpoint
        if endpoint:
            if not endpoint.startswith('http'):
                endpoint = f'https://{endpoint}'
            return f"{endpoint}/{file_key}"
        return f"https://{bucket_name}.s3.{region}.amazonaws.com/{file_key}"


@router.post("/presigned-url")
async def get_presigned_url(
    request: PresignedUrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """获取 OSS 预签名 URL 用于前端直传"""
    file_name = request.file_name
    file_size = request.file_size or 0
    file_type = request.file_type
    # 从数据库读取OSS配置
    oss_config = await get_oss_config(db)
    
    if not oss_config.get('oss_access_key_id') and not settings.AWS_ACCESS_KEY_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OSS 服务未配置"
        )
    
    bucket_name = oss_config.get('oss_bucket_name') or settings.S3_BUCKET_NAME
    if not bucket_name:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OSS Bucket 未配置"
        )
    
    # 确定存储路径
    path_map = {
        "cover": "blog-assets/cover/",
        "post": "blog-assets/post/",
        "avatar": "blog-assets/avatar/",
        "media": "blog-assets/media/",  # 媒体资源管理
        "book": "blog-assets/books/",   # 书库 epub/封面
    }
    
    # 如果没有指定类型，默认使用media
    if not file_type:
        file_type = "media"
    
    if file_type not in path_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的文件类型"
        )
    
    # 生成唯一文件名
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    file_key = f"{path_map[file_type]}{timestamp}_{unique_id}_{file_name}"
    
    try:
        s3_client = get_s3_client_from_config(oss_config)
        
        # 检测MIME类型
        mime_type, _ = mimetypes.guess_type(file_name)
        if not mime_type:
            mime_type = 'application/octet-stream'
        
        # 生成预签名 URL（有效期 1 小时）
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': file_key,
                'ContentType': mime_type
            },
            ExpiresIn=3600
        )
        
        # 生成访问 URL
        file_url = generate_file_url(oss_config, file_key)
        
        return {
            "presigned_url": presigned_url,
            "file_url": file_url,
            "file_key": file_key
        }
    except ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OSS 操作失败: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成预签名URL失败: {str(e)}"
        )


@router.post("/complete", response_model=MediaResponse)
async def upload_complete(
    media_data: MediaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """上传完成后保存文件信息到数据库"""
    # 检查文件是否已存在
    from sqlalchemy import select
    result = await db.execute(select(Media).where(Media.file_key == media_data.file_key))
    existing_media = result.scalar_one_or_none()
    
    if existing_media:
        # 如果已存在，返回现有记录
        return existing_media
    
    # 创建新记录
    media = Media(
        file_name=media_data.file_name,
        file_size=media_data.file_size,
        file_type=media_data.file_type,
        file_url=media_data.file_url,
        file_key=media_data.file_key,
        uploader_id=current_user.id if current_user else None
    )
    
    db.add(media)
    await db.commit()
    await db.refresh(media)
    
    return media


# 保留旧的接口以兼容现有代码
@router.post("/s3-presigned-url")
async def get_s3_presigned_url_legacy(
    request: PresignedUrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """获取 S3 预签名 URL 用于前端直传（兼容旧接口）"""
    return await get_presigned_url(
        request=request,
        db=db,
        current_user=current_user
    )
