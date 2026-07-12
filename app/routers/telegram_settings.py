from fastapi import APIRouter, HTTPException
from app.telegram_settings import load_settings, save_settings, get_setting, get_admin_ids

router = APIRouter(prefix="/api/telegram", tags=["Telegram"])


@router.get("/settings")
def get_telegram_settings():
    return load_settings()


@router.get("/health")
def health_check():
    token = get_setting("TELEGRAM_API_TOKEN")
    return {
        "bot_configured": bool(token),
        "admin_ids": get_admin_ids()
    }
