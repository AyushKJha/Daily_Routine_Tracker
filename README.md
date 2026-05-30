# 🗓️ Daily Routine Tracker

A **fully deployable, multi-user** daily habit tracking web app with:
- 🔐 Secure user authentication (PBKDF2 hashing, JWT tokens)
- 🗄️ SQLite backend — zero external dependencies
- 📊 Progress charts, flowchart, bar graphs
- 🤖 AI coach powered by Claude
- 📋 Per-user input logs sidebar
- 💾 3 saves/day limit enforced server-side

---

## 🚀 Quick Start

```bash
# Python 3.10+ required (uses stdlib only — no pip install needed)
python3 server.py
```

Then open: **http://localhost:8000**

---

## 📁 File Structure

```
tracker/
├── server.py          ← Python backend (single file, no deps)
├── tracker.db         ← SQLite database (auto-created)
├── README.md
└── static/
    └── index.html     ← Full frontend SPA
```

---

## 🌐 Production Deployment

### Option A — Any Linux VPS (recommended)

```bash
# 1. Copy files to server
scp -r tracker/ user@yourserver.com:~/

# 2. SSH in and run
ssh user@yourserver.com
cd tracker
python3 server.py
```

For background/persistent running:
```bash
# Using nohup
JWT_SECRET=your_super_secret_here nohup python3 server.py > server.log 2>&1 &

# Or using systemd (recommended for production)
# See systemd section below
```

### Option B — Systemd Service (auto-restart, runs on boot)

Create `/etc/systemd/system/tracker.service`:
```ini
[Unit]
Description=Daily Routine Tracker
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/tracker
Environment=JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_STRING
Environment=PORT=8000
ExecStart=/usr/bin/python3 server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable tracker
sudo systemctl start tracker
sudo systemctl status tracker
```

### Option C — Behind Nginx (HTTPS + domain)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

For HTTPS: `sudo certbot --nginx -d yourdomain.com`

### Option D — Render.com (free tier)

1. Push to GitHub
2. Create new Web Service on render.com
3. Build command: (none)
4. Start command: `python3 server.py`
5. Add env var: `JWT_SECRET=your_secret_here`

### Option E — Railway / Fly.io

```bash
# Railway
railway init && railway up

# Fly.io
fly launch && fly deploy
```

---

## 🔐 Security Notes

- Set `JWT_SECRET` environment variable to a long random string in production
- Passwords are hashed with PBKDF2-SHA256 (260,000 iterations)
- Tokens expire after 7 days
- 3 saves/day limit is enforced server-side per user

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | auto-generated | Secret for JWT signing. **Set this in production!** |
| `PORT` | 8000 | Port to listen on |

---

## 🗄️ Database

SQLite database is created automatically at `tracker.db`.

Tables:
- `users` — username, email, hashed password
- `daily_logs` — per-user per-day habit records (max 3 saves/day)
- `input_logs` — detailed input entries per habit check-in

To backup:
```bash
cp tracker.db tracker_backup_$(date +%Y%m%d).db
```

---

## 🏋️ Habits Tracked

1. **Exercise / Workout** — muscle groups, cardio, duration
2. **Diet & Nutrition** — protein goal, meals logged
3. **8 Hr Study** — topics, actual hours
4. **DSA** — question count, difficulty, logic used
5. **Project** — idea/changes, GitHub push status

Each habit supports ✓ (done) and ✗ (alternative) with detailed popups.
