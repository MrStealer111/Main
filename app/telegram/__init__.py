import importlib.util
from os.path import dirname
from threading import Thread
import time
import logging

from app.telegram_settings import get_setting
from telebot import TeleBot, apihelper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("telegram.bot")

bot = None
token = get_setting("TELEGRAM_API_TOKEN")
proxy = get_setting("TELEGRAM_PROXY_URL")

if token:
    if proxy:
        apihelper.proxy = {"http": proxy, "https": proxy}
    bot = TeleBot(token)
    logger.info(f"Bot created with token: {token[:8]}...")
else:
    logger.warning("No token found")

handler_names = ["admin", "report", "user"]


def poll_bot():
    global bot
    if not bot:
        return
    try:
        bot.delete_webhook()
    except Exception:
        pass
    time.sleep(1)
    logger.info("Starting manual polling...")
    offset = None
    while True:
        try:
            updates = bot.get_updates(offset=offset, timeout=30)
            for update in updates:
                offset = update.update_id + 1
                bot.process_new_updates([update])
        except Exception as e:
            logger.error(f"Poll error: {e}")
            time.sleep(5)


def setup_bot(app):
    global bot
    logger.info("setup_bot() called")
    if bot:
        handler_dir = dirname(__file__) + "/handlers/"
        for name in handler_names:
            try:
                path = f"{handler_dir}{name}.py"
                spec = importlib.util.spec_from_file_location(name, path)
                if spec and spec.loader:
                    spec.loader.exec_module(importlib.util.module_from_spec(spec))
                    logger.info(f"Loaded handler: {name}")
            except Exception as e:
                logger.error(f"Failed to load handler {name}: {e}")

        try:
            from app.telegram import utils
            utils.setup()
            logger.info("Utils setup done")
        except Exception as e:
            logger.error(f"Utils setup failed: {e}")

        logger.info(f"Bot has {len(bot.message_handlers)} handlers")
        thread = Thread(target=poll_bot, daemon=True)
        thread.start()
        logger.info("Polling thread started")
    else:
        logger.warning("setup_bot: bot is None")
