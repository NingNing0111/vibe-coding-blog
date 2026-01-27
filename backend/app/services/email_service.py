import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Template
from typing import Optional, Dict, Any

from app.core.config import settings


def _effective_smtp_config(smtp_config: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """优先使用传入的 DB 配置，否则回退到 settings（与 config_loader.get_email_config 的 key 一致）"""
    if smtp_config and smtp_config.get("smtp_host") and smtp_config.get("smtp_user") and smtp_config.get("smtp_password"):
        return smtp_config
    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        return {
            "smtp_host": settings.SMTP_HOST,
            "smtp_port": getattr(settings, "SMTP_PORT", 587),
            "smtp_user": settings.SMTP_USER,
            "smtp_password": settings.SMTP_PASSWORD,
            "smtp_from_email": getattr(settings, "SMTP_FROM_EMAIL", "") or settings.SMTP_USER,
        }
    return None


class EmailService:
    def __init__(self):
        self.enabled = bool(
            settings.SMTP_HOST and
            settings.SMTP_USER and
            settings.SMTP_PASSWORD
        )
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        smtp_config: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """发送邮件。smtp_config 优先从数据库传入（如 get_email_config(db)），未传则用 settings"""
        cfg = _effective_smtp_config(smtp_config)
        if not cfg:
            print(f"[邮件服务未配置] 发送邮件到 {to_email}: {subject}")
            return False
        
        try:
            message = MIMEMultipart("alternative")
            message["From"] = cfg.get("smtp_from_email") or cfg.get("smtp_user", "")
            message["To"] = to_email
            message["Subject"] = subject
            
            if text_content:
                message.attach(MIMEText(text_content, "plain"))
            message.attach(MIMEText(html_content, "html"))
            
            await aiosmtplib.send(
                message,
                hostname=cfg["smtp_host"],
                port=int(cfg.get("smtp_port", 587)),
                username=cfg["smtp_user"],
                password=cfg["smtp_password"],
                use_tls=True,
            )
            return True
        except Exception as e:
            print(f"发送邮件失败: {str(e)}")
            return False
    
    async def send_verification_code(
        self,
        to_email: str,
        code: str,
        smtp_config: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """发送验证码。传入 smtp_config 时优先用数据库配置"""
        subject = "注册验证码"
        html_content = f"""
        <html>
          <body>
            <h2>注册验证码</h2>
            <p>您的验证码是：<strong>{code}</strong></p>
            <p>验证码有效期为 5 分钟。</p>
          </body>
        </html>
        """
        return await self.send_email(to_email, subject, html_content, smtp_config=smtp_config)
    
    async def send_comment_notification(
        self,
        to_email: str,
        post_title: str,
        comment_content: str,
        commenter_name: str,
        smtp_config: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """发送评论通知（给管理员）。传入 smtp_config 时优先用数据库配置"""
        subject = f"新评论：{post_title}"
        html_content = f"""
        <html>
          <body>
            <h2>新评论通知</h2>
            <p>文章《{post_title}》收到新评论：</p>
            <p><strong>{commenter_name}</strong> 说：</p>
            <p>{comment_content}</p>
          </body>
        </html>
        """
        return await self.send_email(to_email, subject, html_content, smtp_config=smtp_config)
    
    async def send_reply_notification(
        self,
        to_email: str,
        post_title: str,
        reply_content: str,
        replier_name: str,
        smtp_config: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """发送回复通知（给被回复的用户）。传入 smtp_config 时优先用数据库配置"""
        subject = f"您的评论收到回复：{post_title}"
        html_content = f"""
        <html>
          <body>
            <h2>评论回复通知</h2>
            <p>您在文章《{post_title}》的评论收到回复：</p>
            <p><strong>{replier_name}</strong> 回复：</p>
            <p>{reply_content}</p>
          </body>
        </html>
        """
        return await self.send_email(to_email, subject, html_content, smtp_config=smtp_config)


email_service = EmailService()
