# @planet-born/admin

لوحة الإدارة الداخلية تعمل على `http://localhost:3001`.

```bash
cp apps/admin/.env.example apps/admin/.env.local
pnpm --filter @planet-born/admin dev
```

تستدعي جميع البيانات والإجراءات مسارات `/admin/*`. لا تسمح بوابة العميل بالدخول إلا للأدوار `system_admin` و`super_admin`؛ ويجب أن يفرض API الصلاحيات نفسها بوصفه مصدر الحماية النهائي.
