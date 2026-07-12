# KoPudding VPN

Marzban ကို အခြေခံထားတဲ့ VPN Management Panel ဖြစ်ပြီး KoPudding ရဲ့ ကိုယ်ပိုင် Dark Theme နဲ့ Telegram Bot ပါဝင်ပါတယ်။

![Dashboard](screenshots/dashboard.png)

## VPS ပေါ်မှာ Run ရန်

**၁။ Source Code ကို Download လုပ်ပါ**
bash
git clone https://github.com/MrStealer111/Main.git kopudding-marzban
cd kopudding-marzban


**၂။ Config ချိန်ပါ**
bash
cp .env.example .env
nano .env


**.env ထဲမှာ ဖြည့်ရန်**

| Variable | ရှင်းလင်းချက် | ဥပမာ |
|----------|---------------|-------|
| ADMIN_USERNAME | Dashboard login နာမည် | admin |
| ADMIN_PASSWORD | Dashboard စကားဝှက် | your_secure_password |
| TELEGRAM_API_TOKEN | Bot Token (@BotFather) | 123456:ABC-DEF1234 |
| TELEGRAM_ADMIN_ID | Admin Telegram ID များ | 123456789,987654321 |
| SQLALCHEMY_DATABASE_URL | Database လမ်းကြောင်း | sqlite:////var/lib/marzban/db.sqlite3 |

**၃။ Docker နဲ့ Start လုပ်ပါ**
bash
docker compose up -d


**၄။ Dashboard ကိုဖွင့်ပါ**
http://<your-vps-ip>:8000/dashboard


## Screenshots

![Login Page](screenshots/login.png)
![Dashboard](screenshots/dashboard.png)
![Subscription Page](screenshots/subscription.png)
![Telegram Bot](screenshots/telegram.png)

## Telegram Bot အင်္ဂါရပ်များ

**Admin Commands:**
- /start - Admin Panel
- User Create / Delete / Suspend / Edit
- System statistics ကြည့်ခြင်း

**User Commands:**
- /usage - ကိုယ့် Subscription Info ကြည့်ခြင်း

## Nginx Reverse Proxy ချိန်းနည်း
bash
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}


## Docker Image ကိုယ်တိုင် Build လုပ်ရန်
bash
docker build -f Dockerfile.kopudding -t kopudding/marzban:latest .


## License
Based on Gozargah/Marzban
