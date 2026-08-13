from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.db import get_conn, row_to_dict
from app.models.schemas import ProfileOut, ProfileUpdate

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("", response_model=ProfileOut)
def get_profile(user_id: int | None = Query(default=None)) -> ProfileOut:
    uid = user_id or get_settings().default_user_id
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM user_profile WHERE user_id = ?", (uid,)
        ).fetchone()
    if not row:
        raise HTTPException(404, f"用户 {uid} 不存在")
    return ProfileOut(**row_to_dict(row))  # type: ignore[arg-type]


@router.put("", response_model=ProfileOut)
def update_profile(
    body: ProfileUpdate,
    user_id: int | None = Query(default=None),
) -> ProfileOut:
    uid = user_id or get_settings().default_user_id
    data = body.model_dump(exclude_unset=True)
    if not data:
        return get_profile(uid)

    cols = ", ".join(f"{k} = ?" for k in data)
    values = list(data.values()) + [uid]
    with get_conn() as conn:
        cur = conn.execute(
            f"UPDATE user_profile SET {cols} WHERE user_id = ?", values
        )
        if cur.rowcount == 0:
            raise HTTPException(404, f"用户 {uid} 不存在")
        row = conn.execute(
            "SELECT * FROM user_profile WHERE user_id = ?", (uid,)
        ).fetchone()
    return ProfileOut(**row_to_dict(row))  # type: ignore[arg-type]
