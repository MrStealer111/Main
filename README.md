# KoPudding VPN — Marzban Dashboard

KoPudding VPN Management Panel (Marzban-based) with custom dark theme and Telegram bot integration.

## Features
- KoPudding branded dark theme dashboard
- Telegram bot for admin management (@KoPudding_OutlineVpnKeyBot)
- Shadowsocks TCP inbound only
- User management (create, delete, suspend, edit)
- Subscription page with QR codes & direct connect links

## Quick Start

bash
git clone https://github.com/MrStealer111/Main.git kopudding-marzban
cd kopudding-marzban
cp .env.example .env
nano .env
docker compose up -d


## Environment Variables

ADMIN_USERNAME - Dashboard admin username (default: admin)
ADMIN_PASSWORD - Dashboard admin password
TELEGRAM_API_TOKEN - Bot token from @BotFather
TELEGRAM_ADMIN_ID - Comma-separated Telegram user IDs
UVICORN_HOST - Bind address (default: 0.0.0.0)
UVICORN_PORT - Port (default: 8000)

## Telegram Bot Commands

Admin: /start - Admin panel, User create/edit/delete, system stats
Users: /usage - Check subscription status

## License
Based on Gozargah/Marzban
