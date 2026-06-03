#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

if [ -x ".venv/bin/python" ]; then
  PYTHON_COMMAND=".venv/bin/python"
elif [ -x ".venv311/bin/python" ]; then
  PYTHON_COMMAND=".venv311/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_COMMAND="python3"
else
  PYTHON_COMMAND="python"
fi

echo "[ORV] Zagon ORV API streznika"
echo "[ORV] Delovna mapa: $(pwd)"
echo "[ORV] Python: $PYTHON_COMMAND"
echo "[ORV] URL: http://localhost:$PORT"
echo ""

exec "$PYTHON_COMMAND" -m uvicorn api_server:app --host "$HOST" --port "$PORT"