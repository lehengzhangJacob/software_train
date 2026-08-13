import asyncio
import base64
import json
import logging
import shutil
from pathlib import Path
from typing import Any

import httpx

from app.config import get_settings
from app.services.nutrition_parse import extract_json_object, normalize_foods

logger = logging.getLogger(__name__)

VISION_PROMPT = """你是专业营养估算助手。请分析图片中的食物（可含多种中式菜品）。
严格只输出一个 JSON 对象，不要输出其他文字，格式如下：
{
  "foods": [
    {
      "name": "食物名称",
      "portion": "份量描述，如1碗约200g",
      "calories": 260,
      "protein": 5.2,
      "fat": 0.6,
      "carbs": 57.0,
      "confidence": 0.9
    }
  ],
  "total_calories": 260
}
数值单位：热量千卡，营养素克。尽量估算真实份量。若无法识别，返回空 foods 数组。"""

VISION_FALLBACKS = [
    "glm-4.1v-thinking-flash",
    "glm-4v-plus",
    "glm-4v",
    "glm-4v-flash",
]

# 本机 DNS 常被劫持；curl --resolve 使用该 IP
GLM_RESOLVE_IP = "39.108.52.113"


async def _chat_httpx(
    messages: list[dict[str, Any]],
    model: str,
    temperature: float,
) -> str:
    settings = get_settings()
    url = f"{settings.glm_api_base.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.glm_api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    # 短超时：本机 DNS 劫持时快速失败，交给 curl --resolve
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.post(url, headers=headers, json=body)
        if resp.status_code >= 400:
            raise RuntimeError(f"GLM API 错误 {resp.status_code}: {resp.text[:400]}")
        data = resp.json()
    return _extract_content(data)


async def _chat_curl(
    messages: list[dict[str, Any]],
    model: str,
    temperature: float,
) -> str:
    """当 httpx 因 DNS 劫持失败时，用 curl --resolve 直连。"""
    if not shutil.which("curl"):
        raise RuntimeError("curl 不可用")
    settings = get_settings()
    url = f"{settings.glm_api_base.rstrip('/')}/chat/completions"
    body = json.dumps(
        {"model": model, "messages": messages, "temperature": temperature},
        ensure_ascii=False,
    )
    cmd = [
        "curl",
        "-sS",
        "-m",
        "120",
        "--resolve",
        f"open.bigmodel.cn:443:{GLM_RESOLVE_IP}",
        url,
        "-H",
        f"Authorization: Bearer {settings.glm_api_key}",
        "-H",
        "Content-Type: application/json",
        "-d",
        body,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"curl 调用失败: {stderr.decode()[:300]}")
    data = json.loads(stdout.decode())
    if "error" in data:
        raise RuntimeError(f"GLM API 错误: {data['error']}")
    return _extract_content(data)


def _extract_content(data: dict[str, Any]) -> str:
    try:
        content = data["choices"][0]["message"]["content"]
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    parts.append(item.get("text", ""))
                elif isinstance(item, str):
                    parts.append(item)
            return "\n".join(parts)
        return str(content)
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"GLM 响应格式异常: {data}") from exc


async def _chat(
    messages: list[dict[str, Any]],
    model: str,
    temperature: float = 0.2,
) -> str:
    settings = get_settings()
    if not settings.glm_api_key:
        raise RuntimeError("未配置 GLM_API_KEY")

    # 优先 curl --resolve，规避本机 DNS 劫持；失败再尝试 httpx
    try:
        return await _chat_curl(messages, model, temperature)
    except Exception as curl_exc:  # noqa: BLE001
        logger.warning("curl GLM 调用失败，改用 httpx: %s", curl_exc)
        return await _chat_httpx(messages, model, temperature)


def _image_to_data_url(image_bytes: bytes, mime: str) -> str:
    b64 = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _vision_models() -> list[str]:
    settings = get_settings()
    ordered = [settings.glm_vision_model, *VISION_FALLBACKS]
    seen: set[str] = set()
    result: list[str] = []
    for m in ordered:
        if m and m not in seen:
            seen.add(m)
            result.append(m)
    return result


async def recognize_food_image(
    image_bytes: bytes,
    mime: str = "image/jpeg",
) -> dict[str, Any]:
    data_url = _image_to_data_url(image_bytes, mime)
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_url}},
                {"type": "text", "text": VISION_PROMPT},
            ],
        }
    ]

    last_error: Exception | None = None
    used_model = get_settings().glm_vision_model
    raw = ""
    for model in _vision_models():
        try:
            raw = await _chat(messages, model=model, temperature=0.1)
            used_model = model
            last_error = None
            break
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning("vision model %s failed: %s", model, exc)
            continue

    if last_error is not None and not raw:
        raise last_error

    payload = extract_json_object(raw)
    foods, total, ok = normalize_foods(payload)
    return {
        "foods": foods,
        "total_calories": total,
        "model": used_model,
        "raw_text": raw,
        "parse_ok": ok,
        "raw_json": json.dumps(
            {
                "model": used_model,
                "foods": foods,
                "total_calories": total,
                "raw_text": raw,
            },
            ensure_ascii=False,
        ),
    }


async def generate_exercise_advice(
    *,
    username: str,
    gender: str,
    age: int,
    weight_kg: float,
    height_cm: float,
    bmr: float | None,
    calorie_intake: float,
    calorie_target: int,
    calorie_surplus: float,
    candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    settings = get_settings()
    prompt = f"""你是健身教练。根据用户情况给出今日运动建议。
用户：{username}，性别{gender}，年龄{age}，身高{height_cm}cm，体重{weight_kg}kg，BMR={bmr}。
今日摄入 {calorie_intake} kcal，目标 {calorie_target} kcal，盈余(摄入-目标)={calorie_surplus} kcal。
可选运动参考（已按体重换算）：{json.dumps(candidates, ensure_ascii=False)}

只输出 JSON：
{{
  "exercise_type": "运动名称",
  "duration_minutes": 30,
  "calorie_burn_estimate": 200,
  "intensity": "low|moderate|high",
  "suggestion_detail": "中文详细建议，2-4句"
}}
若盈余为负或接近0，仍给轻度保持建议。"""
    raw = await _chat(
        [{"role": "user", "content": prompt}],
        model=settings.glm_text_model,
        temperature=0.4,
    )
    data = extract_json_object(raw) or {}
    fallback = candidates[0] if candidates else {
        "exercise_name": "步行（中速，5.6km/h）",
        "suggested_minutes": 30,
        "estimated_cal_per_30min": 110,
    }
    intensity = data.get("intensity") or "moderate"
    if intensity not in ("low", "moderate", "high"):
        intensity = "moderate"
    return {
        "exercise_type": str(data.get("exercise_type") or fallback.get("exercise_name") or "步行"),
        "duration_minutes": int(data.get("duration_minutes") or fallback.get("suggested_minutes") or 30),
        "calorie_burn_estimate": float(
            data.get("calorie_burn_estimate")
            or fallback.get("estimated_cal_per_30min")
            or 110
        ),
        "intensity": intensity,
        "suggestion_detail": str(
            data.get("suggestion_detail")
            or f"建议进行适度运动以平衡今日热量。原始回复：{raw[:200]}"
        ),
        "raw_text": raw,
    }


def guess_mime(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(suffix, "image/jpeg")
