# Android signing & release builds — E3lani | إعلاني

## Rules

- **Never commit** keystores, passwords, or `keystore.properties` with secrets.
- Release/staging signing reads **only** from environment variables or untracked Gradle properties:
  - `E3LANI_KEYSTORE_FILE`
  - `E3LANI_KEYSTORE_PASSWORD`
  - `E3LANI_KEY_ALIAS`
  - `E3LANI_KEY_PASSWORD`
- `apps/mobile/android/app/debug.keystore` is the local Android debug keystore only (not for store distribution).

## Create a staging keystore (local machine)

```bash
mkdir -p ~/secrets/e3lani
keytool -genkeypair -v -storetype PKCS12 \
  -keystore ~/secrets/e3lani/e3lani-staging.keystore \
  -alias e3lani-staging \
  -keyalg RSA -keysize 2048 -validity 10000
```

## Export signing env

```bash
export E3LANI_KEYSTORE_FILE="$HOME/secrets/e3lani/e3lani-staging.keystore"
export E3LANI_KEYSTORE_PASSWORD='…'
export E3LANI_KEY_ALIAS='e3lani-staging'
export E3LANI_KEY_PASSWORD='…'
```

Or copy `apps/mobile/android/keystore.properties.example` → a gitignored local file and source it.

## Build staging APK

```bash
cd apps/mobile
# Ensure EXPO_PUBLIC_API_URL points at staging (see .env.staging.example)
export ENV_FILE=.env.staging
export APK_NAME=e3lani-staging-release-v8.apk
bash scripts/build-staging-release-apk.sh
```

Requirements:

- Signing env vars set (script will fail clearly if Gradle cannot sign for distribution)
- JDK 17+, Android SDK, `ANDROID_HOME`
- Network access to staging API health preflight

## Build production AAB (Play Store)

Use a **separate** production keystore and:

```bash
export E3LANI_KEYSTORE_FILE="$HOME/secrets/e3lani/e3lani-production.keystore"
export E3LANI_KEYSTORE_PASSWORD='…'
export E3LANI_KEY_ALIAS='e3lani-production'
export E3LANI_KEY_PASSWORD='…'
export EXPO_PUBLIC_APP_ENV=production
export EXPO_PUBLIC_API_URL=https://api.e3lani.sa/api/v1   # example

cd apps/mobile/android
./gradlew clean bundleRelease --no-daemon
# Output: app/build/outputs/bundle/release/app-release.aab
```

## Verify artifact

```bash
sha256sum apps/mobile/dist/e3lani-staging-release-v8.apk
# or
sha256sum apps/mobile/android/app/build/outputs/bundle/release/app-release.aab
```

## Rotation

If a keystore was ever committed historically, treat it as compromised: generate a new keystore, update Play App Signing / device trust as needed, and purge secrets from CI history.
