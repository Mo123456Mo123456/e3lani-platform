# المساهمة في إعلاني

مستودع GitHub الخاص هو **مصدر الحقيقة الوحيد للشفرة**. تبقى قاعدة البيانات والتخزين السحابي والخوادم خدمات مستقلة، ولا تُحفظ بيانات المستخدمين أو الأسرار أو النسخ التشغيلية منها داخل Git.

## استراتيجية الفروع

| الفرع | الاستخدام |
|---|---|
| `main` | إصدارات مستقرة ومختبرة فقط. لا تطوير مباشر عليه. |
| `develop` | خط دمج التطوير الجاري ومصدر فروع العمل. |
| `feature/*` | ميزة واحدة مترابطة. |
| `fix/*` | إصلاح خلل أو دين تقني محدد. |
| `hotfix/*` | إصلاح حرج يبدأ من `main` ويعود إلى `main` و`develop`. |

ابدأ كل عمل من أحدث `develop`، واستخدم اسمًا وصفيًا مثل `fix/default-user-role` أو `feature/public-share-links`. يجب ألا تجمع ميزة مستقلة وإصلاحًا غير مرتبط في الفرع نفسه.

## الالتزامات

استخدم رسائل قصيرة وواضحة بصيغة Conventional Commits:

```text
feat(feed): add fullscreen vertical paging
fix(auth): assign user role on first login
test(media): cover interrupted upload recovery
docs(readme): document feed access modes
```

يفضل أن يمثل كل Commit خطوة منطقية قابلة للمراجعة والتراجع. يمنع إدراج ملفات `.env` أو بيانات حقيقية أو سجلات تحتوي معلومات شخصية.

## Pull Requests

يستهدف Pull Request العادي فرع `develop`. يجب أن يشرح المشكلة، ونطاق الحل، والمخاطر، والمهاجرات، ونتائج الاختبارات، وخطة التراجع. قبل الدمج شغّل:

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
npx expo export --platform web --output-dir .expo-export
```

يُحدّث `CHANGELOG.md` عند إضافة سلوك ملحوظ للمستخدم أو تغيير عقد API أو قاعدة البيانات. لا يُدمج إلى `main` إلا Pull Request إصدار بعد نجاح البوابة الكاملة والتحقق من استنساخ نظيف.

راجع [سياسة Git التفصيلية](./docs/git-workflow.md) و[سياسة الأمان](./SECURITY.md) قبل العمل على المصادقة أو الدفع أو الوسائط.
