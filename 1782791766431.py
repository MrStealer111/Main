import html
import logging
import urllib3
import requests
import requests.exceptions
from datetime import datetime, timedelta
import asyncio
import subprocess
import json
import os
from typing import Dict, List, Optional
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler,
    MessageHandler, filters, ContextTypes,
)
from telegram.constants import ParseMode

# ═══════════════════════════════════════════════════════════════
#                        CONFIGURATION
# ═══════════════════════════════════════════════════════════════
BOT_TOKEN  = "8887643576:AAGp8yeePp0e55bvR2lzAR7wpW32REh4u8c"
ADMIN_IDS  = {6357622851, 5205818621}
API_URL    = "https://139.180.209.2:17033/ULJxFpgKVebwzYu0HOK-Cw"
BANNER     = "https://ar-hosting.pages.dev/1781421087680.jpg"
PM         = ParseMode.HTML

# Database files
KEYS_DB = "keys_data.json"
USERS_DB = "users_data.json"
SCHEDULE_DB = "schedule_data.json"

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logging.basicConfig(format="%(asctime)s | %(levelname)s | %(message)s", level=logging.INFO)
log = logging.getLogger(__name__)

# Conversation states - ADDED MORE STATES
(S_IDLE, S_KEY_NAME, S_RENAME_KEY, S_SET_LIMIT, S_RENAME_SRV, 
 S_DEF_LIMIT, S_KEY_SETLIM, S_BROADCAST, S_EXPIRY_SET, 
 S_SERVER_ADD, S_SERVER_REMOVE, S_SCHEDULE_SET) = range(12)


# ═══════════════════════════════════════════════════════════════
#                       DATABASE HELPERS
# ═══════════════════════════════════════════════════════════════
def load_db(filename: str) -> dict:
    """Load JSON database."""
    if os.path.exists(filename):
        try:
            with open(filename, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_db(filename: str, data: dict):
    """Save JSON database."""
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)

# Initialize databases
keys_db = load_db(KEYS_DB)  # {key_id: {"expiry": "2026-12-31", "name": "..."}}
users_db = load_db(USERS_DB)  # {user_id: {"joined": "2026-01-01"}}
schedule_db = load_db(SCHEDULE_DB)  # {"auto_renew": True, "auto_delete": True, "report_time": "08:00"}


# ═══════════════════════════════════════════════════════════════
#                       OUTLINE API CLIENT
# ═══════════════════════════════════════════════════════════════
class OutlineAPI:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.s = requests.Session()
        self.s.verify = False
        self.s.headers.update({"Content-Type": "application/json"})

    def _req(self, method: str, path: str, **kw):
        url = f"{self.base}/{path.lstrip('/')}"
        r = self.s.request(method, url, timeout=15, **kw)
        r.raise_for_status()
        return r.json() if r.text.strip() else {}

    # ── Server ────────────────────────────────────────────
    def server_info(self):          return self._req("GET",    "server")
    def rename_server(self, n):     return self._req("PUT",    "server/name",             json={"name": n})
    def set_def_limit(self, b):     return self._req("PUT",    "server/defaultDataLimit", json={"limit": {"bytes": b}})
    def del_def_limit(self):        return self._req("DELETE", "server/defaultDataLimit")
    def metrics(self):              return self._req("GET",    "metrics/transfer")

    # ── Keys ──────────────────────────────────────────────
    def list_keys(self):            return self._req("GET",    "access-keys").get("accessKeys", [])
    def create_key(self):           return self._req("POST",   "access-keys")
    def delete_key(self, k):        return self._req("DELETE", f"access-keys/{k}")
    def rename_key(self, k, n):     return self._req("PUT",    f"access-keys/{k}/name",      json={"name": n})
    def set_limit(self, k, b):      return self._req("PUT",    f"access-keys/{k}/dataLimit", json={"limit": {"bytes": b}})
    def del_limit(self, k):         return self._req("DELETE", f"access-keys/{k}/dataLimit")


# ── Multiple Server Support ──────────────────────────────────
class OutlineMultiServer:
    def __init__(self):
        self.servers: Dict[str, OutlineAPI] = {}
        self.current: Optional[str] = None
        self._load_servers()
    
    def _load_servers(self):
        """Load servers from config file."""
        try:
            with open("servers.json", "r") as f:
                data = json.load(f)
                for name, url in data.get("servers", {}).items():
                    self.servers[name] = OutlineAPI(url)
                self.current = data.get("current", list(self.servers.keys())[0] if self.servers else None)
        except:
            # Default server
            self.servers["Default"] = OutlineAPI(API_URL)
            self.current = "Default"
            self._save_servers()
    
    def _save_servers(self):
        """Save servers to config file."""
        data = {
            "servers": {name: api.base for name, api in self.servers.items()},
            "current": self.current
        }
        with open("servers.json", "w") as f:
            json.dump(data, f, indent=2)
    
    def get_api(self) -> OutlineAPI:
        """Get current API instance."""
        if self.current and self.current in self.servers:
            return self.servers[self.current]
        return OutlineAPI(API_URL)
    
    def add_server(self, name: str, url: str):
        """Add a new server."""
        self.servers[name] = OutlineAPI(url)
        self._save_servers()
    
    def remove_server(self, name: str):
        """Remove a server."""
        if name in self.servers:
            del self.servers[name]
            if self.current == name:
                self.current = list(self.servers.keys())[0] if self.servers else None
            self._save_servers()
    
    def switch_server(self, name: str):
        """Switch to another server."""
        if name in self.servers:
            self.current = name
            self._save_servers()
    
    def list_servers(self) -> List[str]:
        """List all server names."""
        return list(self.servers.keys())

multi_server = OutlineMultiServer()
api = multi_server.get_api()  # Default API


# ═══════════════════════════════════════════════════════════════
#                         UTILITIES
# ═══════════════════════════════════════════════════════════════
def esc(e) -> str:
    return html.escape(str(e))

def is_admin(uid: int) -> bool:
    return uid in ADMIN_IDS

def fmt_bytes(b: float) -> str:
    if b <= 0: return "0 B"
    for u in ["B", "KB", "MB", "GB", "TB"]:
        if b < 1024: return f"{b:.2f} {u}"
        b /= 1024
    return f"{b:.2f} PB"

def parse_limit(text: str) -> int:
    """Parse a data-limit string into bytes.
    Accepts: '10 GB', '500MB', '1.5gb', or a plain number.
    A plain number with NO unit is treated as GB (most common case)."""
    t = text.strip().upper().replace(" ", "")
    if not t:
        return -1
    for unit, mult in [("TB", 10**12), ("GB", 10**9), ("MB", 10**6), ("KB", 10**3), ("B", 1)]:
        if t.endswith(unit):
            num = t[: -len(unit)].strip()
            try: return int(float(num) * mult)
            except ValueError: return -1
    # No unit given → assume GB
    try: return int(float(t) * 10**9)
    except ValueError: return -1

def parse_expiry(text: str) -> Optional[str]:
    """Parse expiry date from text. Returns YYYY-MM-DD or None."""
    text = text.strip().lower()
    
    # Check for days format: "7 days", "30d", etc.
    if "day" in text or "d" in text:
        try:
            days = int(''.join(filter(str.isdigit, text)))
            return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")
        except:
            pass
    
    # Check for months format: "1 month", "3m", etc.
    if "month" in text or "m" in text:
        try:
            months = int(''.join(filter(str.isdigit, text)))
            return (datetime.now() + timedelta(days=months*30)).strftime("%Y-%m-%d")
        except:
            pass
    
    # Check for date format: "2026-12-31"
    try:
        datetime.strptime(text, "%Y-%m-%d")
        return text
    except:
        pass
    
    return None

def progress_bar(used: int, limit: int) -> str:
    pct = min(used / limit * 100, 100) if limit else 0
    n = int(pct / 10)
    return f"{'█'*n}{'░'*(10-n)} {pct:.1f}%"

def usage_icon(used: int, limit: int) -> str:
    if not limit: return "🟢"
    p = used / limit * 100
    return "🔴" if p >= 90 else ("🟡" if p >= 60 else "🟢")

