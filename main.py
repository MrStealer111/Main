import telebot, random, re, time, requests
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton

# ✅ Bot Token
TOKEN = "8004354283:AAGz34ePTQVvHHcjsGICEy52tHeMfYZRS9k"
bot = telebot.TeleBot(TOKEN)

# ✅ Owner ID (change to your own Telegram ID)
OWNER_ID = 6768862370  

# ==============================
# 🛡️ Ban/User Helpers
# ==============================
def get_users():
    try:
        with open("users.txt", "r") as f:
            return f.read().splitlines()
    except FileNotFoundError:
        return []

def get_banned():
    try:
        with open("banned.txt", "r") as f:
            return f.read().splitlines()
    except FileNotFoundError:
        return []

def is_banned(user_id, username):
    banned = get_banned()
    return str(user_id) in banned or (username and username in banned)

# ✅ Luhn Algorithm
def luhn(card):
    nums = [int(x) for x in card]
    return (sum(nums[-1::-2]) + sum(sum(divmod(2 * x, 10)) for x in nums[-2::-2])) % 10 == 0

# ✅ Generate credit card number
def generate_card(bin_format):
    bin_format = bin_format.lower()
    if len(bin_format) < 16:
        bin_format += "x" * (16 - len(bin_format))
    else:
        bin_format = bin_format[:16]
    while True:
        cc = ''.join(str(random.randint(0, 9)) if x == 'x' else x for x in bin_format)
        if luhn(cc):
            return cc

# ✅ Fetch BIN info using Binlist API
def get_bin_info(bin_number):
    try:
        res = requests.get(f"https://lookup.binlist.net/{bin_number}")
        if res.status_code == 200:
            data = res.json()
            bank = data.get("bank", {}).get("name", "Unknown Bank")
            country = data.get("country", {}).get("name", "Unknown Country")
            flag = data.get("country", {}).get("emoji", "")
            scheme = data.get("scheme", "").upper()
            ctype = data.get("type", "").upper()
            brand = data.get("brand", "")
            bin_info = f"{scheme} - {ctype}" if scheme and ctype else "UNKNOWN"
            return bank, f"{country} {flag}", bin_info
    except:
        pass
    return "Unknown Bank", "Unknown Country", "UNKNOWN"

# ✅ Generate card info block
def generate_output(bin_input, username):
    parts = bin_input.split("|")
    bin_format = parts[0] if len(parts) > 0 else ""
    mm_input = parts[1] if len(parts) > 1 and parts[1] != "xx" else None
    yy_input = parts[2] if len(parts) > 2 and parts[2] != "xxxx" else None
    cvv_input = parts[3] if len(parts) > 3 and parts[3] != "xxx" else None

    bin_clean = re.sub(r"[^\d]", "", bin_format)[:6]

    if not bin_clean.isdigit() or len(bin_clean) < 6:
        return f"❌ Invalid BIN provided.\n\nExample:\n<code>/gen 545231xxxxxxxxxx|03|27|xxx</code>"

    # ✅ Get real BIN details
    bank, country, bin_info = get_bin_info(bin_clean)

    cards = []
    start = time.time()
    for _ in range(10):
        cc = generate_card(bin_format)
        mm = mm_input if mm_input else str(random.randint(1, 12)).zfill(2)
        yy_full = yy_input if yy_input else str(random.randint(2026, 2032))
        yy = yy_full[-2:]
        cvv = cvv_input if cvv_input else str(random.randint(100, 999))
        cards.append(f"<code>{cc}|{mm}|{yy}|{cvv}</code>")
    elapsed = round(time.time() - start, 3)

    card_lines = "\n".join(cards)

    text = f"""<b>───────────────</b>
<b>Bank</b> - ↯ {bank}
<b>Country</b> - ↯ {country}
<b>BIN Info</b> - ↯ {bin_info}
<b>───────────────</b>
<b>Bin</b> - ↯ {bin_clean} | <b>Time</b> - ↯ {elapsed}s
<b>Input</b> - ↯ <code>{bin_input}</code>
<b>───────────────</b>
{card_lines}
<b>───────────────</b>
<b>Requested By</b> - ↯ @{username} [Free]
"""
    return text

