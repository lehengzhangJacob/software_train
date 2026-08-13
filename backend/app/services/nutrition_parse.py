import json
import re
from typing import Any


def extract_json_object(text: str) -> dict[str, Any] | None:
    """从模型输出中提取 JSON 对象。"""
    if not text:
        return None
    text = text.strip()
    # 去掉 markdown 代码块
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            data = json.loads(text[start : end + 1])
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            return None
    return None


def normalize_foods(payload: dict[str, Any] | None) -> tuple[list[dict[str, Any]], float, bool]:
    if not payload:
        return [], 0.0, False
    foods_raw = payload.get("foods") or payload.get("items") or []
    foods: list[dict[str, Any]] = []
    for item in foods_raw:
        if not isinstance(item, dict):
            continue
        foods.append(
            {
                "name": str(item.get("name") or item.get("food_name") or "未知食物"),
                "portion": str(item.get("portion") or item.get("portion_desc") or ""),
                "calories": float(item.get("calories") or item.get("kcal") or 0),
                "protein": float(item.get("protein") or item.get("protein_g") or 0),
                "fat": float(item.get("fat") or item.get("fat_g") or 0),
                "carbs": float(item.get("carbs") or item.get("carbs_g") or item.get("carbohydrates") or 0),
                "confidence": item.get("confidence"),
            }
        )
    total = payload.get("total_calories")
    if total is None:
        total = sum(f["calories"] for f in foods)
    else:
        total = float(total)
    return foods, total, bool(foods)
