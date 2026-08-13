from datetime import datetime, timedelta

from fastapi import APIRouter, Query

from app.config import get_settings
from app.db import get_conn, row_to_dict, rows_to_list
from app.models.schemas import DailyNutrition

router = APIRouter(prefix="/api/nutrition", tags=["nutrition"])


def _empty_daily(uid: int, date: str, profile: dict | None) -> DailyNutrition:
    return DailyNutrition(
        user_id=uid,
        username=profile.get("username") if profile else None,
        record_date=date,
        total_calories=0,
        total_protein_g=0,
        total_fat_g=0,
        total_carbs_g=0,
        meal_count=0,
        daily_calorie_target=int(profile["daily_calorie_target"]) if profile else 2000,
        daily_protein_target=float(profile["daily_protein_target"]) if profile else 60,
        daily_fat_target=float(profile["daily_fat_target"]) if profile else 60,
        daily_carbs_target=float(profile["daily_carbs_target"]) if profile else 250,
        calorie_diff=-float(profile["daily_calorie_target"]) if profile else -2000,
    )


@router.get("/daily", response_model=DailyNutrition)
def daily_nutrition(
    date: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
) -> DailyNutrition:
    uid = user_id or get_settings().default_user_id
    day = date or datetime.now().strftime("%Y-%m-%d")
    with get_conn() as conn:
        profile = row_to_dict(
            conn.execute(
                "SELECT * FROM user_profile WHERE user_id = ?", (uid,)
            ).fetchone()
        )
        row = conn.execute(
            """
            SELECT * FROM v_daily_nutrition_summary
            WHERE user_id = ? AND record_date = ?
            """,
            (uid, day),
        ).fetchone()
    if not row:
        return _empty_daily(uid, day, profile)
    return DailyNutrition(**row_to_dict(row))  # type: ignore[arg-type]


@router.get("/range", response_model=list[DailyNutrition])
def range_nutrition(
    days: int = Query(default=7, ge=1, le=90),
    user_id: int | None = Query(default=None),
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[DailyNutrition]:
    uid = user_id or get_settings().default_user_id
    today = datetime.now().date()
    if not to_date:
        to_date = today.strftime("%Y-%m-%d")
    if not from_date:
        from_date = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")

    with get_conn() as conn:
        profile = row_to_dict(
            conn.execute(
                "SELECT * FROM user_profile WHERE user_id = ?", (uid,)
            ).fetchone()
        )
        rows = rows_to_list(
            conn.execute(
                """
                SELECT * FROM v_daily_nutrition_summary
                WHERE user_id = ? AND record_date >= ? AND record_date <= ?
                ORDER BY record_date
                """,
                (uid, from_date, to_date),
            ).fetchall()
        )

    by_date = {r["record_date"]: r for r in rows}
    start = datetime.strptime(from_date, "%Y-%m-%d").date()
    end = datetime.strptime(to_date, "%Y-%m-%d").date()
    result: list[DailyNutrition] = []
    cur = start
    while cur <= end:
        key = cur.strftime("%Y-%m-%d")
        if key in by_date:
            result.append(DailyNutrition(**by_date[key]))
        else:
            result.append(_empty_daily(uid, key, profile))
        cur += timedelta(days=1)
    return result


@router.get("/meal-type")
def meal_type_summary(
    date: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
) -> list[dict]:
    uid = user_id or get_settings().default_user_id
    day = date or datetime.now().strftime("%Y-%m-%d")
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM v_meal_type_summary
            WHERE user_id = ? AND record_date = ?
            """,
            (uid, day),
        ).fetchall()
    return rows_to_list(rows)
