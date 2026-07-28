# Brand visual identity — atmosphere background

Branch: `cursor/brand-visual-identity-b0e4`  
PR: https://github.com/Mo123456Mo123456/e3lani-platform/pull/5  
Status: Draft — do not merge before review

## 1) Files changed (high level)

- `apps/mobile/src/components/BrandBackground.tsx` (new)
- `apps/mobile/assets/branding/*` (hero/header WebP + splash PNG)
- Mobile screens: login, feed, categories, account, saved + `app.json` splash
- Web: `globals.css`, home, login, categories, account + `public/branding/*`
- Docs: `docs/brand/BRAND_REFERENCE.md`, `docs/visual-evidence/BRAND_VISUAL_IDENTITY_REPORT.md`
- Version bump: Android `versionCode 10` / `0.1.10-staging`

## 2) Components created

- `BrandBackground` — full/header/banner/empty variants + readability overlays
- `BrandAtmosphere` — absolute top band for tabs
- `brandImages` helpers

## 3) Screens with atmosphere

| Surface | Treatment |
|---|---|
| Splash | Expo splash cover image on `#111111` |
| Login / OTP | Full brand background + dark readable card |
| Home feed top | Soft header atmosphere |
| Feed empty | Compact empty brand panel |
| Categories top | Header atmosphere |
| Account header | Header atmosphere |
| Saved empty | Empty brand panel |
| Web home / login / categories / account | Shared CSS banners |

## 4) Test / build results

- `pnpm lint` ✅
- `pnpm typecheck` ✅
- `pnpm test` ✅
- `pnpm build` ✅
- Android Release APK `assembleRelease` ✅ (`versionCode=10`)

## 5) Links

- Pull Request: https://github.com/Mo123456Mo123456/e3lani-platform/pull/5
- APK: https://github.com/Mo123456Mo123456/e3lani-platform/releases/download/staging-apk-v10/e3lani-staging-release-v10.apk
- SHA-256: `dc5c03b9378b826cace2aee9e1c44cace24d129e72d0a129c762482604451ec4`

## Notes

- Backend / API / DB untouched.
- Artwork used as selective atmosphere with overlays — not behind dense lists.
- Pricing remains **59 SAR**.
