import json
import os
from pathlib import Path

SETTINGS_FILE = Path("/var/lib/marzban/telegram.json")


def load_settings():
    if SETTINGS_FILE.exists():
        try:
            return json.loads(SETTINGS_FILE.read_text())
        except Exception:
            pass
    return {}


def save_settings(data: dict):
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(data, indent=2))


def get_setting(key: str, default=None):
    settings = load_settings()
    env_key = f"TELEGRAM_{key}" if not key.startswith("TELEGRAM_") else key
    val = settings.get(key, os.environ.get(env_key, default))
    return val


def get_admin_ids():
    val = get_setting("TELEGRAM_ADMIN_ID", "")
    if isinstance(val, list):
        return [int(x) for x in val]
    return [int(x.strip()) for x in str(val).split(",") if x.strip()]
