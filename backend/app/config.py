from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    glm_api_key: str = ""
    glm_api_base: str = "https://open.bigmodel.cn/api/paas/v4"
    # 支持本地 base64 的视觉模型（glm-4v-flash 通常不支持 base64）
    glm_vision_model: str = "glm-4.1v-thinking-flash"
    glm_text_model: str = "glm-4-flash"
    database_path: str = str(PROJECT_ROOT / "data" / "food_tracker.db")
    upload_dir: str = str(PROJECT_ROOT / "data" / "uploads")
    default_user_id: int = 1
    schema_sql: str = str(PROJECT_ROOT / "database" / "schema.sql")
    init_data_sql: str = str(PROJECT_ROOT / "database" / "init_data.sql")


@lru_cache
def get_settings() -> Settings:
    return Settings()
