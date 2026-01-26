from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import openai
import json

from app.core.config import settings
from app.api.dependencies import get_current_admin
from app.models.user import User

router = APIRouter()


class PolishRequest(BaseModel):
    content: str
    prompt: Optional[str] = None


@router.post("/polish")
async def polish_content(
    request: PolishRequest,
    current_user: User = Depends(get_current_admin)
):
    """AI 文案润色（流式返回）"""
    if not settings.OPENAI_API_KEY:
        return {"error": "OpenAI API 未配置"}
    
    client = openai.OpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL
    )
    
    default_prompt = "请帮我润色以下内容，使其更加流畅、专业，保持原意不变："
    prompt = request.prompt or default_prompt
    
    def generate():
        try:
            stream = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "你是一个专业的文案编辑助手。"},
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
