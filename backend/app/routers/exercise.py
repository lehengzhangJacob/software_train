from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.db import get_conn, row_to_dict, rows_to_list
from app.models.schemas import AdoptRequest, ExerciseGenerateRequest, ExerciseSuggestionOut
from app.services.glm_client import generate_exercise_advice

router = APIRouter(prefix="/api/exercise", tags=["exercise"])


@router.get("/suggestions", response_model=list[ExerciseSuggestionOut])
def list_suggestions(
    date: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
) -> list[ExerciseSuggestionOut]:
    uid = user_id or get_settings().default_user_id
    sql = "SELECT * FROM exercise_suggestions WHERE user_id = ?"
    params: list = [uid]
    if date:
        sql += " AND suggestion_date = ?"
        params.append(date)
    sql += " ORDER BY created_at DESC"
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [ExerciseSuggestionOut(**r) for r in rows_to_list(rows)]


@router.get("/reference")
def exercise_reference() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM exercise_calorie_reference ORDER BY category, exercise_id"
        ).fetchall()
    return rows_to_list(rows)


@router.post("/suggest", response_model=ExerciseSuggestionOut)
async def suggest(body: ExerciseGenerateRequest) -> ExerciseSuggestionOut:
    settings = get_settings()
    uid = body.user_id or settings.default_user_id
    day = body.date or datetime.now().strftime("%Y-%m-%d")

    with get_conn() as conn:
        profile = row_to_dict(
            conn.execute(
                "SELECT * FROM user_profile WHERE user_id = ?", (uid,)
            ).fetchone()
        )
        if not profile:
            raise HTTPException(404, "用户不存在")

        daily = row_to_dict(
            conn.execute(
                """
                SELECT * FROM v_daily_nutrition_summary
                WHERE user_id = ? AND record_date = ?
                """,
                (uid, day),
            ).fetchone()
        )
        intake = float(daily["total_calories"]) if daily else 0.0
        target = float(profile["daily_calorie_target"])
        surplus = intake - target
        weight = float(profile["weight_kg"])

        # 按盈余挑若干候选运动
        refs = rows_to_list(
            conn.execute(
                """
                SELECT * FROM exercise_calorie_reference
                WHERE category IN ('aerobic', 'other')
                ORDER BY exercise_id
                """
            ).fetchall()
        )

    candidates = []
    burn_goal = abs(surplus) if abs(surplus) > 50 else 150
    for ref in refs:
        per30 = float(ref["calories_per_30min"]) * weight / 60.0
        minutes = max(15, round(burn_goal / per30 * 30)) if per30 > 0 else 30
        minutes = min(minutes, 90)
        candidates.append(
            {
                "exercise_name": ref["exercise_name"],
                "category": ref["category"],
                "estimated_cal_per_30min": round(per30, 1),
                "suggested_minutes": minutes,
                "estimated_burn": round(per30 * minutes / 30, 1),
            }
        )
    # 取接近目标消耗的前 6 个
    candidates.sort(key=lambda c: abs(c["estimated_burn"] - burn_goal))
    candidates = candidates[:6]

    try:
        advice = await generate_exercise_advice(
            username=profile["username"],
            gender=profile["gender"],
            age=int(profile["age"]),
            weight_kg=weight,
            height_cm=float(profile["height_cm"]),
            bmr=profile.get("bmr"),
            calorie_intake=intake,
            calorie_target=int(target),
            calorie_surplus=surplus,
            candidates=candidates,
        )
    except Exception:
        # GLM 不可用时仍用本地参考表给出可演示建议
        top = candidates[0] if candidates else {
            "exercise_name": "步行（中速，5.6km/h）",
            "suggested_minutes": 30,
            "estimated_burn": 110,
        }
        advice = {
            "exercise_type": top.get("exercise_name") or "步行",
            "duration_minutes": int(top.get("suggested_minutes") or 30),
            "calorie_burn_estimate": float(top.get("estimated_burn") or 110),
            "intensity": "moderate" if surplus > 0 else "low",
            "suggestion_detail": (
                f"今日摄入 {intake:.0f} kcal，目标 {target:.0f} kcal，"
                f"差值 {surplus:.0f} kcal。建议进行"
                f"{top.get('exercise_name')} 约 {top.get('suggested_minutes')} 分钟"
                f"（预估消耗约 {top.get('estimated_burn')} kcal）。"
            ),
        }

    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO exercise_suggestions (
              user_id, suggestion_date, calorie_surplus, exercise_type,
              duration_minutes, calorie_burn_estimate, intensity, suggestion_detail
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                uid,
                day,
                surplus,
                advice["exercise_type"],
                advice["duration_minutes"],
                advice["calorie_burn_estimate"],
                advice["intensity"],
                advice["suggestion_detail"],
            ),
        )
        sid = cur.lastrowid
        row = conn.execute(
            "SELECT * FROM exercise_suggestions WHERE suggestion_id = ?", (sid,)
        ).fetchone()
    return ExerciseSuggestionOut(**row_to_dict(row))  # type: ignore[arg-type]


@router.patch("/suggestions/{suggestion_id}", response_model=ExerciseSuggestionOut)
def adopt_suggestion(suggestion_id: int, body: AdoptRequest) -> ExerciseSuggestionOut:
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE exercise_suggestions SET is_adopted = ? WHERE suggestion_id = ?",
            (body.is_adopted, suggestion_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "建议不存在")
        row = conn.execute(
            "SELECT * FROM exercise_suggestions WHERE suggestion_id = ?",
            (suggestion_id,),
        ).fetchone()
    return ExerciseSuggestionOut(**row_to_dict(row))  # type: ignore[arg-type]