def api_err(e: Exception) -> str:
    """Return clean, user-friendly error message."""
    if isinstance(e, requests.exceptions.HTTPError) and e.response is not None:
        code = e.response.status_code
        if code == 404:
            return (
                "⚠️ <b>Feature မပံ့ပိုးပါ (404)</b>\n"
                "━━━━━━━━━━━━━━━━\n"
                "ဒီ Server version မှာ per-key\n"
                "Data Limit feature မပါပါ\n\n"
                "💡 Server Default Limit သုံးပါ\n"
                "(⚙️ Settings → Default Limit)"
            )
        if code == 429:
            return "⚠️ Rate Limited — ခဏစောင့်ပြီး ထပ်ကြိုးစားပါ"
        if code == 500:
            return "⚠️ Server Error (500)\nVPN Server ပြဿနာရှိနိုင်သည်"
        return f"❌ HTTP {code}"
    if isinstance(e, requests.exceptions.ConnectTimeout):
        return (
            "⏰ <b>Connection Timeout</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "VPN Server ဆက်သွယ်မရပါ\n"
            "Server Running ရှိမရှိ စစ်ပါ"
        )
    if isinstance(e, requests.exceptions.ConnectionError):
        return "📡 Connection Failed\nNetwork ပြဿနာ ဖြစ်နိုင်သည်"
    return f"❌ {esc(e)}"


# ═══════════════════════════════════════════════════════════════
#                    SERVER HEALTH MONITORING
# ═══════════════════════════════════════════════════════════════
def get_server_health() -> dict:
    """Get server CPU, RAM, Disk usage."""
    health = {"cpu": 0, "ram": 0, "disk": 0, "uptime": "N/A"}
    
    # CPU Usage
    try:
        cpu = subprocess.check_output("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1", shell=True).decode().strip()
        health["cpu"] = float(cpu) if cpu else 0
    except:
        pass
    
    # RAM Usage
    try:
        ram = subprocess.check_output("free -m | awk 'NR==2{printf \"%.2f\", $3*100/$2 }'", shell=True).decode().strip()
        health["ram"] = float(ram) if ram else 0
    except:
        pass
    
    # Disk Usage
    try:
        disk = subprocess.check_output("df -h / | awk 'NR==2{print $5}' | cut -d'%' -f1", shell=True).decode().strip()
        health["disk"] = float(disk) if disk else 0
    except:
        pass
    
    # Uptime
    try:
        uptime = subprocess.check_output("uptime -p", shell=True).decode().strip()
        health["uptime"] = uptime if uptime else "N/A"
    except:
        pass
    
    return health

def health_icon(value: float, warn: int = 70, danger: int = 85) -> str:
    """Return status icon based on value."""
    if value >= danger:
        return "🔴"
    elif value >= warn:
        return "🟡"
    return "🟢"

def health_bar(value: float) -> str:
    """Return progress bar for health metrics."""
    n = int(value / 10)
    return f"{'█'*n}{'░'*(10-n)} {value:.1f}%"


# ═══════════════════════════════════════════════════════════════
#                    USAGE GRAPH / CHART
# ═══════════════════════════════════════════════════════════════
def build_usage_graph_for_key(key: dict, used: int) -> str:
    """Build usage graph for a single key."""
    limit = key.get("dataLimit", {}).get("bytes", 0)
    name = key.get("name", f"Key #{key['id']}")
    
    if limit and limit > 0:
        pct = min((used / limit) * 100, 100)
        bar_len = 30
        filled = int((pct / 100) * bar_len)
        bar = "█" * filled + "░" * (bar_len - filled)
        return (
            f"📊 <b>Usage Graph</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            f"🔑 {html.escape(name)}\n"
            f"{bar} {pct:.1f}%\n"
            f"📥 {fmt_bytes(used)} / {fmt_bytes(limit)}\n"
            "━━━━━━━━━━━━━━━━\n"
            f"🟢 = Available  🟡 = 60%+  🔴 = 90%+"
        )
    else:
        return (
            f"📊 <b>Usage Graph</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            f"🔑 {html.escape(name)}\n"
            f"♾️ <b>Unlimited</b>\n"
            f"📥 Used: {fmt_bytes(used)}\n"
            "━━━━━━━━━━━━━━━━\n"
            "📌 No limit set — Unlimited"
        )


# ═══════════════════════════════════════════════════════════════
#                    SCHEDULED TASKS
# ═══════════════════════════════════════════════════════════════
async def scheduled_tasks(context: ContextTypes.DEFAULT_TYPE):
    """Run scheduled tasks: auto renew, auto delete, daily report."""
    log.info("Running scheduled tasks...")
    
    try:
        # Get current API
        api_local = multi_server.get_api()
        keys = api_local.list_keys()
        metrics = api_local.metrics().get("bytesTransferredByUserId", {})
        
        # ── Auto Delete Expired Keys ──────────────────
        if schedule_db.get("auto_delete", True):
            today = datetime.now().strftime("%Y-%m-%d")
            for key in keys:
                kid = str(key["id"])
                expiry = keys_db.get(kid, {}).get("expiry")
                if expiry and expiry < today:
                    try:
                        api_local.delete_key(kid)
                        log.info(f"Auto-deleted expired key: {kid}")
                        # Notify admins
                        for admin_id in ADMIN_IDS:
                            try:
                                await context.bot.send_message(
                                    admin_id,
                                    f"🗑 <b>Auto-Deleted Expired Key</b>\n"
                                    f"🆔 ID: <code>{kid}</code>\n"
                                    f"📅 Expiry: {expiry}",
                                    parse_mode=PM
                                )
                            except:
                                pass
                    except Exception as e:
                        log.error(f"Failed to auto-delete key {kid}: {e}")
        
        # ── Auto Renew Keys ───────────────────────────
        if schedule_db.get("auto_renew", False):
            renew_days = schedule_db.get("renew_days", 7)
            for key in keys:
                kid = str(key["id"])
                expiry = keys_db.get(kid, {}).get("expiry")
                if expiry:
                    # Check if expiry is within renew_days
                    try:
                        exp_date = datetime.strptime(expiry, "%Y-%m-%d")
                        days_left = (exp_date - datetime.now()).days
                        if 0 <= days_left <= renew_days:
                            # Send renewal notification to admin
                            for admin_id in ADMIN_IDS:
                                try:
                                    await context.bot.send_message(
                                        admin_id,
                                        f"⏰ <b>Key Expiring Soon</b>\n"
                                        f"🆔 ID: <code>{kid}</code>\n"
                                        f"📅 Expires: {expiry}\n"
                                        f"⏳ {days_left} days left",
                                        parse_mode=PM
                                    )
                                except:
                                    pass
                    except:
                        pass
        
        # ── Daily Report ──────────────────────────────
        if schedule_db.get("daily_report", True):
            report_time = schedule_db.get("report_time", "08:00")
            current_time = datetime.now().strftime("%H:%M")
            if current_time == report_time:
                total_used = sum(metrics.values())
                total_keys = len(keys)
                expired_count = sum(1 for k in keys if keys_db.get(str(k["id"]), {}).get("expiry", "9999-12-31") < datetime.now().strftime("%Y-%m-%d"))
                
                report = (
                    f"📊 <b>Daily Report</b>\n"
                    "━━━━━━━━━━━━━━━━\n"
                    f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
                    f"🔑 Total Keys: <b>{total_keys}</b>\n"
                    f"🗑 Expired: <b>{expired_count}</b>\n"
                    f"📥 Total Usage: <b>{fmt_bytes(total_used)}</b>\n"
                    "━━━━━━━━━━━━━━━━\n"
                    "🟢 = Active  🔴 = Expired"
                )
                for admin_id in ADMIN_IDS:
                    try:
                        await context.bot.send_message(admin_id, report, parse_mode=PM)
                    except:
                        pass
                    
    except Exception as e:
        log.error(f"Scheduled tasks error: {e}")


# ═══════════════════════════════════════════════════════════════
#                        KEYBOARDS
# ═══════════════════════════════════════════════════════════════
def kb_main():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🔑 Key ဖန်တီး",      callback_data="KEY_CREATE"),
         InlineKeyboardButton("📋 Key စာရင်း",      callback_data="KEY_LIST")],
        [InlineKeyboardButton("📊 Statistics",      callback_data="SRV_STATS"),
         InlineKeyboardButton("🖥 Server Info",     callback_data="SRV_INFO")],
        [InlineKeyboardButton("🩺 Server Health",   callback_data="SRV_HEALTH"),
         InlineKeyboardButton("⚙️ Server Settings", callback_data="SRV_SETTINGS")],
    ])

def kb_back(cb: str = "MAIN"):
    return InlineKeyboardMarkup([[InlineKeyboardButton("◀️ နောက်သို့", callback_data=cb)]])

