import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    vision_provider: str = os.getenv("VISION_PROVIDER", "openrouter")
    vision_base_url: str = os.getenv("VISION_BASE_URL", "https://openrouter.ai/api/v1")
    vision_api_key: str = os.getenv("VISION_API_KEY", "")
    vision_model: str = os.getenv("VISION_MODEL", "google/gemini-2.0-flash-001")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))

settings = Settings()
