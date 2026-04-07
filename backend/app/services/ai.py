from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ai_provider_config import AIProviderConfig

AI_SUMMARY_SYSTEM_PROMPT = """
你是崇实文库的资料摘要助手。
请根据用户提供的文档标题、文件名和正文片段，输出一段适合作为文档摘要的中文简介。
要求：
1. 直接输出摘要正文，不要加标题、前缀、引号或项目符号。
2. 使用简洁自然的中文，适合文库详情页展示。
3. 长度控制在 80 到 160 个汉字之间。
4. 如果正文信息不足，就基于可见内容谨慎概括，不要编造具体数据。
""".strip()


def mask_api_key(api_key: str) -> str:
    normalized = (api_key or "").strip()
    if len(normalized) <= 10:
        return "*" * len(normalized)
    return f"{normalized[:6]}***{normalized[-4:]}"


def list_ai_provider_configs(db: Session) -> list[AIProviderConfig]:
    stmt = select(AIProviderConfig).order_by(
        AIProviderConfig.is_default.desc(),
        AIProviderConfig.is_enabled.desc(),
        AIProviderConfig.created_at.asc(),
    )
    return list(db.scalars(stmt))


def get_default_ai_provider(db: Session) -> AIProviderConfig | None:
    stmt = (
        select(AIProviderConfig)
        .where(AIProviderConfig.is_enabled.is_(True))
        .order_by(AIProviderConfig.is_default.desc(), AIProviderConfig.created_at.asc())
    )
    return db.scalar(stmt)


def set_default_ai_provider(db: Session, target_provider: AIProviderConfig | None) -> None:
    providers = list_ai_provider_configs(db)
    target_id = target_provider.id if target_provider is not None else None
    for provider in providers:
        provider.is_default = provider.id == target_id
    db.flush()


def ensure_default_ai_provider(db: Session) -> None:
    providers = list_ai_provider_configs(db)
    enabled_providers = [provider for provider in providers if provider.is_enabled]
    if not enabled_providers:
        for provider in providers:
            provider.is_default = False
        db.flush()
        return

    default_provider = next((provider for provider in enabled_providers if provider.is_default), None)
    if default_provider is None:
        default_provider = enabled_providers[0]

    set_default_ai_provider(db, default_provider)


def extract_text_from_responses_payload(payload: dict[str, Any]) -> str | None:
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    output_items = payload.get("output")
    if isinstance(output_items, list):
        fragments: list[str] = []
        for item in output_items:
            if not isinstance(item, dict):
                continue
            for content in item.get("content", []) or []:
                if not isinstance(content, dict):
                    continue
                text_value = content.get("text")
                if isinstance(text_value, str) and text_value.strip():
                    fragments.append(text_value.strip())
        if fragments:
            return "\n".join(fragments).strip()
    return None


def extract_text_from_chat_payload(payload: dict[str, Any]) -> str | None:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        return None

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        return None

    message = first_choice.get("message")
    if not isinstance(message, dict):
        return None

    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content.strip()

    if isinstance(content, list):
        fragments: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            text_value = item.get("text")
            if isinstance(text_value, str) and text_value.strip():
                fragments.append(text_value.strip())
        if fragments:
            return "\n".join(fragments).strip()

    return None


def invoke_ai_provider(
    provider: AIProviderConfig,
    *,
    system_prompt: str,
    user_prompt: str,
) -> str:
    base_url = provider.base_url.rstrip("/")
    wire_api = provider.wire_api.strip().lower()

    if wire_api == "responses":
        request_url = f"{base_url}/responses"
        payload: dict[str, Any] = {
            "model": provider.model_name,
            "input": [
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": system_prompt}],
                },
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": user_prompt}],
                },
            ],
        }
        if provider.reasoning_effort:
            payload["reasoning"] = {"effort": provider.reasoning_effort}
    else:
        request_url = f"{base_url}/chat/completions"
        payload = {
            "model": provider.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        if provider.reasoning_effort:
            payload["reasoning_effort"] = provider.reasoning_effort

    request = Request(
        request_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {provider.api_key}",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=40) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="ignore")
        detail = response_body.strip() or exc.reason
        raise RuntimeError(f"AI 接口调用失败：{detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"AI 服务连接失败：{exc.reason}") from exc

    text = extract_text_from_responses_payload(response_payload) or extract_text_from_chat_payload(response_payload)
    if not text:
        raise RuntimeError("AI 接口未返回可用摘要内容")
    return text.strip()


def maybe_generate_document_summary(
    db: Session,
    *,
    suggested_title: str,
    file_name: str,
    preview_text: str | None,
) -> tuple[str | None, str | None]:
    if not preview_text or os.getenv("PYTEST_CURRENT_TEST"):
        return None, None

    provider = get_default_ai_provider(db)
    if provider is None:
        return None, None

    excerpt = preview_text.strip()[:6000]
    if not excerpt:
        return None, None

    user_prompt = (
        f"文档标题：{suggested_title}\n"
        f"文件名：{file_name}\n\n"
        f"正文片段：\n{excerpt}"
    )

    try:
        summary = invoke_ai_provider(
            provider,
            system_prompt=AI_SUMMARY_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
    except Exception as exc:
        provider.last_error = str(exc)[:500]
        db.flush()
        return None, provider.name

    provider.usage_count += 1
    provider.last_used_at = datetime.now(UTC)
    provider.last_error = None
    db.flush()
    return summary, provider.name