def kb_key_actions(kid):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📋 Access Key ကြည့်",  callback_data=f"KEY_URL_{kid}")],
        [InlineKeyboardButton("✏️ နာမည်ပြောင်း",      callback_data=f"KEY_RENAME_{kid}"),
         InlineKeyboardButton("📶 Limit သတ်မှတ်",    callback_data=f"KEY_SETLIM_{kid}")],
        [InlineKeyboardButton("♾️ Limit ဖျက်",       callback_data=f"KEY_DELLIM_{kid}"),
         InlineKeyboardButton("🗑 Key ဖျက်",         callback_data=f"KEY_DELETE_{kid}")],
        [InlineKeyboardButton("📅 Expiry သတ်မှတ်",   callback_data=f"KEY_SETEXP_{kid}"),  # NEW
         InlineKeyboardButton("♾️ Expiry ဖျက်",     callback_data=f"KEY_DELETE_EXP_{kid}")],  # NEW
        [InlineKeyboardButton("📊 Usage Graph",      callback_data=f"KEY_GRAPH_{kid}"),  # NEW
         InlineKeyboardButton("🔄 Refresh",          callback_data=f"KEY_INFO_{kid}")],
        [InlineKeyboardButton("◀️ Key List",         callback_data="KEY_LIST")],
    ])

def kb_server_settings():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("✏️ Server နာမည်ပြောင်း",    callback_data="SRV_RENAME")],
        [InlineKeyboardButton("📶 Default Limit သတ်မှတ်",  callback_data="SRV_SETDEFLIM")],
        [InlineKeyboardButton("♾️ Default Limit ဖျက်",    callback_data="SRV_DELDEFLIM")],
        [InlineKeyboardButton("🌐 Multiple Servers",       callback_data="SRV_MULTI")],  # NEW
        [InlineKeyboardButton("⏰ Scheduled Tasks",        callback_data="SRV_SCHEDULE")],  # NEW
        [InlineKeyboardButton("◀️ Menu",                   callback_data="MAIN")],
    ])

def kb_confirm_delete(kid):
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ ဟုတ်၊ ဖျက်မည်", callback_data=f"KEY_CONFIRM_DEL_{kid}"),
        InlineKeyboardButton("❌ မဖျက်",          callback_data=f"KEY_INFO_{kid}"),
    ]])

def kb_quick_limits(kid):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("1 GB",    callback_data=f"KEY_QLIM_{kid}_1073741824"),
         InlineKeyboardButton("5 GB",    callback_data=f"KEY_QLIM_{kid}_5368709120"),
         InlineKeyboardButton("10 GB",   callback_data=f"KEY_QLIM_{kid}_10737418240")],
        [InlineKeyboardButton("20 GB",   callback_data=f"KEY_QLIM_{kid}_21474836480"),
         InlineKeyboardButton("50 GB",   callback_data=f"KEY_QLIM_{kid}_53687091200"),
         InlineKeyboardButton("100 GB",  callback_data=f"KEY_QLIM_{kid}_107374182400")],
        [InlineKeyboardButton("◀️ နောက်သို့", callback_data=f"KEY_INFO_{kid}")],
    ])

def kb_quick_expiry(kid):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("7 days",  callback_data=f"KEY_QEXP_{kid}_7d"),
         InlineKeyboardButton("14 days", callback_data=f"KEY_QEXP_{kid}_14d"),
         InlineKeyboardButton("30 days", callback_data=f"KEY_QEXP_{kid}_30d")],
        [InlineKeyboardButton("3 months", callback_data=f"KEY_QEXP_{kid}_3m"),
         InlineKeyboardButton("6 months", callback_data=f"KEY_QEXP_{kid}_6m"),
         InlineKeyboardButton("1 year",  callback_data=f"KEY_QEXP_{kid}_1y")],
        [InlineKeyboardButton("◀️ နောက်သို့", callback_data=f"KEY_INFO_{kid}")],
    ])

def kb_multi_servers():
    """Keyboard for multiple server management."""
    servers = multi_server.list_servers()
    buttons = []
    for s in servers:
        marker = " ✅" if s == multi_server.current else ""
        buttons.append([InlineKeyboardButton(f"📡 {s}{marker}", callback_data=f"SRV_SWITCH_{s}")])
    buttons.append([InlineKeyboardButton("➕ Add Server", callback_data="SRV_ADD"),
                    InlineKeyboardButton("➖ Remove Server", callback_data="SRV_REMOVE")])
    buttons.append([InlineKeyboardButton("◀️ Settings", callback_data="SRV_SETTINGS")])
    return InlineKeyboardMarkup(buttons)

def kb_schedule_settings():
    """Keyboard for schedule settings."""
    auto_renew = "✅" if schedule_db.get("auto_renew", False) else "❌"
    auto_delete = "✅" if schedule_db.get("auto_delete", True) else "❌"
    daily_report = "✅" if schedule_db.get("daily_report", True) else "❌"
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(f"🔄 Auto Renew {auto_renew}", callback_data="SCHED_RENEW")],
        [InlineKeyboardButton(f"🗑 Auto Delete {auto_delete}", callback_data="SCHED_DELETE")],
        [InlineKeyboardButton(f"📊 Daily Report {daily_report}", callback_data="SCHED_REPORT")],
        [InlineKeyboardButton("⏰ Set Report Time", callback_data="SCHED_TIME")],
        [InlineKeyboardButton("◀️ Settings", callback_data="SRV_SETTINGS")],
    ])


# ═══════════════════════════════════════════════════════════════
#                    BANNER MESSAGE HELPERS
# ═══════════════════════════════════════════════════════════════
async def send_banner(target, caption: str, kb) -> int:
    """Send new banner photo message. Returns message_id."""
    msg = await target.reply_photo(photo=BANNER, caption=caption, parse_mode=PM, reply_markup=kb)
    return msg.message_id

async def edit_banner(query, caption: str, kb):
    """Edit caption of existing photo message. Fallback: delete + resend."""
    try:
        await query.edit_message_caption(caption=caption, parse_mode=PM, reply_markup=kb)
    except Exception:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_photo(photo=BANNER, caption=caption, parse_mode=PM, reply_markup=kb)

async def edit_banner_id(ctx: ContextTypes.DEFAULT_TYPE, chat_id: int,
                         msg_id: int | None, caption: str, kb):
    """Edit caption by message ID (used after text input). Fallback: send new photo."""
    if msg_id:
        try:
            await ctx.bot.edit_message_caption(
                chat_id=chat_id, message_id=msg_id,
                caption=caption, parse_mode=PM, reply_markup=kb,
            )
            return
        except Exception:
            pass
    await ctx.bot.send_photo(chat_id=chat_id, photo=BANNER, caption=caption, parse_mode=PM, reply_markup=kb)


# ═══════════════════════════════════════════════════════════════
#                     KEY INFO CAPTION BUILDER
# ═══════════════════════════════════════════════════════════════
def build_key_caption(key: dict, used: int) -> str:
    kid = str(key["id"])
    name = html.escape(key.get("name") or f"Key #{kid}")
    limit = key.get("dataLimit", {}).get("bytes", 0)
    port = key.get("port", "N/A")
    method = key.get("method", "N/A")
    
    # Get expiry info
    expiry = keys_db.get(kid, {}).get("expiry")
    expiry_str = f"📅 Expiry: <b>{expiry}</b>" if expiry else "📅 Expiry: ♾️ <b>Never</b>"
    
    if limit:
        icon = usage_icon(used, limit)
        bar = progress_bar(used, limit)
        data = f"{icon} {bar}\n   {fmt_bytes(used)} / {fmt_bytes(limit)}"
    else:
        data = f"🟢 Unlimited\n   Used: {fmt_bytes(used)}"
    
    return (
        f"🔑 <b>{name}</b>\n"
        "━━━━━━━━━━━━━━━━\n"
        f"🆔 ID: <code>{kid}</code>   🔌 Port: <code>{port}</code>\n"
        f"🔐 <code>{method}</code>\n"
        f"{data}\n"
        f"{expiry_str}"
    )


