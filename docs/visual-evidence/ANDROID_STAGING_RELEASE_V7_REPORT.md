# Android staging release v7

Built: 2026-07-27T21:50:00Z  
Base pricing commit: `831854a` (59 SAR catalog)  
Version bump commit: `b793098`  
versionCode: **7**  
versionName: **0.1.7-staging**  
applicationId: `sa.e3lani.app`  
API baked: `https://e3lani-api-staging.onrender.com/api/v1`

## Signing

- Keystore **not** in Git
- Signed with ephemeral CI keystore via `E3LANI_KEYSTORE_*` env only (see `docs/ANDROID_SIGNING.md`)
- Signer DN: `CN=E3lani CI Staging, OU=Engineering, O=E3lani, L=Riyadh, ST=Riyadh, C=SA`

## Artifact

| File | Size | SHA-256 |
|---|---|---|
| `e3lani-staging-release-v7.apk` | 69M | `e5a4ccc3f12f3c682a11f93337a0361b4858a7f7db5110f9f05d062344465d00` |

Installable standalone Release APK (embedded `assets/index.android.bundle`; no Metro required).

Binary is gitignored under `apps/mobile/dist/`. Cloud agent copy: `/opt/cursor/artifacts/e3lani-staging-release-v7.apk`.

## Verification

- `aapt dump badging`: `versionCode='7' versionName='0.1.7-staging'`
- Bundle contains host `e3lani-api-staging.onrender.com`
- Bundle does **not** contain `trycloudflare.com` or `http://127.0.0.1:3001` API fallback
- `apksigner verify` OK

## Build commands used

```bash
export E3LANI_KEYSTORE_FILE=…   # outside repo
export E3LANI_KEYSTORE_PASSWORD=…
export E3LANI_KEY_ALIAS=…
export E3LANI_KEY_PASSWORD=…
export ENV_FILE=apps/mobile/.env.staging
export APK_NAME=e3lani-staging-release-v7.apk
bash apps/mobile/scripts/build-staging-release-apk.sh
```
