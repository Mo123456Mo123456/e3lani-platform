# Android Staging Release — Standalone APK

## Artifact

| Field | Value |
|---|---|
| File | `e3lani-staging-release.apk` |
| Download | https://github.com/Mo123456Mo123456/e3lani-platform/releases/download/visual-qa-phase3/e3lani-staging-release.apk |
| Package | `sa.e3lani.app` |
| Version name | `0.1.3-staging` |
| Version code | `3` |
| SHA-256 | `060891fb0ddc52577a182ca8b1ac8d5a7c6dd6f74b629e8f4c286a3c10aa1548` |
| Size | ~69 MB |
| Signing | Staging keystore (`CN=E3lani Staging`) |
| `debuggable` | `false` (confirmed via `dumpsys package`; DEBUGGABLE flag absent) |

## Standalone guarantees

- Built with `./gradlew assembleRelease` (not `assembleDebug`).
- JS pre-embedded via `npx expo export:embed --platform android --dev false --minify true`.
- APK contains `assets/index.android.bundle` (~1.6 MB).
- Staging API baked at build time: `https://guru-beverly-basename-toilet.trycloudflare.com/api/v1`.
- No `127.0.0.1:3001` API fallback in the release bundle.
- Metro is **not** required at runtime.
- Dev menu not shown (non-debuggable release).

## Build command

```bash
cd apps/mobile
cp .env.staging.example .env.staging   # set EXPO_PUBLIC_API_BASE_URL
pnpm build:android:staging-release
# → apps/mobile/dist/e3lani-staging-release.apk
```

## Emulator install & run (API 34)

| Check | Result |
|---|---|
| Install | Success (`adb install -r`) |
| Cold start JS | `ReactNativeJS: Bridgeless mode is enabled` → `Running "main"` |
| Metro / Unable to load script | **Not observed** |
| Red screen | **Not observed** |
| UI chrome | Bottom nav rendered (الرئيسية / الأقسام / + / المحفوظات / حسابي) — `android-release-ui-loaded.png` |
| API call attempt | App attempted remote fetch (shows `Network request failed` when guest NAT is down) |
| Staging API (host) | `/health` 200; OTP request+verify OK (`sandboxCode` 123456 → accessToken) |
| Feed (host) | `/feed` returns `{ items, nextCursor, hasMore }` |

### Environment caveat

Cloud agent VM has **no `/dev/kvm`**. Emulator runs with `-accel off` (TCG): extremely slow, frequent System UI ANRs, and guest `eth0` NAT (`10.0.2.2`) unreachable. End-to-end OTP/create-ad **inside** the emulator network namespace could not complete for that reason. The release APK itself is standalone, embeds the staging host, and loads JS without Metro.

## Evidence

- `android-release-ui-loaded.png` — app UI after cold start (no Metro error)
- GitHub Release tag `visual-qa-phase3` → `e3lani-staging-release.apk`
