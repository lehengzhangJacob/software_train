#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Node via nvm if available
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
fi

# shellcheck disable=SC1091
source "$ROOT/.venv/bin/activate"
export PYTHONPATH="$ROOT/backend"

cleanup() {
  kill $(jobs -p) 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting FastAPI on :8000 ..."
uvicorn app.main:app --app-dir "$ROOT/backend" --host 127.0.0.1 --port 8000 --reload &

echo "Starting Vite on :5173 ..."
cd "$ROOT/frontend"
npm run dev -- --host 127.0.0.1 --port 5173 &

wait
