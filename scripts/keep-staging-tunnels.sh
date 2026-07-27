#!/usr/bin/env bash
# Supervise Cloudflare quick tunnels for staging while this cloud-agent session is alive.
set -euo pipefail
TMUX_CFG=/exec-daemon/tmux.portal.conf
CF=/tmp/cloudflared
URLS=/tmp/staging-urls.env

ensure_tunnel() {
  local name=$1 target=$2 log=$3
  if ! pgrep -af "cloudflared tunnel --url $target" >/dev/null 2>&1; then
    echo "[cf] restarting $name -> $target"
    tmux -f "$TMUX_CFG" has-session -t "=$name" 2>/dev/null || \
      tmux -f "$TMUX_CFG" new-session -d -s "$name" -c /workspace -- bash -l
    tmux -f "$TMUX_CFG" send-keys -t "$name:0.0" C-c
    sleep 1
    tmux -f "$TMUX_CFG" send-keys -t "$name:0.0" \
      "$CF tunnel --url $target --no-autoupdate 2>&1 | tee $log" C-m
    sleep 8
  fi
}

ensure_tunnel tunnel-api http://127.0.0.1:3001 /tmp/cf-api2.log
ensure_tunnel tunnel-web http://127.0.0.1:3000 /tmp/cf-web2.log
ensure_tunnel tunnel-admin http://127.0.0.1:3002 /tmp/cf-admin2.log
ensure_tunnel tunnel-minio http://127.0.0.1:9000 /tmp/cf-minio2.log

API=$(rg -o 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-api2.log | tail -1 || true)
WEB=$(rg -o 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-web2.log | tail -1 || true)
ADMIN=$(rg -o 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-admin2.log | tail -1 || true)
MINIO=$(rg -o 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-minio2.log | tail -1 || true)
cat > "$URLS" <<EOF
API=$API
WEB=$WEB
ADMIN=$ADMIN
MINIO=$MINIO
EOF
echo "API=$API"
if [[ -n "$API" ]]; then
  curl -fsS -m 20 "$API/api/v1/health" || true
  echo
fi
