from app.telegram import bot
from app.telegram_settings import get_setting
from app.telegram.utils.shared import get_user_info_text
from app.db import GetDB, crud


@bot.message_handler(commands=["usage"])
def handle_usage(message):
    chat_id = message.chat.id
    username = message.from_user.username or message.from_user.first_name
    with GetDB() as db:
        user = crud.get_user_by_username(db, chat_id)
        if user:
            text = get_user_info_text(user)
            bot.reply_to(message, text, parse_mode="html")
        else:
            bot.reply_to(message, "No user found for your account.")
