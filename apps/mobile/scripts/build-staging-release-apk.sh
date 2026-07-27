#!/usr/bin/env bash
# Build a standalone Android staging Release APK (no Metro).
# Output: apps/mobile/dist/e3lani-staging-release-v9.apk
# Signing: requires E3LANI_KEYSTORE_* env vars (never commit keystores).
# See docs/ANDROID_SIGNING.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
DIST_DIR="$ROOT/dist"
ASSETS_DIR="$ANDROID_DIR/app/src/main/assets"
ENV_FILE="${ENV_FILE:-$ROOT/.env.staging}"
APK_NAME="${APK_NAME:-e3lani-staging-release-v9.apk}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

for var in E3LANI_KEYSTORE_FILE E3LANI_KEYSTORE_PASSWORD E3LANI_KEY_ALIAS E3LANI_KEY_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing signing env: $var (see docs/ANDROID_SIGNING.md)" >&2
    exit 1
  fi
done
if [[ ! -f "$E3LANI_KEYSTORE_FILE" ]]; then
  echo "Keystore file not found: $E3LANI_KEYSTORE_FILE" >&2
  exit 1
fi

# Export EXPO_PUBLIC_* for Metro/Expo embed (build-time bake into JS bundle).
# Expo/.env loaders do NOT override already-exported shell vars — clear first.
unset EXPO_PUBLIC_API_URL EXPO_PUBLIC_API_BASE_URL EXPO_PUBLIC_APP_ENV
# Sync staging values into .env / .env.local so stale tunnel URLs cannot win.
cp "$ENV_FILE" "$ROOT/.env"
cp "$ENV_FILE" "$ROOT/.env.local"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
# Drop Metro/Expo caches that may pin a previous EXPO_PUBLIC_* inline.
rm -rf "$ROOT/.expo" "$ROOT/node_modules/.cache" /tmp/metro-cache /tmp/metro-file-map-* 2>/dev/null || true
rm -f "$ASSETS_DIR/index.android.bundle"

# Prefer EXPO_PUBLIC_API_URL; fall back to EXPO_PUBLIC_API_BASE_URL.
if [[ -z "${EXPO_PUBLIC_API_URL:-}" && -n "${EXPO_PUBLIC_API_BASE_URL:-}" ]]; then
  export EXPO_PUBLIC_API_URL="$EXPO_PUBLIC_API_BASE_URL"
fi
if [[ -z "${EXPO_PUBLIC_API_BASE_URL:-}" && -n "${EXPO_PUBLIC_API_URL:-}" ]]; then
  export EXPO_PUBLIC_API_BASE_URL="$EXPO_PUBLIC_API_URL"
fi

if [[ -z "${EXPO_PUBLIC_API_URL:-}" ]]; then
  echo "EXPO_PUBLIC_API_URL must be set in $ENV_FILE" >&2
  exit 1
fi
if [[ "$EXPO_PUBLIC_API_URL" =~ localhost|127\.0\.0\.1|10\.0\.2\.2 ]]; then
  echo "Refuse to bake localhost into release APK: $EXPO_PUBLIC_API_URL" >&2
  exit 1
fi
if [[ "$EXPO_PUBLIC_API_URL" =~ trycloudflare\.com ]]; then
  echo "Refuse to bake ephemeral trycloudflare tunnel into release APK: $EXPO_PUBLIC_API_URL" >&2
  exit 1
fi

# Preflight: public health must be reachable before packaging.
HEALTH_URL="$EXPO_PUBLIC_API_URL"
[[ "$HEALTH_URL" =~ /api/v1/?$ ]] || HEALTH_URL="${HEALTH_URL%/}/api/v1"
HEALTH_URL="${HEALTH_URL%/}/health"
echo "==> Preflight health: $HEALTH_URL"
curl -fsS -m 20 "$HEALTH_URL" | tee /tmp/staging-health-preflight.json
echo

mkdir -p "$ASSETS_DIR" "$DIST_DIR" "$ANDROID_DIR/app/src/main/res"

cd "$ROOT"
echo "==> Embedding JS bundle + assets (expo export:embed)"
npx expo export:embed \
  --platform android \
  --dev false \
  --minify true \
  --bundle-output "$ASSETS_DIR/index.android.bundle" \
  --assets-dest "$ANDROID_DIR/app/src/main/res"

# Ensure splash logo exists (export:embed may prune drawable assets).
SPLASH_DST="$ANDROID_DIR/app/src/main/res/drawable/splashscreen_logo.png"
if [[ ! -f "$SPLASH_DST" ]]; then
  for candidate in \
    "$ROOT/assets/images/splash-icon.png" \
    "$ROOT/assets/splash.png" \
    "$ANDROID_DIR/app/src/main/res/mipmap-xxhdpi/ic_launcher.webp" \
    "$ANDROID_DIR/app/src/main/res/mipmap-xxhdpi/ic_launcher.png"
  do
    if [[ -f "$candidate" ]]; then
      mkdir -p "$(dirname "$SPLASH_DST")"
      cp "$candidate" "$SPLASH_DST"
      break
    fi
  done
fi
if [[ ! -f "$SPLASH_DST" ]]; then
  echo "WARN: splashscreen_logo.png missing; AAPT may fail." >&2
fi

if [[ ! -s "$ASSETS_DIR/index.android.bundle" ]]; then
  echo "Bundle missing after export:embed" >&2
  exit 1
fi

HOST_HINT="$(python3 - <<'PY'
import os, urllib.parse
u = os.environ.get("EXPO_PUBLIC_API_URL", "")
print(urllib.parse.urlparse(u).hostname or "")
PY
)"
if [[ -n "$HOST_HINT" ]] && rg -q "$HOST_HINT" "$ASSETS_DIR/index.android.bundle"; then
  echo "OK: bundle contains staging host $HOST_HINT"
else
  echo "WARN: could not spot staging host pattern in bundle; verify manually." >&2
fi
if rg -q 'trycloudflare\.com' "$ASSETS_DIR/index.android.bundle"; then
  echo "FAIL: release bundle still contains trycloudflare.com" >&2
  exit 1
fi
if rg -q 'http://127\.0\.0\.1:3001' "$ASSETS_DIR/index.android.bundle"; then
  echo "FAIL: release bundle still contains 127.0.0.1:3001 API fallback" >&2
  exit 1
fi

cd "$ANDROID_DIR"
echo "==> Gradle clean + assembleRelease"
./gradlew clean assembleRelease --no-daemon

APK_SRC="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
APK_OUT="$DIST_DIR/$APK_NAME"
cp "$APK_SRC" "$APK_OUT"

echo "==> Verifying APK"
unzip -l "$APK_OUT" | rg 'index.android.bundle' || {
  echo "FAIL: index.android.bundle not packaged" >&2
  exit 1
}

BT="$(ls -d "${ANDROID_HOME:-/opt/android-sdk}/build-tools"/*/ 2>/dev/null | sort -V | tail -1)"
if [[ -x "${BT}aapt" ]]; then
  "${BT}aapt" dump badging "$APK_OUT" | head -5
fi

echo "==> SHA-256"
sha256sum "$APK_OUT"
ls -lh "$APK_OUT"
echo "OK: $APK_OUT"
