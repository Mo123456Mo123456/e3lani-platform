# Android staging release v6

Built: 2026-07-27T19:07:33Z  
Hardening commit: `2384c24`  
versionCode: **6**  
versionName: **0.1.6-staging**  
applicationId: `sa.e3lani.app`  
API baked: `https://e3lani-api-staging.onrender.com/api/v1`

## Signing

- Keystore **not** in Git
- Signed with ephemeral CI keystore via `E3LANI_KEYSTORE_*` env (see `docs/ANDROID_SIGNING.md`)
- Historical `apps/mobile/android/app/staging.keystore` **removed** from the repository
- No hardcoded staging/production passwords remain in `build.gradle`

## Artifacts

| File | Size | SHA-256 |
|---|---|---|
| `e3lani-staging-release-v6.apk` | 69M | `ffeae70897f95a1bfe0abf64583813da4cacb7135be352f4c4f3bb7ba5426b97` |
| `e3lani-staging-release-v6.aab` | 46M | `87a096aa54d844c5910696b9a9a2eef4871ec64d59096fd0a421130e22f342d0` |

Binaries are gitignored under `apps/mobile/dist/`. Rebuild locally with signing env vars before distribution.

## Build commands used

```bash
export E3LANI_KEYSTORE_FILE=…   # outside repo
export E3LANI_KEYSTORE_PASSWORD=…
export E3LANI_KEY_ALIAS=…
export E3LANI_KEY_PASSWORD=…
export ENV_FILE=apps/mobile/.env.staging
export APK_NAME=e3lani-staging-release-v6.apk
bash apps/mobile/scripts/build-staging-release-apk.sh
# + ./gradlew bundleRelease for AAB
```
