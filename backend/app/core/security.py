from datetime import datetime, timedelta
from typing import Optional
from hashlib import sha256
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    # 先尝试直接验证（适用于 <= 72 字节的密码）
    if pwd_context.verify(plain_password, hashed_password):
        return True
    
    # 如果直接验证失败，且密码超过 72 字节，尝试 SHA256 后验证
    password_bytes = plain_password.encode('utf-8')
    if len(password_bytes) > 72:
        password_hash = sha256(password_bytes).hexdigest()
        return pwd_context.verify(password_hash, hashed_password)
    
    return False


def get_password_hash(password: str) -> str:
    """加密密码"""
    # bcrypt 有 72 字节的限制，如果密码超过这个长度，先进行 SHA256 哈希
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        # 对超长密码先进行 SHA256 哈希，然后再用 bcrypt 哈希
        password_hash = sha256(password_bytes).hexdigest()
        return pwd_context.hash(password_hash)
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """创建刷新令牌"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
    """验证令牌"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != token_type:
            return None
        return payload
    except JWTError:
        return None
