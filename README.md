# KoPudding VPN

Marzban ကို အခြေခံထားသော VPN Management Panel ဖြစ်ပြီး KoPudding Dark Theme နှင့် Telegram Bot ပါဝင်သည်။

---

## မလုပ်ဆောင်မီ လိုအပ်ပစ္စည်းများ

- **VPS** (Ubuntu 20.04+ / Debian 11+)
- **SSH Client** (Termius / Putty)
- **Domain Name** (Optional — Telegram Bot သုံးလျှင် လိုအပ်)

---

# 1️⃣ VPS တစ်ခုတည်း (Telegram Bot မပါ)

> VPS IP ကိုသုံးပြီး Dashboard ဖွင့်မည်။ Domain မလို၊ Telegram Bot မပါ။

## Termius (Android) အတွက် အဆင့်ဆင့်

Command တစ်ခုချင်းစီကို **တစ်ခါတည်းအကုန်ကူးပြီး Paste မလုပ်ပါနဲ့။** တစ်ကြောင်းချင်းစီ ကူးထည့်ပါ။

### အဆင့် ၁ — System Update

```bash
sudo apt update && sudo apt upgrade -y
```

### အဆင့် ၂ — Docker သွင်းရန်

```bash
curl -fsSL https://get.docker.com | sh
```

### အဆင့် ၃ — Source Code Download

```bash
git clone https://github.com/MrStealer111/Main.git kopudding-marzban
cd kopudding-marzban
```

### အဆင့် ၄ — Config ချိန်ရန်

```bash
cp .env.example .env
nano .env
```

nano ဖွင့်ပြီးရင် အောက်ပါတို့ကိုဖြည့်ပါ —

```
SUDO_USERNAME = "admin"
SUDO_PASSWORD = "your-password-here"
```

ပြီးရင် `Ctrl + X` → `Y` → `Enter` နှိပ်ပြီး သိမ်းပါ။

### အဆင့် ၅ — Docker နဲ့ Run ရန်

```bash
docker compose up -d
```

Build လုပ်ဖို့ ၅-၁၀ မိနစ်ခန့်ကြာနိုင်သည်။

### အဆင့် ၆ — Dashboard ဖွင့်ရန်

VPS IP ကိုရှာရန် —

```bash
curl -s ifconfig.me
```

Browser မှာဖွင့်ပါ —

```
http://<vps-ip>:8000/dashboard
```

---

# 2️⃣ VPS + Domain (Telegram Bot ပါ)

> Domain Name ရှိသူများအတွက်။ Telegram Bot ပါအလုပ်လုပ်မည်။

### အဆင့် ၁-၄ — အပေါ်ကအတိုင်း

အဆင့် ၁ ကနေ ၄ အထိ အပေါ်က VPS တစ်ခုတည်းအတိုင်း ပထမဆုံးလုပ်ပါ။

### အဆင့် ၅ — nginx သွင်းရန်

```bash
sudo apt install nginx -y
```

### အဆင့် ၆ — nginx config ချိန်ရန်

```bash
sudo nano /etc/nginx/sites-available/default
```

အောက်ပါတို့ကိုထည့်ပါ (`your-domain.com` ကိုပြောင်းပါ) —

```nginx
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
```

### အဆင့် ၇ — nginx restart

```bash
sudo systemctl restart nginx
```

### အဆင့် ၈ — .env ထဲမှာ Telegram Bot ထည့်ရန်

```bash
nano .env
```

အောက်ပါတို့ကိုထည့်ပါ —

```
TELEGRAM_API_TOKEN = "1234567890:ABCdefGHIjklmNOPqrstUVwxyz"
TELEGRAM_ADMIN_ID = "6357622851,5205818621"
```

### အဆင့် ၉ — Container Restart

```bash
docker compose restart
```

### အဆင့် ၁၀ — Cloudflare ချိတ်ရန်

Cloudflare Dashboard မှာ —

1. Domain ကိုထည့်ပါ
2. DNS → Add Record → Type `A`, Name `@`, Content `VPS-IP`
3. Proxy Status → `Proxied` (orange cloud)
4. SSL/TLS → `Full (Strict)`

---

## Telegram Bot Commands

| Command | ရှင်းလင်းချက် |
|---------|---------------|
| `/start` | Admin Panel (user management, system stats) |
| `/usage` | ကိုယ့် Subscription Info ကြည့်ရန် |

---

## Docker Commands

| Command | ရှင်းလင်းချက် |
|---------|---------------|
| `docker compose up -d` | Start (နောက်ခံ) |
| `docker compose down` | Stop |
| `docker compose restart` | Restart |
| `docker compose logs -f` | Log ကြည့် |
| `docker compose build` | Rebuild |

---

## Screenshots

![Screenshot](screenshots/ss1.png)

> Screenshots များကို `screenshots/` folder အတွင်းသို့ ထည့်သွင်းနိုင်ပါသည်။
