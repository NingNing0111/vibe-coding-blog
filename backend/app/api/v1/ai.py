from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import openai
import json
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.config_loader import get_config_value, get_llm_config
from app.api.dependencies import get_current_admin
from app.models.user import User

router = APIRouter()


class PolishRequest(BaseModel):
    content: str
    prompt: Optional[str] = None


@router.post("/polish")
async def polish_content(
    request: PolishRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """AI 文案润色（流式返回）"""
    # 从数据库读取LLM配置
    llm_config = await get_llm_config(db)
    llm_api_key = llm_config.get('llm_api_key', '')
    llm_base_url = llm_config.get('llm_base_url', 'https://api.openai.com/v1')
    llm_model = llm_config.get('llm_model', 'gpt-3.5-turbo')
    
    if not llm_api_key:
        def generate_error():
            yield f"data: {json.dumps({'error': 'OpenAI API 未配置，请前往配置管理页面进行配置'})}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            generate_error(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    # 初始化 OpenAI 客户端
    # 显式创建 httpx.Client 以避免版本兼容性问题
    # 新版本的 httpx 不支持 proxies 参数，所以不传递它
    http_client = httpx.Client(timeout=60.0)
    
    try:
        if llm_base_url and llm_base_url != "https://api.openai.com/v1":
            client = openai.OpenAI(
                api_key=llm_api_key,
                base_url=llm_base_url,
                http_client=http_client
            )
        else:
            client = openai.OpenAI(
                api_key=llm_api_key,
                http_client=http_client
            )
    except Exception as e:
        # 如果显式传递 http_client 失败，尝试不传递它
        # 让 OpenAI SDK 自己创建客户端
        if llm_base_url and llm_base_url != "https://api.openai.com/v1":
            client = openai.OpenAI(
                api_key=llm_api_key,
                base_url=llm_base_url
            )
        else:
            client = openai.OpenAI(api_key=llm_api_key)
    
    # 从配置中获取系统提示词，如果没有配置则使用默认值
    system_prompt = await get_config_value(
        db, 
        "polish_system_prompt", 
        "你是一个专业的文案编辑助手。"
    )
    
    default_prompt = "请帮我润色以下内容，使其更加流畅、专业，保持原意不变："
    prompt = request.prompt or default_prompt
    
    def generate():
        try:
            stream = client.chat.completions.create(
                model=llm_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"{prompt}\n\n{request.content}"}
                ],
                stream=True,
                temperature=0.7
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield f"data: {json.dumps({'content': chunk.choices[0].delta.content})}\n\n"
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
