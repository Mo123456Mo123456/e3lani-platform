#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${ROOT}/dist-delivery"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
ZIP_NAME="e3lani-platform-${STAMP}.zip"
mkdir -p "$OUT_DIR"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

mkdir -p "$TMP/e3lani-platform"
tar -C "$ROOT" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='coverage' \
  --exclude='.turbo' \
  --exclude='dist-delivery' \
  --exclude='.expo' \
  --exclude='*.apk' \
  --exclude='.env' \
  --exclude='services/api/.env' \
  -cf - . | tar -C "$TMP/e3lani-platform" -xf -

(
  cd "$TMP"
  zip -qr "$OUT_DIR/$ZIP_NAME" e3lani-platform
)

echo "Created: $OUT_DIR/$ZIP_NAME"
ls -lh "$OUT_DIR/$ZIP_NAME"
