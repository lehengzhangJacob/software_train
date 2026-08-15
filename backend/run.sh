#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source "$ROOT/.venv/bin/activate"
export PYTHONPATH="$ROOT/backend"
exec uvicorn app.main:app --app-dir "$ROOT/backend" --host 0.0.0.0 --port "${PORT:-8000}" --reload
