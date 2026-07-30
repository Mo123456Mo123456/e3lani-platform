#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

setup_service() {
  local service_dir="$1"
  local name
  name="$(basename "$service_dir")"

  if [[ ! -d "$service_dir" ]]; then
    echo "Skipping $name; directory not found"
    return
  fi

  echo "Setting up Python service: $name"
  "$PYTHON_BIN" -m venv "$service_dir/.venv"
  # shellcheck source=/dev/null
  source "$service_dir/.venv/bin/activate"
  python -m pip install --upgrade pip

  if [[ -f "$service_dir/pyproject.toml" ]]; then
    python -m pip install -e "$service_dir"
  elif [[ -f "$service_dir/requirements.txt" ]]; then
    python -m pip install -r "$service_dir/requirements.txt"
  else
    echo "No pyproject.toml or requirements.txt for $name"
  fi

  deactivate
}

setup_service "$ROOT_DIR/services/simulation-engine"
setup_service "$ROOT_DIR/services/ai-orchestrator"
setup_service "$ROOT_DIR/services/world-generator"

echo "Python services are ready."