# ═══════════════════════════════════════════════════════════════
#                       COMMAND HANDLERS
# ═══════════════════════════════════════════════════════════════
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    # Add user to database
    users_db[str(uid)] = {"joined": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
    save_db(USERS_DB, users_db)
    
    if not is_admin(uid):
        return
    ctx.user_data["state"] = S_IDLE
    mid = await send_banner(
        update.message,
        "🔒 <b>Outline VPN Manager</b>\n"
        "━━━━━━━━━━━━━━━━\n"
        "VPN Key များ လွယ်ကူစွာ စီမံပါ\n"
        "📌 Menu ကိုရွေးချယ်ပါ ↓",
        kb_main(),
    )
    ctx.user_data["msg_id"] = mid

async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_user.id):
        return
    mid = await send_banner(
        update.message,
        "📖 <b>Outline VPN Bot — Help</b>\n"
        "━━━━━━━━━━━━━━━━\n"
        "/start — Main menu\n"
        "/help  — ဒီ help message\n"
        "/broadcast — Send message to all users\n\n"
        "✨ <b>Features:</b>\n"
        "🔑 Key ဖန်တီး / ဖျက် / နာမည်ပြောင်း\n"
        "📶 Data limit သတ်မှတ် / ဖျက်\n"
        "📅 Expiry date သတ်မှတ် / ဖျက်\n"
        "📊 Per-key usage statistics & graph\n"
        "🩺 Server health monitoring\n"
        "🖥 Server info & multi-server settings\n"
        "⏰ Scheduled tasks (auto renew/delete/report)\n"
        "📋 Access key copy support",
        kb_main(),
    )
    ctx.user_data["msg_id"] = mid

