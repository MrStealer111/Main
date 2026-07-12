# KoPudding VPN

Marzban ကို အခြေခံထားတဲ့ VPN Management Panel ဖြစ်ပြီး KoPudding ရဲ့ ကိုယ်ပိုင် Dark Theme နဲ့ Telegram Bot ပါဝင်ပါတယ်။

![Dashboard](https://raw.githubusercontent.com/MrStealer111/Main/main/screenshots/dashboard.png)

## အသုံးပြုပုံ

### VPS ပေါ်မှာ Run ရန်

**၁။ Source Code ကို Download လုပ်ပါ**
```bash
git clone https://github.com/MrStealer111/Main.git kopudding-marzban
cd kopudding-marzban
```

**၂။ Config ချိန်ပါ**
```bash
cp .env.example .env
nano .env
```
`.env` ထဲမှာ အောက်ပါတွေကို ဖြည့်ပါ

| Variable | ရှင်းလင်းချက် | ဥပမာ |
|----------|---------------|-------|
| `ADMIN_USERNAME` | Dashboard login နာမည် | `admin` |
| `ADMIN_PASSWORD` | Dashboard စကားဝှက် | `kopudding2024` |
| `TELEGRAM_API_TOKEN` | Telegram Bot Token (@BotFather ကနေရယူပါ) | `888764...` |
| `TELEGRAM_ADMIN_ID` | Admin Telegram ID (ကော်မာခြားရေးပါ) | `6357622851,5205818621` |
| `SQLALCHEMY_DATABASE_URL` | Database လမ်းကြောင်း | `sqlite:////var/lib/marzban/db.sqlite3` |

**၃။ Docker နဲ့ Start လုပ်ပါ**
```bash
docker compose up -d
```

![Terminal](https://raw.githubusercontent.com/MrStealer111/Main/main/screenshots/terminal.png)

**၄။ Dashboard ကိုဖွင့်ပါ**
```
http://<your-vps-ip>:8000/dashboard
```

## Screenshots

![Login Page](https://raw.githubusercontent.com/MrStealer111/Main/main/screenshots/login.png)
![Dashboard](https://raw.githubusercontent.com/MrStealer111/Main/main/screenshots/dashboard.png)
![Subscription Page](https://raw.githubusercontent.com/MrStealer111/Main/main/screenshots/subscription.png)
![Telegram Bot](https://raw.githubusercontent.com/MrStealer111/Main/main/screenshots/telegram.png)

## Telegram Bot

Bot Username: `@KoPudding_OutlineVpnKeyBot`

### Admin Commands
- `/start` — Admin Panel (user management, system stats)
- User Create / Delete / Suspend / Edit
- System Restart, bandwidth usage ကြည့်ခြင်း

### User Commands
- `/usage` — ကိုယ့် Subscription Info ကြည့်ခြင်း

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name marzban.kopudding.cc.cd;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Docker Image ကိုယ်တိုင် Build လုပ်ရန်

```bash
docker build -f Dockerfile.kopudding -t kopudding/marzban:latest .
```

## မှတ်ချက်
- Dashboard URL: `https://marzban.kopudding.cc.cd/dashboard`
- Username: `admin`
- Password: `kopudding2024`
- Admin Telegram IDs: `6357622851`, `5205818621`

## License
Based on [Gozargah/Marzban](https://github.com/Gozargah/Marzban)
