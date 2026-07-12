import datetime

from app import logger
from app.db.models import User
from app.telegram import bot
from app.telegram_settings import get_setting, get_admin_ids
from telebot.apihelper import ApiTelegramException
from datetime import datetime
from app.telegram.utils.keyboard import BotKeyboard
from app.utils.system import readable_size
from telebot.formatting import escape_html
from app.models.admin import Admin
from app.models.user import UserDataLimitResetStrategy


def report(text: str, chat_id: int = None, parse_mode="html", keyboard=None):
    admin_ids = get_admin_ids()
    logger_channel = get_setting("TELEGRAM_LOGGER_CHANNEL_ID", 0)
    try:
        logger_channel_id = int(logger_channel)
    except ValueError:
        logger_channel_id = 0

    if bot and (admin_ids or logger_channel_id):
        try:
            if logger_channel_id:
                bot.send_message(logger_channel_id, text, parse_mode=parse_mode)
        except ApiTelegramException as e:
            if "chat not found" in str(e).lower():
                logger.error(f"Logger channel {logger_channel_id} not found")
        except Exception:
            pass

        if chat_id:
            try:
                bot.send_message(chat_id, text, parse_mode=parse_mode, reply_markup=keyboard)
            except ApiTelegramException as e:
                if "chat not found" in str(e).lower():
                    logger.error(f"User chat {chat_id} not found")
        else:
            for admin in admin_ids:
                try:
                    bot.send_message(admin, text, parse_mode=parse_mode, reply_markup=keyboard)
                except ApiTelegramException as e:
                    if "chat not found" in str(e).lower():
                        logger.error(f"Admin {admin} chat not found")


def report_user_usage(user: User, db_user):
    from app.models.user import UserResponse
    from app.telegram.utils.shared import get_user_info_text
    user_resp = UserResponse.model_validate(db_user)
    text = get_user_info_text(db_user)
    report(text)
