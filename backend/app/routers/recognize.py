import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import get_settings
from app.models.schemas import FoodItem, RecognizeResponse
from app.services.glm_client import guess_mime, recognize_food_image

router = APIRouter(prefix="/api/recognize", tags=["recognize"])


@router.post("", response_model=RecognizeResponse)
async def recognize(file: UploadFile = File(...)) -> RecognizeResponse:
    settings = get_settings()
    if not file.content_type or not file.content_type.startswith("image/"):
        # 允许无 content_type 时按扩展名判断
        if not guess_mime(file.filename or "x.jpg").startswith("image/"):
            raise HTTPException(400, "请上传图片文件")

    data = await file.read()
    if not data:
        raise HTTPException(400, "空文件")
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "图片不能超过 5MB")

    mime = file.content_type or guess_mime(file.filename or "upload.jpg")
    suffix = Path(file.filename or "upload.jpg").suffix.lower() or ".jpg"
    name = f"{uuid.uuid4().hex}{suffix}"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    dest = upload_dir / name
    dest.write_bytes(data)
    # 相对路径便于前端访问 /uploads/...
    photo_path = f"/uploads/{name}"

    try:
        result = await recognize_food_image(data, mime=mime)
    except Exception as exc:
        # 识别失败仍返回可编辑空结果 + 已保存照片
        return RecognizeResponse(
            foods=[],
            total_calories=0,
            model=settings.glm_vision_model,
            raw_text=str(exc),
            photo_path=photo_path,
            parse_ok=False,
        )

    foods = [FoodItem(**f) for f in result["foods"]]
    return RecognizeResponse(
        foods=foods,
        total_calories=result["total_calories"],
        model=result["model"],
        raw_text=result["raw_text"],
        photo_path=photo_path,
        parse_ok=result["parse_ok"],
    )
