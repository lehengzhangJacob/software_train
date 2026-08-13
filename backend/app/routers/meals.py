from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.db import get_conn, row_to_dict, rows_to_list
from app.models.schemas import MealCreate, MealOut, MealUpdate

router = APIRouter(prefix="/api/meals", tags=["meals"])


@router.get("", response_model=list[MealOut])
def list_meals(
    date: str | None = Query(default=None, description="YYYY-MM-DD"),
    user_id: int | None = Query(default=None),
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
) -> list[MealOut]:
    uid = user_id or get_settings().default_user_id
    sql = "SELECT * FROM meal_records WHERE user_id = ?"
    params: list = [uid]
    if date:
        sql += " AND record_date = ?"
        params.append(date)
    if from_date:
        sql += " AND record_date >= ?"
        params.append(from_date)
    if to_date:
        sql += " AND record_date <= ?"
        params.append(to_date)
    sql += """
      ORDER BY record_date,
        CASE meal_type
          WHEN 'breakfast' THEN 1
          WHEN 'lunch' THEN 2
          WHEN 'dinner' THEN 3
          WHEN 'snack' THEN 4
        END,
        record_time
    """
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [MealOut(**r) for r in rows_to_list(rows)]


@router.get("/dates")
def meal_dates(
    year: int | None = None,
    month: int | None = None,
    user_id: int | None = Query(default=None),
) -> list[str]:
    uid = user_id or get_settings().default_user_id
    sql = "SELECT DISTINCT record_date FROM meal_records WHERE user_id = ?"
    params: list = [uid]
    if year and month:
        sql += " AND strftime('%Y', record_date) = ? AND strftime('%m', record_date) = ?"
        params.extend([str(year), f"{month:02d}"])
    sql += " ORDER BY record_date"
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [r["record_date"] for r in rows]


@router.get("/{record_id}", response_model=MealOut)
def get_meal(record_id: int) -> MealOut:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM meal_records WHERE record_id = ?", (record_id,)
        ).fetchone()
    if not row:
        raise HTTPException(404, "记录不存在")
    return MealOut(**row_to_dict(row))  # type: ignore[arg-type]


@router.post("", response_model=MealOut)
def create_meal(body: MealCreate) -> MealOut:
    settings = get_settings()
    uid = body.user_id or settings.default_user_id
    now = datetime.now()
    record_date = body.record_date or now.strftime("%Y-%m-%d")
    record_time = body.record_time or now.strftime("%H:%M:%S")

    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO meal_records (
              user_id, food_name, meal_type, calories, protein_g, fat_g, carbs_g,
              portion_desc, photo_path, recognition_raw, record_date, record_time, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                uid,
                body.food_name,
                body.meal_type,
                body.calories,
                body.protein_g,
                body.fat_g,
                body.carbs_g,
                body.portion_desc,
                body.photo_path,
                body.recognition_raw,
                record_date,
                record_time,
                body.notes,
            ),
        )
        rid = cur.lastrowid
        row = conn.execute(
            "SELECT * FROM meal_records WHERE record_id = ?", (rid,)
        ).fetchone()
    return MealOut(**row_to_dict(row))  # type: ignore[arg-type]


@router.put("/{record_id}", response_model=MealOut)
def update_meal(record_id: int, body: MealUpdate) -> MealOut:
    data = body.model_dump(exclude_unset=True)
    if not data:
        return get_meal(record_id)
    cols = ", ".join(f"{k} = ?" for k in data)
    values = list(data.values()) + [record_id]
    with get_conn() as conn:
        cur = conn.execute(
            f"UPDATE meal_records SET {cols} WHERE record_id = ?", values
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "记录不存在")
        row = conn.execute(
            "SELECT * FROM meal_records WHERE record_id = ?", (record_id,)
        ).fetchone()
    return MealOut(**row_to_dict(row))  # type: ignore[arg-type]


@router.delete("/{record_id}")
def delete_meal(record_id: int) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM meal_records WHERE record_id = ?", (record_id,)
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "记录不存在")
    return {"ok": True, "record_id": record_id}
