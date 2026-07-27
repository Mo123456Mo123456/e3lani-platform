# Brand visual identity — atmosphere background

Branch: `cursor/brand-visual-identity-b0e4`  
Base lineage: Issue #3 UI redesign  
Status: Draft — do not merge before review

## Components

- `apps/mobile/src/components/BrandBackground.tsx` — `BrandBackground`, `BrandAtmosphere`, `brandImages`
- Assets: `apps/mobile/assets/branding/*` (+ web `apps/web/public/branding/*`)

## Screens (mobile)

| Surface | Treatment |
|---|---|
| Splash | `app.json` → `splash-brand.png` cover on `#111111` |
| Login / OTP | Full `BrandBackground` + readable card overlay |
| Home feed top | `BrandAtmosphere` header band |
| Feed empty | Compact empty brand panel |
| Categories top | `BrandAtmosphere` header |
| Account header | `BrandAtmosphere` header |
| Saved empty | Empty brand panel |

## Web

- Home hero, login page, categories/account banners via CSS + `/branding/*.webp`

## Non-goals

- No Backend / API / DB changes
- No route or payment/auth logic changes
- Full artwork is **not** placed behind dense lists
