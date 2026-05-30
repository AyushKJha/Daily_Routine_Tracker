#!/usr/bin/env python3
"""
Daily Routine Tracker — Self-contained Python backend
Run: python3 server.py
Then open: http://localhost:8000
"""
import json, sqlite3, hashlib, hmac, base64, time, uuid, os, re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta
import secrets

# ──────────────────────────────────────────
#  CONFIG
# ──────────────────────────────────────────
PORT      = 8000
DB_PATH   = "tracker.db"
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
TOKEN_EXP  = 7 * 24 * 3600  # 7 days

# ──────────────────────────────────────────
#  DATABASE
# ──────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    with get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id        TEXT PRIMARY KEY,
            username  TEXT UNIQUE NOT NULL,
            email     TEXT UNIQUE NOT NULL,
            password  TEXT NOT NULL,
            created   TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS daily_logs (
            id       TEXT PRIMARY KEY,
            user_id  TEXT NOT NULL,
            date     TEXT NOT NULL,
            habits   TEXT NOT NULL DEFAULT '{}',
            crosses  TEXT NOT NULL DEFAULT '{}',
            details  TEXT NOT NULL DEFAULT '{}',
            score    INTEGER NOT NULL DEFAULT 0,
            saved_at TEXT NOT NULL,
            save_count INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(user_id, date)
        );
        CREATE TABLE IF NOT EXISTS input_logs (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            date       TEXT NOT NULL,
            habit_id   TEXT NOT NULL,
            habit_label TEXT NOT NULL,
            completed  INTEGER NOT NULL,
            data       TEXT NOT NULL DEFAULT '{}',
            ts         TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        """)
    print(f"[DB] Initialised at {DB_PATH}")

# ──────────────────────────────────────────
#  JWT (minimal, no deps)
# ──────────────────────────────────────────
def b64url_enc(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def b64url_dec(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (pad % 4))

def create_token(payload: dict) -> str:
    header  = b64url_enc(json.dumps({"alg":"HS256","typ":"JWT"}).encode())
    body    = b64url_enc(json.dumps(payload).encode())
    sig_input = f"{header}.{body}".encode()
    sig     = b64url_enc(hmac.new(JWT_SECRET.encode(), sig_input, hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"

def verify_token(token: str) -> dict | None:
    try:
        parts = token.split(".")
        if len(parts) != 3: return None
        header, body, sig = parts
        sig_input = f"{header}.{body}".encode()
        expected  = b64url_enc(hmac.new(JWT_SECRET.encode(), sig_input, hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected): return None
        payload = json.loads(b64url_dec(body))
        if payload.get("exp", 0) < time.time(): return None
        return payload
    except Exception:
        return None

# ──────────────────────────────────────────
#  PASSWORD HASHING (PBKDF2, stdlib)
# ──────────────────────────────────────────
def hash_password(pw: str) -> str:
    salt = secrets.token_hex(16)
    dk   = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 260000)
    return f"pbkdf2:sha256:260000:{salt}:{dk.hex()}"

def check_password(pw: str, stored: str) -> bool:
    try:
        _, alg, iters, salt, dk_hex = stored.split(":")
        dk = hashlib.pbkdf2_hmac(alg.replace("sha","sha"), pw.encode(), salt.encode(), int(iters))
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False

# ──────────────────────────────────────────
#  HELPERS
# ──────────────────────────────────────────
def today_str():
    return datetime.utcnow().strftime("%Y-%m-%d")

def json_resp(handler, status: int, data):
    body = json.dumps(data).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", len(body))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)

def get_token_from_req(handler) -> str | None:
    auth = handler.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    cookie = handler.headers.get("Cookie", "")
    for c in cookie.split(";"):
        c = c.strip()
        if c.startswith("token="):
            return c[6:]
    return None

def require_auth(handler):
    tok = get_token_from_req(handler)
    if not tok:
        json_resp(handler, 401, {"error": "Not authenticated"})
        return None
    payload = verify_token(tok)
    if not payload:
        json_resp(handler, 401, {"error": "Invalid or expired token"})
        return None
    return payload

def read_body(handler) -> dict:
    length = int(handler.headers.get("Content-Length", 0))
    if length == 0: return {}
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw)
    except Exception:
        return {}

# ──────────────────────────────────────────
#  REQUEST HANDLER
# ──────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[HTTP] {self.address_string()} {fmt % args}")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,Authorization")
        self.end_headers()

    def serve_static(self, path):
        static_dir = os.path.join(os.path.dirname(__file__), "static")
        if path == "/" or path == "": path = "/index.html"
        filepath = os.path.join(static_dir, path.lstrip("/"))
        # Security: prevent path traversal
        filepath = os.path.realpath(filepath)
        if not filepath.startswith(os.path.realpath(static_dir)):
            json_resp(self, 403, {"error": "Forbidden"})
            return
        if not os.path.isfile(filepath):
            filepath = os.path.join(static_dir, "index.html")
        ext  = os.path.splitext(filepath)[1]
        mime = {".html":"text/html",".css":"text/css",".js":"application/javascript",
                ".json":"application/json",".ico":"image/x-icon",".png":"image/png"}.get(ext,"text/plain")
        with open(filepath, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path   = parsed.path.rstrip("/") or "/"

        if path.startswith("/api/"):
            self.route_api("GET", path, parse_qs(parsed.query))
        else:
            try:
                self.serve_static(path)
            except FileNotFoundError:
                self.serve_static("/index.html")

    def do_POST(self):
        parsed = urlparse(self.path)
        self.route_api("POST", parsed.path.rstrip("/"), {})

    def do_PUT(self):
        parsed = urlparse(self.path)
        self.route_api("PUT", parsed.path.rstrip("/"), {})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        self.route_api("DELETE", parsed.path.rstrip("/"), {})

    def route_api(self, method, path, qs):
        routes = {
            ("POST", "/api/auth/register"):   self.api_register,
            ("POST", "/api/auth/login"):      self.api_login,
            ("POST", "/api/auth/logout"):     self.api_logout,
            ("GET",  "/api/auth/me"):         self.api_me,
            ("GET",  "/api/habits/today"):    self.api_today_get,
            ("POST", "/api/habits/today"):    self.api_today_save,
            ("GET",  "/api/habits/history"):  self.api_history,
            ("POST", "/api/logs"):            self.api_log_add,
            ("GET",  "/api/logs"):            self.api_logs_get,
            ("GET",  "/api/stats"):           self.api_stats,
        }
        handler_fn = routes.get((method, path))
        if handler_fn:
            try:
                handler_fn(qs)
            except Exception as e:
                print(f"[ERROR] {e}")
                import traceback; traceback.print_exc()
                json_resp(self, 500, {"error": str(e)})
        else:
            json_resp(self, 404, {"error": f"Route not found: {method} {path}"})

    # ── AUTH ──
    def api_register(self, qs):
        body = read_body(self)
        username = (body.get("username") or "").strip().lower()
        email    = (body.get("email") or "").strip().lower()
        password = (body.get("password") or "").strip()
        if not username or not email or not password:
            return json_resp(self, 400, {"error": "All fields required"})
        if len(password) < 6:
            return json_resp(self, 400, {"error": "Password must be ≥ 6 chars"})
        if not re.match(r"^[a-z0-9_]{3,20}$", username):
            return json_resp(self, 400, {"error": "Username: 3-20 chars, letters/numbers/underscore"})
        uid = str(uuid.uuid4())
        try:
            with get_db() as db:
                db.execute("INSERT INTO users VALUES (?,?,?,?,?)",
                    (uid, username, email, hash_password(password), today_str()))
        except sqlite3.IntegrityError as e:
            if "username" in str(e): return json_resp(self, 409, {"error": "Username taken"})
            if "email"    in str(e): return json_resp(self, 409, {"error": "Email already registered"})
            return json_resp(self, 409, {"error": "Already exists"})
        token = create_token({"sub": uid, "username": username, "exp": int(time.time()) + TOKEN_EXP})
        json_resp(self, 201, {"token": token, "user": {"id": uid, "username": username, "email": email}})

    def api_login(self, qs):
        body = read_body(self)
        identifier = (body.get("identifier") or "").strip().lower()
        password   = (body.get("password") or "").strip()
        if not identifier or not password:
            return json_resp(self, 400, {"error": "Credentials required"})
        with get_db() as db:
            row = db.execute("SELECT * FROM users WHERE username=? OR email=?",
                             (identifier, identifier)).fetchone()
        if not row or not check_password(password, row["password"]):
            return json_resp(self, 401, {"error": "Invalid credentials"})
        token = create_token({"sub": row["id"], "username": row["username"], "exp": int(time.time()) + TOKEN_EXP})
        json_resp(self, 200, {"token": token, "user": {"id": row["id"], "username": row["username"], "email": row["email"]}})

    def api_logout(self, qs):
        json_resp(self, 200, {"ok": True})

    def api_me(self, qs):
        payload = require_auth(self)
        if not payload: return
        with get_db() as db:
            row = db.execute("SELECT id,username,email,created FROM users WHERE id=?", (payload["sub"],)).fetchone()
        if not row: return json_resp(self, 404, {"error": "User not found"})
        json_resp(self, 200, dict(row))

    # ── TODAY ──
    def api_today_get(self, qs):
        payload = require_auth(self)
        if not payload: return
        with get_db() as db:
            row = db.execute("SELECT * FROM daily_logs WHERE user_id=? AND date=?",
                             (payload["sub"], today_str())).fetchone()
        if not row:
            return json_resp(self, 200, {"date": today_str(), "habits": {}, "crosses": {}, "details": {}, "score": 0, "save_count": 0})
        json_resp(self, 200, {
            "date": row["date"], "score": row["score"], "save_count": row["save_count"],
            "habits":  json.loads(row["habits"]),
            "crosses": json.loads(row["crosses"]),
            "details": json.loads(row["details"]),
        })

    def api_today_save(self, qs):
        payload = require_auth(self)
        if not payload: return
        uid  = payload["sub"]
        body = read_body(self)
        with get_db() as db:
            existing = db.execute("SELECT save_count FROM daily_logs WHERE user_id=? AND date=?",
                                  (uid, today_str())).fetchone()
            count = (existing["save_count"] if existing else 0)
            if count >= 3:
                return json_resp(self, 429, {"error": "Daily save limit reached (3/day)"})
            habits  = json.dumps(body.get("habits", {}))
            crosses = json.dumps(body.get("crosses", {}))
            details = json.dumps(body.get("details", {}))
            score   = int(body.get("score", 0))
            lid     = str(uuid.uuid4())
            now     = datetime.utcnow().isoformat()
            db.execute("""
                INSERT INTO daily_logs (id, user_id, date, habits, crosses, details, score, saved_at, save_count)
                VALUES (?,?,?,?,?,?,?,?,1)
                ON CONFLICT(user_id, date) DO UPDATE SET
                  habits=excluded.habits, crosses=excluded.crosses, details=excluded.details,
                  score=excluded.score, saved_at=excluded.saved_at, save_count=save_count+1
            """, (lid, uid, today_str(), habits, crosses, details, score, now))
        json_resp(self, 200, {"ok": True, "saves_used": count+1, "saves_left": 3-(count+1)})

    # ── HISTORY ──
    def api_history(self, qs):
        payload = require_auth(self)
        if not payload: return
        with get_db() as db:
            rows = db.execute("SELECT * FROM daily_logs WHERE user_id=? ORDER BY date DESC LIMIT 90",
                              (payload["sub"],)).fetchall()
        data = [{
            "date": r["date"], "score": r["score"], "save_count": r["save_count"],
            "habits":  json.loads(r["habits"]),
            "crosses": json.loads(r["crosses"]),
        } for r in rows]
        json_resp(self, 200, data)

    # ── LOGS ──
    def api_log_add(self, qs):
        payload = require_auth(self)
        if not payload: return
        body = read_body(self)
        lid  = str(uuid.uuid4())
        with get_db() as db:
            db.execute("INSERT INTO input_logs VALUES (?,?,?,?,?,?,?,?)", (
                lid, payload["sub"], today_str(),
                body.get("habit_id",""), body.get("habit_label",""),
                1 if body.get("completed") else 0,
                json.dumps(body.get("data",{})),
                datetime.utcnow().isoformat()
            ))
        json_resp(self, 201, {"id": lid})

    def api_logs_get(self, qs):
        payload = require_auth(self)
        if not payload: return
        with get_db() as db:
            rows = db.execute(
                "SELECT * FROM input_logs WHERE user_id=? ORDER BY ts DESC LIMIT 100",
                (payload["sub"],)).fetchall()
        data = [{
            "id": r["id"], "date": r["date"], "habit_id": r["habit_id"],
            "habit_label": r["habit_label"], "completed": bool(r["completed"]),
            "data": json.loads(r["data"]), "ts": r["ts"]
        } for r in rows]
        json_resp(self, 200, data)

    # ── STATS ──
    def api_stats(self, qs):
        payload = require_auth(self)
        if not payload: return
        uid = payload["sub"]
        with get_db() as db:
            rows = db.execute("SELECT score, date FROM daily_logs WHERE user_id=? ORDER BY date DESC",
                              (uid,)).fetchall()
        if not rows:
            return json_resp(self, 200, {"days": 0, "avg": 0, "streak": 0, "perfect": 0, "best": 0})
        scores  = [r["score"] for r in rows]
        avg     = round(sum(scores)/len(scores))
        perfect = sum(1 for s in scores if s==100)
        best    = max(scores)
        # streak: consecutive days from today
        streak = 0
        dates  = [r["date"] for r in rows]
        d      = datetime.utcnow().date()
        for date in dates:
            if date == str(d): streak += 1; d -= timedelta(days=1)
            elif date == str(d): streak += 1; d -= timedelta(days=1)
            else: break
        json_resp(self, 200, {"days": len(rows), "avg": avg, "streak": streak, "perfect": perfect, "best": best})

# ──────────────────────────────────────────
#  MAIN
# ──────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[SERVER] Running at http://localhost:{PORT}")
    print(f"[SERVER] JWT secret: {JWT_SECRET[:8]}... (set JWT_SECRET env to override)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[SERVER] Stopped.")
