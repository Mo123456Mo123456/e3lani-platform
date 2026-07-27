#!/usr/bin/env bash
# Build a standalone Android staging Release APK (no Metro).
# Output: apps/mobile/dist/e3lani-staging-release.apk
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
DIST_DIR="$ROOT/dist"
ASSETS_DIR="$ANDROID_DIR/app/src/main/assets"
ENV_FILE="${ENV_FILE:-$ROOT/.env.staging}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

# Export EXPO_PUBLIC_* for Metro/Expo embed (build-time bake into JS bundle).
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

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
  exit 1
fi

# Preflight: public health must be reachable before packaging.
HEALTH_URL="$EXPO_PUBLIC_API_URL"
[[ "$HEALTH_URL" =~ /api/v1$ ]] || HEALTH_URL="${HEALTH_URL%/}/api/v1"
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

  echo "WARN: could not spot staging host pattern in bundle; verify manually." >&2
fi
if rg -q 'http://127\.0\.0\.1:3001' "$ASSETS_DIR/index.android.bundle"; then
  echo "FAIL: release bundle still contains 127.0.0.1:3001 API fallback" >&2
  exit 1
fi

cd "$ANDROID_DIR"
echo "==> Gradle clean + assembleRelease"
./gradlew clean assembleRelease --no-daemon

APK_SRC="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
APK_OUT="$DIST_DIR/e3lani-staging-release-v4.apk"
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
