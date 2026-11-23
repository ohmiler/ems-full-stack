#!/usr/bin/env bash
# ติดตั้ง/อัปเดต EMS บน VPS (Ubuntu) — รันด้วย root ซ้ำได้โดยไม่ทำข้อมูลเดิมหาย
#   curl -fsSL https://raw.githubusercontent.com/ohmiler/ems-full-stack/main/deploy/install.sh | bash
# แอปจะฟังที่ 127.0.0.1:3001 เท่านั้น ต้องมี reverse proxy (เช่น OpenLiteSpeed) ส่งต่อจากโดเมนมาอีกชั้น
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ohmiler/ems-full-stack.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/ems}"
APP_USER="${APP_USER:-ems}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ต้องรันด้วย root" >&2
  exit 1
fi

# --- Node.js 22+ (ต้องใช้ process.loadEnvFile และ prebuilt binary ของ better-sqlite3) ---
node_major=0
if [ -x /usr/bin/node ]; then
  node_major="$(/usr/bin/node -p 'process.versions.node.split(".")[0]')"
fi
if [ "$node_major" -lt 22 ]; then
  echo ">> ติดตั้ง Node.js 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
command -v git >/dev/null || apt-get install -y git

# --- ผู้ใช้ระบบสำหรับรันแอป (ไม่มี shell, ไม่มีสิทธิ์ root) ---
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

as_app() { sudo -u "$APP_USER" -H env PATH="/usr/bin:/bin" "$@"; }

# --- โค้ด ---
if [ -d "$APP_DIR/.git" ]; then
  echo ">> อัปเดตโค้ด"
  as_app git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  as_app git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  echo ">> clone โค้ด"
  as_app git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
echo ">> ติดตั้ง dependencies และ build หน้าเว็บ"
as_app npm ci --no-audit --no-fund
as_app npm run build
as_app npm prune --omit=dev --no-audit --no-fund

# --- .env (สุ่ม secret ครั้งแรกเท่านั้น) และข้อมูลเริ่มต้น ---
first_install=0
if [ ! -f "$APP_DIR/.env" ]; then
  first_install=1
  as_app npm run setup
fi
chmod 600 "$APP_DIR/.env"
if [ ! -f "$APP_DIR/server/data/ems.db" ]; then
  as_app npm run seed
fi

# --- systemd ---
install -m 644 "$APP_DIR/deploy/ems.service" /etc/systemd/system/ems.service
systemctl daemon-reload
systemctl enable ems >/dev/null
systemctl restart ems
sleep 2
systemctl --no-pager --lines=5 status ems

port="$(grep -E '^API_PORT=' "$APP_DIR/.env" | cut -d= -f2)"
curl -fsS -o /dev/null -w ">> ตรวจแอป: HTTP %{http_code}\n" "http://127.0.0.1:${port:-3001}/"

if [ "$first_install" -eq 1 ]; then
  echo ">> ติดตั้งครั้งแรก: ชื่อผู้ใช้/รหัสผ่าน admin อยู่ใน $APP_DIR/.env"
fi