# ✅ /start command
@bot.message_handler(commands=['start'])
def start_handler(message):
    if is_banned(message.from_user.id, message.from_user.username):
        return bot.reply_to(message, "Sorry, you got banned by admin")

    # Save user ID + username
    user_id = str(message.from_user.id)
    username = message.from_user.username or "anonymous"
    entry = f"{user_id}:{username}"

    with open("users.txt", "a+") as f:
        f.seek(0)
        users = f.read().splitlines()
        if entry not in users:
            f.write(entry + "\n")

    # Response message
    text = (
       "🤖 Bot Status: Active ✅\n\n"
       "✍️ Commands : /gen (your card number),/fake (Country),/Country (To show supported countries),/ask (to use chat gpt)\n\n"
       "📢 For errors and problems, contact me 👉 [here](t.me/KKT690)\n\n"
       "💡 Tip: To use this bot in your group, make sure I'm added as admin."
    )
    bot.reply_to(message, text, parse_mode="Markdown")

# ✅ /gen command
@bot.message_handler(commands=['gen'])
def gen_handler(message):
    if is_banned(message.from_user.id, message.from_user.username):
        return bot.reply_to(message, "Sorry, you got banned by admin")

    parts = message.text.split(" ", 1)
    if len(parts) < 2:
        return bot.reply_to(message, "⚠️ Example:\n<code>/gen 545231xxxxxxxxxx|03|27|xxx</code>", parse_mode="HTML")

    bin_input = parts[1].strip()
    username = message.from_user.username or "anonymous"
    text = generate_output(bin_input, username)

    btn = InlineKeyboardMarkup()
    btn.add(InlineKeyboardButton("Re-Generate ♻️", callback_data=f"again|{bin_input}"))
    bot.reply_to(message, text, parse_mode="HTML", reply_markup=btn)

# ✅ /gen button callback
@bot.callback_query_handler(func=lambda call: call.data.startswith("again|"))
def again_handler(call):
    if is_banned(call.from_user.id, call.from_user.username):
        return bot.answer_callback_query(call.id, "Sorry, you got banned by admin", show_alert=True)

    bin_input = call.data.split("|", 1)[1]
    username = call.from_user.username or "anonymous"
    text = generate_output(bin_input, username)

    btn = InlineKeyboardMarkup()
    btn.add(InlineKeyboardButton("Re-Generate ♻️", callback_data=f"again|{bin_input}"))

    try:
        bot.edit_message_text(chat_id=call.message.chat.id,
                              message_id=call.message.message_id,
                              text=text,
                              parse_mode="HTML",
                              reply_markup=btn)
    except:
        bot.send_message(call.message.chat.id, text, parse_mode="HTML", reply_markup=btn)

# ✅ /ask command
@bot.message_handler(commands=['ask'])
def ask_handler(message):
    if is_banned(message.from_user.id, message.from_user.username):
        return bot.reply_to(message, "Sorry, you got banned by admin")

    parts = message.text.split(" ", 1)
    if len(parts) < 2:
        return bot.reply_to(message, "❓ Usage: `/ask your question`", parse_mode="Markdown")
    
    prompt = parts[1]
    try:
        res = requests.get(f"https://gpt-3-5.apis-bj-devs.workers.dev/?prompt={prompt}")
        if res.status_code == 200:
            data = res.json()
            if data.get("status") and data.get("reply"):
                reply = data["reply"]
                bot.reply_to(message, f"*{reply}*", parse_mode="Markdown")
            else:
                bot.reply_to(message, "❌ Couldn't parse reply from API.", parse_mode="Markdown")
        else:
            bot.reply_to(message, "❌ GPT API failed to respond.", parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"❌ Error: `{e}`", parse_mode="Markdown")

# ✅ /fake command
@bot.message_handler(commands=['fake'])
def fake_address_handler(message):
    if is_banned(message.from_user.id, message.from_user.username):
        return bot.reply_to(message, "Sorry, you got banned by admin")

    parts = message.text.split(" ", 1)
    if len(parts) < 2:
        return bot.reply_to(message, "⚠️ Example:\n`/fake us`", parse_mode="Markdown")

    country_code = parts[1].strip().lower()

    supported = [
        "au","br","ca","ch","de","dk","es","fi","fr","gb",
        "ie","ir","no","nl","nz","tr","us"
    ]

    if country_code not in supported:
        return bot.reply_to(
            message,
            "❌ This country is not supported.\n\n✅ Use /country to see available options.",
            parse_mode="Markdown"
        )

    url = f"https://randomuser.me/api/?nat={country_code}"
    try:
        res = requests.get(url).json()
        user = res['results'][0]

        name = f"{user['name']['first']} {user['name']['last']}"
        addr = user['location']
        full_address = f"{addr['street']['number']} {addr['street']['name']}"
        city = addr['city']
        state = addr['state']
        zip_code = addr['postcode']
        country = addr['country']

        msg = f"""📦 *Fake Address Info*

👤 *Name:* `{name}`
🏠 *Address:* `{full_address}`
🏙️ *City:* `{city}`
🗺️ *State:* `{state}`
📮 *ZIP:* `{zip_code}`
🌐 *Country:* {country.upper()}"""

        bot.reply_to(message, msg, parse_mode="Markdown")
    except Exception:
        bot.reply_to(message, "❌ Something went wrong. Please try again later.", parse_mode="Markdown")

