from app.telegram import bot
from app.telegram_settings import get_admin_ids
from telebot import types
from telebot.custom_filters import AdvancedCustomFilter


class IsAdminFilter(AdvancedCustomFilter):
    key = "is_admin"

    def check(self, message, text):
        admin_ids = get_admin_ids()
        if isinstance(message, types.CallbackQuery):
            return message.from_user.id in admin_ids
        return message.chat.id in admin_ids


def cb_query_equals(text: str):
    return lambda query: query.data == text


def cb_query_startswith(text: str):
    return lambda query: query.data.startswith(text)


def setup():
    bot.add_custom_filter(IsAdminFilter())
