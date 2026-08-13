#!/usr/bin/env bash
# 公网访问：绑定 0.0.0.0:8000（需安全组放行 TCP 8000）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source "$ROOT/.venv/bin/activate"
export PYTHONPATH="$ROOT/backend"

if [ ! -f "$ROOT/frontend/dist/index.html" ]; then
  echo "frontend/dist 不存在，正在构建..."
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  (cd "$ROOT/frontend" && npm run build)
fi

PID_FILE="$ROOT/data/uvicorn.pid"
LOG_FILE="$ROOT/data/uvicorn.log"
mkdir -p "$ROOT/data"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "已在运行 pid=$(cat "$PID_FILE")"
  echo "访问: http://$(curl -s -m 2 http://100.100.100.200/latest/meta-data/eipv4 || echo '<公网IP>'):8000"
  exit 0
fi

nohup uvicorn app.main:app \
  --app-dir "$ROOT/backend" \
  --host 0.0.0.0 \
  --port 8000 \
  >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
echo "已启动 pid=$(cat "$PID_FILE") log=$LOG_FILE"
echo "公网地址: http://$(curl -s -m 2 http://100.100.100.200/latest/meta-data/eipv4 || echo '<公网IP>'):8000"