async def cmd_broadcast(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Broadcast message to all users."""
    if not is_admin(update.effective_user.id):
        return
    
    ctx.user_data.update({
        "state": S_BROADCAST,
        "msg_id": update.message.message_id
    })
    
    await send_banner(
        update.message,
        "📢 <b>Broadcast / Announcement</b>\n"
        "━━━━━━━━━━━━━━━━\n"
        "All Users ဆီ ပို့မယ့် Message ကို ရိုက်ထည့်ပါ\n\n"
        "💡 ဥပမာ:\n"
        "<code>Server maintenance tomorrow at 2 AM</code>\n\n"
        "⚠️ <b>Warning:</b> All users will receive this message!",
        InlineKeyboardMarkup([
            [InlineKeyboardButton("◀️ Cancel", callback_data="MAIN")],
        ])
    )


# ═══════════════════════════════════════════════════════════════
#                      CALLBACK QUERY HANDLER
# ═══════════════════════════════════════════════════════════════
async def on_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    d = q.data
    if not is_admin(update.effective_user.id):
        await q.answer("⛔ Access denied", show_alert=True)
        return
    await q.answer()
    
    # ── Main Menu ─────────────────────────────────────────────────
    if d == "MAIN":
        ctx.user_data["state"] = S_IDLE
        await edit_banner(q,
            "🔒 <b>Outline VPN Manager</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "📌 Menu ကိုရွေးချယ်ပါ ↓",
            kb_main(),
        )
    
    # ── Key List ──────────────────────────────────────────────────
    elif d == "KEY_LIST":
        ctx.user_data["state"] = S_IDLE
        try:
            api_local = multi_server.get_api()
            keys = api_local.list_keys()
            metrics = api_local.metrics().get("bytesTransferredByUserId", {})
        except Exception as e:
            await edit_banner(q, api_err(e), kb_back())
            return
        
        if not keys:
            await edit_banner(q,
                "📭 <b>Key မရှိသေးပါ</b>\nKey အသစ်ဖန်တီးပါ →",
                InlineKeyboardMarkup([[
                    InlineKeyboardButton("🔑 Key ဖန်တီး", callback_data="KEY_CREATE"),
                    InlineKeyboardButton("◀️ Menu",       callback_data="MAIN"),
                ]]),
            )
            return
        
        rows = []
        for k in keys:
            kid = str(k["id"])
            name = k.get("name") or f"Key #{kid}"
            used = metrics.get(kid, 0)
            limit = k.get("dataLimit", {}).get("bytes", 0)
            expiry = keys_db.get(kid, {}).get("expiry")
            expiry_icon = "🔴" if expiry and expiry < datetime.now().strftime("%Y-%m-%d") else ("📅" if expiry else "")
            icon = usage_icon(used, limit)
            label = (
                f"{icon} {name}  {fmt_bytes(used)}/{fmt_bytes(limit)}"
                if limit else
                f"{icon} {name}  ({fmt_bytes(used)})"
            )
            if expiry_icon:
                label = f"{expiry_icon} {label}"
            rows.append([InlineKeyboardButton(label, callback_data=f"KEY_INFO_{kid}")])
        
        rows.append([
            InlineKeyboardButton("🔑 ဖန်တီး",  callback_data="KEY_CREATE"),
            InlineKeyboardButton("🔄 Refresh", callback_data="KEY_LIST"),
            InlineKeyboardButton("◀️ Menu",    callback_data="MAIN"),
        ])
        await edit_banner(q,
            f"📋 <b>Access Keys — {len(keys)} ခု</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "Key တစ်ခုကို နှိပ်ပါ →\n"
            "📅 = Has Expiry  🔴 = Expired",
            InlineKeyboardMarkup(rows),
        )
    
    # ── Key Info ──────────────────────────────────────────────────
    elif d.startswith("KEY_INFO_"):
        ctx.user_data["state"] = S_IDLE
        kid = d[9:]
        try:
            api_local = multi_server.get_api()
            keys = api_local.list_keys()
            metrics = api_local.metrics().get("bytesTransferredByUserId", {})
            key = next((k for k in keys if str(k["id"]) == kid), None)
            if not key:
                await edit_banner(q, "❌ Key မတွေ့ပါ", kb_back("KEY_LIST"))
                return
            cap = build_key_caption(key, metrics.get(kid, 0))
        except Exception as e:
            await edit_banner(q, api_err(e), kb_back("KEY_LIST"))
            return
        await edit_banner(q, cap, kb_key_actions(kid))
    
    # ── Show Access URL ─────────────────────────────────────────
    elif d.startswith("KEY_URL_"):
        kid = d[8:]
        try:
            api_local = multi_server.get_api()
            keys = api_local.list_keys()
            key = next((k for k in keys if str(k["id"]) == kid), None)
            url = key.get("accessUrl", "N/A") if key else "N/A"
        except Exception as e:
            await q.answer(esc(e), show_alert=True)
            return
        
        tmp = await q.message.chat.send_message(
            f"📎 <b>Key #{kid} — Access URL</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            f"<code>{html.escape(url)}</code>\n\n"
            "⬆️ Copy ပြီး Outline app ထဲ paste လုပ်ပါ",
            parse_mode=PM,
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🗑 Message ဖျက်", callback_data=f"DEL_MSG_0"),
            ]]),
        )
        await tmp.edit_reply_markup(InlineKeyboardMarkup([[
            InlineKeyboardButton("🗑 Message ဖျက်", callback_data=f"DEL_MSG_{tmp.message_id}"),
        ]]))
    
    # ── Delete temp message ─────────────────────────────────────
    elif d.startswith("DEL_MSG_"):
        mid = int(d[8:])
        try:
            await ctx.bot.delete_message(update.effective_chat.id, mid)
        except Exception:
            pass
    
    # ── Create Key ──────────────────────────────────────────────
    elif d == "KEY_CREATE":
        ctx.user_data.update({"state": S_KEY_NAME, "msg_id": q.message.message_id})
        await edit_banner(q,
            "🔑 <b>Key အသစ် ဖန်တီးရန်</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "Key ရဲ့ <b>နာမည်</b> ရိုက်ထည့်ပါ\n\n"
            "💡 ဥပမာ: <code>John Doe</code>",
            InlineKeyboardMarkup([
                [InlineKeyboardButton("⚡ Auto Name (skip)", callback_data="KEY_CREATE_AUTO")],
                [InlineKeyboardButton("◀️ Menu",             callback_data="MAIN")],
            ]),
        )
    
    elif d == "KEY_CREATE_AUTO":
        ctx.user_data.update({"pending_name": "", "state": S_IDLE, "msg_id": q.message.message_id})
        await edit_banner(q,
            "🔑 <b>Key အသစ် ဖန်တီးရန်</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "Data Limit သတ်မှတ်မလား?\n\n"
            "♾️ <b>Unlimited</b> — Limit မလိုပဲ Key ထုတ်တီး\n"
            "📶 <b>Data Limit</b> — Limit ရွေးပြိီး Key ထုတ်တီး",
            InlineKeyboardMarkup([
                [InlineKeyboardButton("♾️ Unlimited",   callback_data="KEY_CONFIRM_NOLIMIT"),
                 InlineKeyboardButton("📶 Data Limit",  callback_data="KEY_CONFIRM_SETLIM")],
                [InlineKeyboardButton("◀️ နောက်သို့",   callback_data="KEY_CREATE")],
            ])
        )
    
    # ── Create Key: Unlimited ───────────────────────────────────
    elif d == "KEY_CONFIRM_NOLIMIT":
        ctx.user_data["state"] = S_IDLE
        name = ctx.user_data.get("pending_name", "")
        try:
            api_local = multi_server.get_api()
            key = api_local.create_key()
            kid = str(key["id"])
            if name:
                api_local.rename_key(kid, name)
                key["name"] = name
            cap = "✅ <b>Key ဖန်တီးပြိီးပြိီး!</b>\n♾️ Unlimited\n\n" + build_key_caption(key, 0)
            kb = kb_key_actions(kid)
        except Exception as e:
            cap, kb = api_err(e), kb_back()
        await edit_banner(q, cap, kb)
    
    # ── Create Key: Data Limit ──────────────────────────────────
    elif d == "KEY_CONFIRM_SETLIM":
        name = ctx.user_data.get("pending_name", "")
        ctx.user_data.update({"state": S_KEY_SETLIM, "msg_id": q.message.message_id})
        name_line = f"🔑 Key: <b>{html.escape(name)}</b>\n" if name else ""
        await edit_banner(q,
            f"📶 <b>Data Limit ရွေးပြိီး</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            f"{name_line}"
            "Quick button ရွေးပါ (သို့) custom ရိုက်ပါ\n\n"
            "💡 ဥပမာ: <code>10 GB</code>  /  <code>500 MB</code>",
            InlineKeyboardMarkup([
                [InlineKeyboardButton("1 GB",   callback_data="KEY_CONFIRM_QLIM_1073741824"),
                 InlineKeyboardButton("5 GB",   callback_data="KEY_CONFIRM_QLIM_5368709120"),
                 InlineKeyboardButton("10 GB",  callback_data="KEY_CONFIRM_QLIM_10737418240")],
                [InlineKeyboardButton("20 GB",  callback_data="KEY_CONFIRM_QLIM_21474836480"),
                 InlineKeyboardButton("50 GB",  callback_data="KEY_CONFIRM_QLIM_53687091200"),
                 InlineKeyboardButton("100 GB", callback_data="KEY_CONFIRM_QLIM_107374182400")],
                [InlineKeyboardButton("◀️ နောက်သို့", callback_data="KEY_CONFIRM_BACK")],
            ])
        )
    
    # ── Create Key: quick limit selected ──────────────────────
    elif d.startswith("KEY_CONFIRM_QLIM_"):
        ctx.user_data["state"] = S_IDLE
        bval = int(d[17:])
        name = ctx.user_data.get("pending_name", "")
        try:
            api_local = multi_server.get_api()
            key = api_local.create_key()
            kid = str(key["id"])
            if name:
                api_local.rename_key(kid, name)
                key["name"] = name
            api_local.set_limit(kid, bval)
            key.setdefault("dataLimit", {})["bytes"] = bval
            cap = f"✅ <b>Key ဖန်တီးပြိီးပြိီး!</b>\n📶 Limit: <b>{fmt_bytes(bval)}</b>\n\n" + build_key_caption(key, 0)
            kb = kb_key_actions(kid)
        except Exception as e:
            cap, kb = api_err(e), kb_back()
        await edit_banner(q, cap, kb)
    
    # ── Create Key: back from limit picker ──────────────────────
    elif d == "KEY_CONFIRM_BACK":
        name = ctx.user_data.get("pending_name", "")
        ctx.user_data["state"] = S_IDLE
        if name:
            await edit_banner(q,
                f"🔑 <b>Key: {html.escape(name)}</b>\n"
                "━━━━━━━━━━━━━━━━\n"
                "Data Limit သတ်မှတ်မလား?\n\n"
                "♾️ <b>Unlimited</b> — Limit မလိုပဲ Key ထုတ်တီး\n"
                "📶 <b>Data Limit</b> — Limit ရွေးပြိီး Key ထုတ်တီး",
                InlineKeyboardMarkup([
                    [InlineKeyboardButton("♾️ Unlimited",  callback_data="KEY_CONFIRM_NOLIMIT"),
                     InlineKeyboardButton("📶 Data Limit", callback_data="KEY_CONFIRM_SETLIM")],
                    [InlineKeyboardButton("◀️ နောက်သို့",  callback_data="KEY_CREATE")],
                ])
            )
        else:
            ctx.user_data["state"] = S_KEY_NAME
            await edit_banner(q,
                "🔑 <b>Key အသစ် ဖန်တီးရန်</b>\n"
                "━━━━━━━━━━━━━━━━\n"
                "Key ရဲ့ <b>နမည်</b> ရိုက်ထည့့ပါ\n\n"
                "💡 ဥပမာ: <code>John Doe</code>",
                InlineKeyboardMarkup([
                    [InlineKeyboardButton("⚡ Auto Name", callback_data="KEY_CREATE_AUTO")],
                    [InlineKeyboardButton("◀️ Menu",     callback_data="MAIN")],
                ])
            )
    
    # ── Rename Key ──────────────────────────────────────────────
    elif d.startswith("KEY_RENAME_"):
        kid = d[11:]
        ctx.user_data.update({"state": S_RENAME_KEY, "target_kid": kid, "msg_id": q.message.message_id})
        await edit_banner(q,
            f"✏️ <b>Key #{kid} — နာမည်ပြောင်းရန်</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "နာမည်အသစ် ရိုက်ထည့်ပါ\n\n"
            "💡 ဥပမာ: <code>VIP User</code>",
            kb_back(f"KEY_INFO_{kid}"),
        )
    
    # ── Set Limit ─────────────────────────────────────────────────
    elif d.startswith("KEY_SETLIM_"):
        kid = d[11:]
        ctx.user_data.update({"state": S_SET_LIMIT, "target_kid": kid, "msg_id": q.message.message_id})
        await edit_banner(q,
            f"📶 <b>Key #{kid} — Data Limit</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "Quick button ရွေးပါ (သို့)\n"
            "Custom amount ရိုက်ပါ\n\n"
            "💡 ဥပမာ: <code>15 GB</code>  /  <code>500 MB</code>",
            kb_quick_limits(kid),
        )
    
    # ── Quick Limit ──────────────────────────────────────────────
    elif d.startswith("KEY_QLIM_"):
        parts = d.split("_")
        kid, bval = parts[2], int(parts[3])
        ctx.user_data["state"] = S_IDLE
        try:
            api_local = multi_server.get_api()
            api_local.set_limit(kid, bval)
            cap = f"✅ Key #{kid}\nLimit: <b>{fmt_bytes(bval)}</b> သတ်မှတ်ပြီး"
        except Exception as e:
            cap = api_err(e)
        await edit_banner(q, cap, kb_key_actions(kid))
    
    # ── Remove Limit ─────────────────────────────────────────────
    elif d.startswith("KEY_DELLIM_"):
        kid = d[11:]
        ctx.user_data["state"] = S_IDLE
        try:
            api_local = multi_server.get_api()
            api_local.del_limit(kid)
            cap = f"♾️ Key #{kid} — Limit ဖျက်ပြီး\nUnlimited mode"
        except Exception as e:
            cap = api_err(e)
        await edit_banner(q, cap, kb_key_actions(kid))
    
    # ── Set Expiry ───────────────────────────────────────────────
    elif d.startswith("KEY_SETEXP_"):
        kid = d[10:]
        ctx.user_data.update({"state": S_EXPIRY_SET, "target_kid": kid, "msg_id": q.message.message_id})
        await edit_banner(q,
            f"📅 <b>Key #{kid} — Expiry Date</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "Quick button ရွေးပါ (သို့)\n"
            "Custom date ရိုက်ပါ\n\n"
            "💡 ဥပမာ: <code>7 days</code>  /  <code>30d</code>  /  <code>2026-12-31</code>",
            kb_quick_expiry(kid),
        )
    
    # ── Quick Expiry ─────────────────────────────────────────────
    elif d.startswith("KEY_QEXP_"):
        parts = d.split("_")
        kid, exp_str = parts[2], parts[3]
        
        # Parse expiry from string (7d, 30d, 3m, 6m, 1y)
        days = 0
        if "d" in exp_str:
            days = int(exp_str.replace("d", ""))
        elif "m" in exp_str:
            months = int(exp_str.replace("m", ""))
            days = months * 30
        elif "y" in exp_str:
            years = int(exp_str.replace("y", ""))
            days = years * 365
        
        if days > 0:
            expiry_date = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")
            keys_db[kid] = {"expiry": expiry_date}
            save_db(KEYS_DB, keys_db)
            cap = f"✅ Key #{kid}\n📅 Expiry: <b>{expiry_date}</b> သတ်မှတ်ပြီး"
        else:
            cap = "❌ Invalid expiry format"
        
        await edit_banner(q, cap, kb_key_actions(kid))
    
    # ── Delete Expiry ────────────────────────────────────────────
    elif d.startswith("KEY_DELETE_EXP_"):
        kid = d[15:]
        ctx.user_data["state"] = S_IDLE
        if kid in keys_db:
            del keys_db[kid]
            save_db(KEYS_DB, keys_db)
            cap = f"♾️ Key #{kid} — Expiry ဖျက်ပြီး\nNever expires"
        else:
            cap = "❌ No expiry set for this key"
        await edit_banner(q, cap, kb_key_actions(kid))
    
    # ── Usage Graph ──────────────────────────────────────────────
    elif d.startswith("KEY_GRAPH_"):
        kid = d[10:]
        ctx.user_data["state"] = S_IDLE
        try:
            api_local = multi_server.get_api()
            keys = api_local.list_keys()
            metrics = api_local.metrics().get("bytesTransferredByUserId", {})
            key = next((k for k in keys if str(k["id"]) == kid), None)
            if not key:
                await edit_banner(q, "❌ Key မတွေ့ပါ", kb_back("KEY_LIST"))
                return
            
            used = metrics.get(kid, 0)
            cap = build_usage_graph_for_key(key, used)
            kb = InlineKeyboardMarkup([
                [InlineKeyboardButton("🔄 Refresh", callback_data=f"KEY_GRAPH_{kid}"),
                 InlineKeyboardButton("◀️ Back", callback_data=f"KEY_INFO_{kid}")],
            ])
        except Exception as e:
            cap, kb = api_err(e), kb_back()
        await edit_banner(q, cap, kb)
    
    # ── Delete Key (confirm) ────────────────────────────────────
    elif d.startswith("KEY_DELETE_"):
        kid = d[11:]
        await edit_banner(q,
            f"🗑 <b>Key #{kid} ဖျက်မလား?</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "⚠️ ဖျက်ပြီးရင် ပြန်မရနိုင်ပါ!",
            kb_confirm_delete(kid),
        )
    
    # ── Delete Key (confirmed) ──────────────────────────────────
    elif d.startswith("KEY_CONFIRM_DEL_"):
        kid = d[16:]
        try:
            api_local = multi_server.get_api()
            api_local.delete_key(kid)
            if kid in keys_db:
                del keys_db[kid]
                save_db(KEYS_DB, keys_db)
            cap = f"🗑 <b>Key #{kid} ဖျက်ပြီးပါပြီ</b>"
        except Exception as e:
            cap = api_err(e)
        await edit_banner(q, cap,
            InlineKeyboardMarkup([[
                InlineKeyboardButton("📋 Key List", callback_data="KEY_LIST"),
                InlineKeyboardButton("🏠 Menu",    callback_data="MAIN"),
            ]]),
        )
    
    # ── Server Info ──────────────────────────────────────────────
    elif d == "SRV_INFO":
        ctx.user_data["state"] = S_IDLE
        try:
            api_local = multi_server.get_api()
            info = api_local.server_info()
            metrics = api_local.metrics()
            keys = api_local.list_keys()
            total = sum(metrics.get("bytesTransferredByUserId", {}).values())
            ms = info.get("createdTimestampMs", 0)
            created = datetime.fromtimestamp(ms / 1000).strftime("%Y-%m-%d") if ms else "N/A"
            deflim = info.get("accessKeyDataLimit", {}).get("bytes", 0)
            server_name = multi_server.current or "Default"
            cap = (
                f"🖥 <b>{html.escape(info.get('name','Outline Server'))}</b> [{server_name}]\n"
                "━━━━━━━━━━━━━━━━\n"
                f"📦 v{info.get('version','?')}   📅 {created}\n"
                f"🔑 Keys: <b>{len(keys)}</b>   "
                f"🔌 Port: <b>{info.get('portForNewAccessKeys','?')}</b>\n"
                f"📶 Default: <b>{'♾ Unlimited' if not deflim else fmt_bytes(deflim)}</b>\n"
                "━━━━━━━━━━━━━━━━\n"
                f"📊 Total Transfer: <b>{fmt_bytes(total)}</b>"
            )
            kb = InlineKeyboardMarkup([
                [InlineKeyboardButton("⚙️ Settings",  callback_data="SRV_SETTINGS"),
                 InlineKeyboardButton("🔄 Refresh",   callback_data="SRV_INFO")],
                [InlineKeyboardButton("◀️ Menu",      callback_data="MAIN")],
            ])
        except Exception as e:
            cap, kb = api_err(e), kb_back()
        await edit_banner(q, cap, kb)
    
    # ── Server Stats ─────────────────────────────────────────────
    elif d == "SRV_STATS":
        ctx.user_data["state"] = S_IDLE
        try:
            api_local = multi_server.get_api()
            keys = api_local.list_keys()
            usage_map = api_local.metrics().get("bytesTransferredByUserId", {})
            total = sum(usage_map.values())
            sorted_k = sorted(keys, key=lambda k: usage_map.get(str(k["id"]), 0), reverse=True)
            
            lines = ["📊 <b>Transfer Statistics</b>\n━━━━━━━━━━━━━━━━"]
            for k in sorted_k[:7]:
                kid = str(k["id"])
                name = html.escape(k.get("name") or f"Key #{kid}")
                used = usage_map.get(kid, 0)
                limit = k.get("dataLimit", {}).get("bytes", 0)
                icon = usage_icon(used, limit)
                if limit:
                    bar = progress_bar(used, limit)
                    lines.append(f"{icon} <b>{name}</b>\n   {bar}\n   {fmt_bytes(used)}/{fmt_bytes(limit)}")
                else:
                    lines.append(f"{icon} <b>{name}</b>: {fmt_bytes(used)}")
            
            if len(keys) > 7:
                lines.append(f"... +{len(keys)-7} more")
            
            lines.append(f"\n━━━━━━━━━━━━━━━━\n📦 Total: <b>{fmt_bytes(total)}</b>   Keys: <b>{len(keys)}</b>")
            cap = "\n".join(lines)
        except Exception as e:
            cap = api_err(e)
        await edit_banner(q, cap,
            InlineKeyboardMarkup([[
                InlineKeyboardButton("🔄 Refresh", callback_data="SRV_STATS"),
                InlineKeyboardButton("◀️ Menu",    callback_data="MAIN"),
            ]]),
        )
    
    # ── Server Health ────────────────────────────────────────────
    elif d == "SRV_HEALTH":
        ctx.user_data["state"] = S_IDLE
        try:
            health = get_server_health()
            
            cpu_icon = health_icon(health["cpu"])
            ram_icon = health_icon(health["ram"])
            disk_icon = health_icon(health["disk"])
            
            cap = (
                f"🩺 <b>Server Health Monitor</b>\n"
                "━━━━━━━━━━━━━━━━\n"
                f"{cpu_icon} <b>CPU</b>\n   {health_bar(health['cpu'])}\n"
                f"{ram_icon} <b>RAM</b>\n   {health_bar(health['ram'])}\n"
                f"{disk_icon} <b>Disk</b>\n   {health_bar(health['disk'])}\n"
                "━━━━━━━━━━━━━━━━\n"
                f"⏰ Uptime: <code>{health['uptime']}</code>\n"
                "━━━━━━━━━━━━━━━━\n"
                "🟢 = Good  🟡 = Warning  🔴 = Critical"
            )
            kb = InlineKeyboardMarkup([
                [InlineKeyboardButton("🔄 Refresh", callback_data="SRV_HEALTH"),
                 InlineKeyboardButton("◀️ Menu", callback_data="MAIN")],
            ])
        except Exception as e:
            cap, kb = api_err(e), kb_back()
        await edit_banner(q, cap, kb)
    
    # ── Server Settings ──────────────────────────────────────────
    elif d == "SRV_SETTINGS":
        ctx.user_data["state"] = S_IDLE
        await edit_banner(q,
            "⚙️ <b>Server Settings</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "ပြင်ဆင်လိုသည်ကို ရွေးပါ",
            kb_server_settings(),
        )
    
    # ── Rename Server ────────────────────────────────────────────
    elif d == "SRV_RENAME":
        ctx.user_data.update({"state": S_RENAME_SRV, "msg_id": q.message.message_id})
        await edit_banner(q,
            "✏️ <b>Server နာမည်ပြောင်းရန်</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "Server နာမည်အသစ် ရိုက်ထည့်ပါ\n\n"
            "💡 ဥပမာ: <code>My VPN 🔒</code>",
            kb_back("SRV_SETTINGS"),
        )
    
    # ── Set Default Limit ────────────────────────────────────────
    elif d == "SRV_SETDEFLIM":
        ctx.user_data.update({"state": S_DEF_LIMIT, "msg_id": q.message.message_id})
        await edit_banner(q,
            "📶 <b>Default Data Limit</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "Key အသစ်တွေအတွက် default limit\n\n"
            "💡 ဥပမာ: <code>10 GB</code>",
            kb_back("SRV_SETTINGS"),
        )
    
    # ── Remove Default Limit ─────────────────────────────────────
    elif d == "SRV_DELDEFLIM":
        ctx.user_data["state"] = S_IDLE
        try:
            api_local = multi_server.get_api()
            api_local.del_def_limit()
            cap = "♾️ Default Limit ဖျက်ပြီး — Unlimited"
        except Exception as e:
            cap = api_err(e)
        await edit_banner(q, cap, kb_back("SRV_SETTINGS"))
    
    # ── Multiple Servers ─────────────────────────────────────────
    elif d == "SRV_MULTI":
        ctx.user_data["state"] = S_IDLE
        await edit_banner(q,
            "🌐 <b>Multiple Servers</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            f"Current: <b>{multi_server.current or 'None'}</b>\n\n"
            "Server ကိုရွေးပါ →",
            kb_multi_servers()
        )
    
    # ── Switch Server ────────────────────────────────────────────
    elif d.startswith("SRV_SWITCH_"):
        server_name = d[11:]
        multi_server.switch_server(server_name)
        global api
        api = multi_server.get_api()
        await edit_banner(q,
            f"✅ Switched to <b>{server_name}</b>",
            kb_multi_servers()
        )
    
    # ── Add Server ──────────────────────────────────────────────
    elif d == "SRV_ADD":
        ctx.user_data.update({"state": S_SERVER_ADD, "msg_id": q.message.message_id})
        await edit_banner(q,
            "➕ <b>Add New Server</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "Server Name နဲ့ API URL ကို ရိုက်ထည့်ပါ\n\n"
            "Format: <code>ServerName | https://ip:port/api-key</code>\n"
            "💡 ဥပမာ: <code>US Server | https://1.2.3.4:12345/abc123</code>",
            kb_back("SRV_MULTI")
        )
    
    # ── Remove Server ────────────────────────────────────────────
    elif d == "SRV_REMOVE":
        ctx.user_data.update({"state": S_SERVER_REMOVE, "msg_id": q.message.message_id})
        await edit_banner(q,
            "➖ <b>Remove Server</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "ဖျက်ချင်တဲ့ Server Name ကို ရိုက်ထည့်ပါ\n\n"
            f"Available: {', '.join(multi_server.list_servers())}",
            kb_back("SRV_MULTI")
        )
    
    # ── Scheduled Tasks ──────────────────────────────────────────
    elif d == "SRV_SCHEDULE":
        ctx.user_data["state"] = S_IDLE
        await edit_banner(q,
            "⏰ <b>Scheduled Tasks</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "Auto Tasks များကို ပြင်ဆင်ပါ\n\n"
            f"🔄 Auto Renew: {'Enabled' if schedule_db.get('auto_renew', False) else 'Disabled'}\n"
            f"🗑 Auto Delete: {'Enabled' if schedule_db.get('auto_delete', True) else 'Disabled'}\n"
            f"📊 Daily Report: {'Enabled' if schedule_db.get('daily_report', True) else 'Disabled'}\n"
            f"⏰ Report Time: {schedule_db.get('report_time', '08:00')}",
            kb_schedule_settings()
        )
    
    # ── Schedule: Toggle Auto Renew ─────────────────────────────
    elif d == "SCHED_RENEW":
        schedule_db["auto_renew"] = not schedule_db.get("auto_renew", False)
        save_db(SCHEDULE_DB, schedule_db)
        await edit_banner(q, f"✅ Auto Renew: {'Enabled' if schedule_db['auto_renew'] else 'Disabled'}", kb_schedule_settings())
    
    # ── Schedule: Toggle Auto Delete ────────────────────────────
    elif d == "SCHED_DELETE":
        schedule_db["auto_delete"] = not schedule_db.get("auto_delete", True)
        save_db(SCHEDULE_DB, schedule_db)
        await edit_banner(q, f"✅ Auto Delete: {'Enabled' if schedule_db['auto_delete'] else 'Disabled'}", kb_schedule_settings())
    
    # ── Schedule: Toggle Daily Report ────────────────────────────
    elif d == "SCHED_REPORT":
        schedule_db["daily_report"] = not schedule_db.get("daily_report", True)
        save_db(SCHEDULE_DB, schedule_db)
        await edit_banner(q, f"✅ Daily Report: {'Enabled' if schedule_db['daily_report'] else 'Disabled'}", kb_schedule_settings())
    
    # ── Schedule: Set Report Time ───────────────────────────────
    elif d == "SCHED_TIME":
        ctx.user_data.update({"state": S_SCHEDULE_SET, "msg_id": q.message.message_id})
        await edit_banner(q,
            "⏰ <b>Set Report Time</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "Daily Report ပို့မယ့် အချိန်ကို ရိုက်ထည့်ပါ\n\n"
            "💡 ဥပမာ: <code>08:00</code>  /  <code>22:30</code>\n"
            f"Current: {schedule_db.get('report_time', '08:00')}",
            kb_back("SRV_SCHEDULE")
        )


# ═══════════════════════════════════════════════════════════════
#                    TEXT MESSAGE DISPATCHER
# ═══════════════════════════════════════════════════════════════
async def on_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if not is_admin(uid):
        return
    
    state = ctx.user_data.get("state", S_IDLE)
    text = update.message.text.strip()
    chat_id = update.effective_chat.id
    msg_id = ctx.user_data.get("msg_id")
    
    try:
        await update.message.delete()
    except Exception:
        pass
    
    # ── Create Key: name entered ──────────────────────────────────
    if state == S_KEY_NAME:
        ctx.user_data["pending_name"] = text
        ctx.user_data["state"] = S_IDLE
        name_display = html.escape(text)
        await edit_banner_id(ctx, chat_id, msg_id,
            f"🔑 <b>Key: {name_display}</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            "Data Limit သတ်မှတ်မလား?\n\n"
            "♾️ <b>Unlimited</b> — Limit မလိုပဲ Key ထုတ်တီး\n"
            "📶 <b>Data Limit</b> — Limit ရွေးပြိီး Key ထုတ်တီး",
            InlineKeyboardMarkup([
                [InlineKeyboardButton("♾️ Unlimited",   callback_data="KEY_CONFIRM_NOLIMIT"),
                 InlineKeyboardButton("📶 Data Limit",  callback_data="KEY_CONFIRM_SETLIM")],
                [InlineKeyboardButton("◀️ နောက်သို့",   callback_data="KEY_CREATE")],
            ])
        )
    
    # ── Rename Key ────────────────────────────────────────────────
    elif state == S_RENAME_KEY:
        ctx.user_data["state"] = S_IDLE
        kid = ctx.user_data.get("target_kid", "0")
        try:
            api_local = multi_server.get_api()
            api_local.rename_key(kid, text)
            cap = f"✅ Key #{kid} → <b>{html.escape(text)}</b> ပြောင်းပြီး"
        except Exception as e:
            cap = api_err(e)
        await edit_banner_id(ctx, chat_id, msg_id, cap, kb_key_actions(kid))
    
    # ── Set Data Limit ──────────────────────────────────────────
    elif state == S_SET_LIMIT:
        kid = ctx.user_data.get("target_kid", "0")
        bval = parse_limit(text)
        if bval < 0:
            await ctx.bot.send_message(
                chat_id,
                "❌ Format မမှန်ပါ\nဥပမာ: <code>10 GB</code>  /  <code>500 MB</code>",
                parse_mode=PM,
            )
            return
        ctx.user_data["state"] = S_IDLE
        try:
            api_local = multi_server.get_api()
            api_local.set_limit(kid, bval)
            cap = f"✅ Key #{kid}\nLimit: <b>{fmt_bytes(bval)}</b> သတ်မှတ်ပြီး"
        except Exception as e:
            cap = api_err(e)
        await edit_banner_id(ctx, chat_id, msg_id, cap, kb_key_actions(kid))
    
    # ── Set Expiry ──────────────────────────────────────────────
    elif state == S_EXPIRY_SET:
        kid = ctx.user_data.get("target_kid", "0")
        expiry = parse_expiry(text)
        if not expiry:
            await ctx.bot.send_message(
                chat_id,
                "❌ Format မမှန်ပါ\nဥပမာ: <code>7 days</code>  /  <code>30d</code>  /  <code>2026-12-31</code>",
                parse_mode=PM,
            )
            return
        ctx.user_data["state"] = S_IDLE
        keys_db[kid] = {"expiry": expiry}
        save_db(KEYS_DB, keys_db)
        cap = f"✅ Key #{kid}\n📅 Expiry: <b>{expiry}</b> သတ်မှတ်ပြီး"
        await edit_banner_id(ctx, chat_id, msg_id, cap, kb_key_actions(kid))
    
    # ── Rename Server ────────────────────────────────────────────
    elif state == S_RENAME_SRV:
        ctx.user_data["state"] = S_IDLE
        try:
            api_local = multi_server.get_api()
            api_local.rename_server(text)
            cap = f"✅ Server → <b>{html.escape(text)}</b>"
        except Exception as e:
            cap = api_err(e)
        await edit_banner_id(ctx, chat_id, msg_id, cap, kb_back("SRV_SETTINGS"))
    
    # ── Set Default Limit ────────────────────────────────────────
    elif state == S_DEF_LIMIT:
        bval = parse_limit(text)
        if bval < 0:
            await ctx.bot.send_message(
                chat_id,
                "❌ Format မမှန်ပါ\nဥပမာ: <code>10 GB</code>",
                parse_mode=PM,
            )
            return
        ctx.user_data["state"] = S_IDLE
        try:
            api_local = multi_server.get_api()
            api_local.set_def_limit(bval)
            cap = f"✅ Default Limit: <b>{fmt_bytes(bval)}</b>"
        except Exception as e:
            cap = api_err(e)
        await edit_banner_id(ctx, chat_id, msg_id, cap, kb_back("SRV_SETTINGS"))
    
    # ── Create Key: custom limit ────────────────────────────────
    elif state == S_KEY_SETLIM:
        bval = parse_limit(text)
        if bval < 0:
            await ctx.bot.send_message(
                chat_id,
                "❌ Format မမှန်ပါ\nဥပမာ: <code>10 GB</code>  /  <code>500 MB</code>",
                parse_mode=PM,
            )
            return
        ctx.user_data["state"] = S_IDLE
        name = ctx.user_data.get("pending_name", "")
        try:
            api_local = multi_server.get_api()
            key = api_local.create_key()
            kid = str(key["id"])
            if name:
                api_local.rename_key(kid, name)
                key["name"] = name
            api_local.set_limit(kid, bval)
            key.setdefault("dataLimit", {})["bytes"] = bval
            cap = f"✅ <b>Key ဖန်တီးပြိီးပြိီး!</b>\n📶 Limit: <b>{fmt_bytes(bval)}</b>\n\n" + build_key_caption(key, 0)
            kb = kb_key_actions(kid)
        except Exception as e:
            cap, kb = api_err(e), kb_back()
        await edit_banner_id(ctx, chat_id, msg_id, cap, kb)
    
    # ── Add Server ──────────────────────────────────────────────
    elif state == S_SERVER_ADD:
        ctx.user_data["state"] = S_IDLE
        try:
            parts = text.split("|")
            if len(parts) != 2:
                await ctx.bot.send_message(
                    chat_id,
                    "❌ Format မှားနေပါတယ်\nFormat: <code>ServerName | https://ip:port/api-key</code>",
                    parse_mode=PM,
                )
                return
            name = parts[0].strip()
            url = parts[1].strip()
            multi_server.add_server(name, url)
            cap = f"✅ Server <b>{name}</b> added successfully!"
        except Exception as e:
            cap = api_err(e)
        await edit_banner_id(ctx, chat_id, msg_id, cap, kb_multi_servers())
    
    # ── Remove Server ────────────────────────────────────────────
    elif state == S_SERVER_REMOVE:
        ctx.user_data["state"] = S_IDLE
        name = text.strip()
        if name not in multi_server.list_servers():
            await ctx.bot.send_message(
                chat_id,
                f"❌ Server <b>{name}</b> not found\nAvailable: {', '.join(multi_server.list_servers())}",
                parse_mode=PM,
            )
            return
        multi_server.remove_server(name)
        cap = f"✅ Server <b>{name}</b> removed successfully!"
        await edit_banner_id(ctx, chat_id, msg_id, cap, kb_multi_servers())
    
    # ── Set Schedule Time ────────────────────────────────────────
    elif state == S_SCHEDULE_SET:
        ctx.user_data["state"] = S_IDLE
        # Validate time format (HH:MM)
        try:
            datetime.strptime(text, "%H:%M")
            schedule_db["report_time"] = text
            save_db(SCHEDULE_DB, schedule_db)
            cap = f"✅ Report time set to <b>{text}</b>"
        except:
            cap = "❌ Invalid time format. Use HH:MM (e.g., 08:00)"
        await edit_banner_id(ctx, chat_id, msg_id, cap, kb_schedule_settings())
    
    # ── Broadcast Message ────────────────────────────────────────
    elif state == S_BROADCAST:
        ctx.user_data["state"] = S_IDLE
        
        users = load_db(USERS_DB)
        if not users:
            await ctx.bot.send_message(chat_id, "📭 No users to broadcast to yet")
            return
        
        success = 0
        failed = 0
        
        for uid in users.keys():
            try:
                await ctx.bot.send_message(
                    int(uid),
                    f"📢 <b>Announcement</b>\n"
                    "━━━━━━━━━━━━━━━━\n"
                    f"{html.escape(text)}\n"
                    "━━━━━━━━━━━━━━━━\n"
                    f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                    parse_mode=PM
                )
                success += 1
            except Exception:
                failed += 1
            await asyncio.sleep(0.1)
        
        cap = (
            f"✅ <b>Broadcast Complete</b>\n"
            "━━━━━━━━━━━━━━━━\n"
            f"📤 Sent: <b>{success}</b> users\n"
            f"❌ Failed: <b>{failed}</b> users\n"
            f"📝 Message: {html.escape(text[:50])}{'...' if len(text) > 50 else ''}"
        )
        await edit_banner_id(ctx, chat_id, msg_id, cap, kb_back("MAIN"))
    
    # ── No active state ────────────────────────────────────────
    else:
        await ctx.bot.send_message(chat_id, "💡 /start နှိပပါ", parse_mode=PM)


# ═══════════════════════════════════════════════════════════════
#                     GLOBAL ERROR HANDLER
# ═══════════════════════════════════════════════════════════════
async def on_error(update: object, ctx: ContextTypes.DEFAULT_TYPE):
    log.error("Unhandled exception:", exc_info=ctx.error)
    if isinstance(update, Update) and update.effective_message:
        try:
            await update.effective_message.reply_text(
                f"⚠️ Unexpected Error:\n<code>{esc(ctx.error)}</code>",
                parse_mode=PM,
            )
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════
#                          ENTRY POINT
# ═══════════════════════════════════════════════════════════════
def main():
    app = Application.builder().token(BOT_TOKEN).build()
    f = filters.User(user_id=list(ADMIN_IDS))
    
    # Commands
    app.add_handler(CommandHandler("start", cmd_start, filters=f))
    app.add_handler(CommandHandler("menu", cmd_start, filters=f))
    app.add_handler(CommandHandler("help", cmd_help, filters=f))
    app.add_handler(CommandHandler("broadcast", cmd_broadcast, filters=f))
    app.add_handler(CommandHandler("announce", cmd_broadcast, filters=f))
    
    # Handlers
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND & f, on_message))
    app.add_error_handler(on_error)
    
    # ── Scheduled Tasks (every hour) ──────────────────────────
    job_queue = app.job_queue
    if job_queue:
        job_queue.run_repeating(scheduled_tasks, interval=3600, first=60)
        log.info("⏰ Scheduled tasks enabled (every hour)")
    
    log.info("🔒 Outline VPN Bot v3 — started (polling)")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()