# Staging Final UI QA

- Web: https://e3lani-web-staging.onrender.com
- Admin: https://e3lani-admin-staging.onrender.com
- API: https://e3lani-api-staging.onrender.com/api/v1
- Generated: 2026-07-27T20:16:20.948Z

| Suite | Check | Result | Detail |
|---|---|---|---|
| web | home | PASS | status=200 dir=rtl text=true |
| web | browse | PASS | status=200 dir=rtl text=true |
| web | categories | PASS | status=200 dir=rtl text=true |
| web | search | PASS | status=200 dir=rtl text=true |
| web | pricing | PASS | status=200 dir=rtl text=true |
| web | saved | PASS | status=200 dir=rtl text=true |
| web | account | PASS | status=200 dir=rtl text=true |
| web | terms | PASS | status=200 dir=rtl text=true |
| web | privacy | PASS | status=200 dir=rtl text=true |
| web | content-policy | PASS | status=200 dir=rtl text=true |
| web | faq | PASS | status=200 dir=rtl text=true |
| web | cities | PASS | status=200 dir=rtl text=true |
| web | rtl-ltr-toggle | PASS | rtl→ltr |
| web | otp-login | PASS | +966583356390 |
| web | create-ad-page | PASS |  |
| web | ad-detail | PASS | adId=38c82287-c8a1-47ec-a110-b003f853735c |
| web | no-localhost-requests | PASS |  |
| web | no-api-4xx-5xx | PASS |  |
| admin | login | PASS | https://e3lani-admin-staging.onrender.com/ads/review |
| admin | dashboard | PASS | status=200 liveApi=true api=200 https://e3lani-api-staging.onrender.com/api/v1/admin/ads/review;200 https://e3lani-api-staging.onrender.com/api/v1/admin/reports textHit=true |
| admin | ads-review | PASS | status=200 liveApi=true api=200 https://e3lani-api-staging.onrender.com/api/v1/admin/ads/review textHit=true |
| admin | users | PASS | status=200 liveApi=true api=200 https://e3lani-api-staging.onrender.com/api/v1/admin/users textHit=true |
| admin | reports | PASS | status=200 liveApi=true api=200 https://e3lani-api-staging.onrender.com/api/v1/admin/reports textHit=true |
| admin | appeals | PASS | status=200 liveApi=true api=200 https://e3lani-api-staging.onrender.com/api/v1/admin/appeals textHit=true |
| admin | payments | PASS | status=200 liveApi=true api=200 https://e3lani-api-staging.onrender.com/api/v1/admin/payments textHit=true |
| admin | refunds | PASS | status=200 liveApi=true api=200 https://e3lani-api-staging.onrender.com/api/v1/admin/refunds textHit=true |
| admin | campaigns | PASS | status=200 liveApi=true api=200 https://e3lani-api-staging.onrender.com/api/v1/admin/campaigns textHit=true |
| admin | pricing | PASS | status=200 liveApi=true api=200 https://e3lani-api-staging.onrender.com/api/v1/admin/pricing textHit=true |
| admin | audit | PASS | status=200 liveApi=true api=200 https://e3lani-api-staging.onrender.com/api/v1/admin/audit textHit=true |
| admin | orders | PASS | status=200 liveApi=true api=200 https://e3lani-api-staging.onrender.com/api/v1/admin/orders textHit=true |
| admin | approve-reject-controls | PASS | controls rendered |
| admin | no-localhost-requests | PASS |  |

All checks passed.