# ✅ /country command
@bot.message_handler(commands=['country'])
def country_command(message):
    if is_banned(message.from_user.id, message.from_user.username):
        return bot.reply_to(message, "Sorry, you got banned by admin")

    msg = """🌍 *Supported Countries:*

1. Australia (AU)
2. Brazil (BR)
3. Canada (CA)
4. Switzerland (CH)
5. Germany (DE)
6. Denmark (DK)
7. Spain (ES)
8. Finland (FI)
9. France (FR)
10. United Kingdom (GB)
11. Ireland (IE)
12. Iran (IR)
13. Norway (NO)
14. Netherlands (NL)
15. New Zealand (NZ)
16. Turkiye (TR)
17. United States (US)"""
    bot.reply_to(message, msg, parse_mode="Markdown")

# ✅ Broadcast command
@bot.message_handler(commands=['broadcast'])
def broadcast_handler(message):
    if message.from_user.id != OWNER_ID:
        return bot.reply_to(message, "🚫 You are not authorized to use this command.")

    try:
        _, text = message.text.split(" ", 1)
    except:
        return bot.reply_to(message, "⚠️ Usage:\n`/broadcast Your message here`", parse_mode="Markdown")

    bot.reply_to(message, "📢 Sending broadcast to all users...")

    try:
        with open("users.txt", "r") as f:
            users = f.read().splitlines()
    except FileNotFoundError:
        return bot.send_message(message.chat.id, "❌ No users found in users.txt")

    sent, failed = 0, 0
    for entry in users:
        uid = entry.split(":")[0]
        if uid in get_banned():
            continue
        try:
            bot.send_message(uid, f"📢 *Broadcast Message:*\n\n{text}", parse_mode="Markdown")
            sent += 1
            time.sleep(0.1)
        except:
            failed += 1
            continue

    bot.send_message(
        message.chat.id,
        f"✅ Broadcast completed.\n\n🟢 Sent: `{sent}`\n🔴 Failed: `{failed}`",
        parse_mode="Markdown"
    )

# ==============================
# 🛡️ Extra Admin Commands
# ==============================
@bot.message_handler(commands=['check'])
def check_handler(message):
    if message.from_user.id != OWNER_ID:
        return bot.reply_to(message, "🚫 You are not authorized to use this command.")

    users = get_users()
    if not users:
        return bot.reply_to(message, "❌ No users found.")

    msg = "👥 *Bot Users List:*\n\n"
    for u in users:
        parts = u.split(":")
        if len(parts) == 2:
            uid, uname = parts
            msg += f"- `{uid}` (@{uname})\n"
        else:
            msg += f"- `{u}`\n"

    bot.reply_to(message, msg, parse_mode="Markdown")

# ✅ /ban
@bot.message_handler(commands=['ban'])
def ban_handler(message):
    if message.from_user.id != OWNER_ID:
        return bot.reply_to(message, "🚫 You are not authorized to use this command.")
    
    parts = message.text.split(" ", 1)
    if len(parts) < 2:
        return bot.reply_to(message, "⚠️ Usage:\n`/ban @username`", parse_mode="Markdown")

    target = parts[1].strip().replace("@", "")

    with open("banned.txt", "a+") as f:
        f.seek(0)
        if target not in f.read().splitlines():
            f.write(target + "\n")

    bot.reply_to(message, f"✅ User @{target} has been banned.", parse_mode="Markdown")

# ✅ /unban
@bot.message_handler(commands=['unban'])
def unban_handler(message):
    if message.from_user.id != OWNER_ID:
        return bot.reply_to(message, "🚫 You are not authorized to use this command.")
    
    parts = message.text.split(" ", 1)
    if len(parts) < 2:
        return bot.reply_to(message, "⚠️ Usage:\n`/unban @username`", parse_mode="Markdown")

    target = parts[1].strip().replace("@", "")

    try:
        with open("banned.txt", "r") as f:
            lines = f.read().splitlines()
        with open("banned.txt", "w") as f:
            for line in lines:
                if line != target:
                    f.write(line + "\n")
    except FileNotFoundError:
        return bot.reply_to(message, "❌ No banned users found.")

    bot.reply_to(message, f"✅ User @{target} has been unbanned.", parse_mode="Markdown")

print("🤖 Bot is running...")
bot.polling()
