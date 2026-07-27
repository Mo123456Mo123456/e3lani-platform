#!/usr/bin/env bash
# Deploy E3lani staging to Render via Blueprint once RENDER_API_KEY is available.
# Usage:
#   export RENDER_API_KEY=rnd_...
#   bash scripts/deploy-staging-render.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${RENDER_API_KEY:?Set RENDER_API_KEY from https://dashboard.render.com/u/settings#api-keys}"

OWNER_ID="${RENDER_OWNER_ID:-}"
if [[ -z "$OWNER_ID" ]]; then
  OWNER_ID=$(curl -fsS -H "Authorization: Bearer $RENDER_API_KEY" \
    https://api.render.com/v1/owners | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['owner']['id'] if d else '')")
fi
: "${OWNER_ID:?Could not resolve Render owner id}"

REPO="https://github.com/Mo123456Mo123456/e3lani-platform"
BRANCH="${DEPLOY_BRANCH:-cursor/phase-1-foundation-b0e4}"

echo "Creating blueprint from $REPO @$BRANCH (owner=$OWNER_ID)"
curl -fsS -X POST "https://api.render.com/v1/blueprints" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(python3 - <<PY
import json
print(json.dumps({
  "ownerId": "$OWNER_ID",
  "repo": "$REPO",
  "branch": "$BRANCH",
  "autoSync": True,
}))
PY
)"
echo
echo "Done. Configure CORS / S3 / API_PUBLIC_URL in Render dashboard, then rebuild the mobile APK."
