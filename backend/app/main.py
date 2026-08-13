from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import init_db
from app.routers import exercise, meals, nutrition, profile, recognize
from app.services.dns_fix import apply_dns_fix

# 本机 DNS 可能劫持至 198.18.x，启动时强制解析智谱域名
apply_dns_fix()

settings = get_settings()
app = FastAPI(title="智膳 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router)
app.include_router(meals.router)
app.include_router(nutrition.router)
app.include_router(recognize.router)
app.include_router(exercise.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "app": "智膳", "vision_model": settings.glm_vision_model}


# 上传图片静态访问
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# 生产环境：托管前端构建产物
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        # API / uploads 已由上面路由处理；其余回落到 index.html
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
