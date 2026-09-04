# VERO — دليل التركيب

> نسخة مستقلة بالكامل على سيرفر شركتك. لا اشتراك، ولا خادم تابع للبائع، ولا حساب مركزي.

---

## 1. المتطلبات

| البند | الحد الأدنى | الموصى به |
|---|---|---|
| المعالج | 2 vCPU | 4 vCPU |
| الذاكرة | 4 GB | 8 GB |
| القرص | 40 GB SSD | 100 GB SSD |
| نظام التشغيل | Ubuntu 22.04 / 24.04 أو أي توزيعة تدعم Docker | |
| البرمجيات | Docker Engine 24+ و Docker Compose v2 | |

**سعة تقديرية:** 3,000 حاوية × زيارة يوميًا ≈ 1.1 مليون سجل سنويًا ≈ أقل من 2 GB سنويًا شاملة نقاط المسار.

### تثبيت Docker على Ubuntu

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # ثم أعد تسجيل الدخول
docker compose version          # للتأكد
```

---

## 2. التركيب

```bash
# 1) انسخ حزمة VERO إلى السيرفر
cd /opt
sudo mkdir -p vero && sudo chown $USER:$USER vero
# … انسخ محتويات مجلد vero/ هنا …
cd /opt/vero

# 2) جهّز ملف الإعدادات
cp .env.example .env

# 3) ولّد الأسرار الثلاثة
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "QR_SIGNING_KEY=$(openssl rand -hex 32)"
# ضع الناتج في .env، واضبط PUBLIC_BASE_URL و ADMIN_ORIGIN على عنوان دومينك

nano .env

# 4) شغّل
docker compose up -d --build

# 5) تحقّق
docker compose ps
curl http://localhost:4000/health
```

الرد المتوقع:

```json
{"status":"ok","db":"ok","postgis":"3.4.2","version":"1.0.0","setupCompleted":false}
```

> **الهجرات تُطبَّق تلقائيًا** عند إقلاع الـAPI. لا حاجة لأي أمر إضافي.

---

## 3. الإعداد الأول

1. افتح `http://<عنوان-السيرفر>:3000`
2. سيوجّهك النظام تلقائيًا إلى **معالج الإعداد**.
3. أدخل:
   - اسم الشركة وشعارها والمدينة وبيانات التواصل
   - نطاق GPS الافتراضي (20 / 30 / 50 مترًا أو قيمة مخصصة)
   - المنطقة الزمنية — عليها يعتمد تصفير عدّاد اليوم
   - اسم مدير النظام واسم المستخدم وكلمة المرور
4. اضغط **إنهاء الإعداد**.

> معالج الإعداد يعمل **مرة واحدة فقط**. بعدها يُغلق نهائيًا، ويُدار كل شيء من «هوية الشركة».

⚠ **احتفظ ببيانات حساب المدير في مكان آمن.** لا توجد جهة خارجية تستطيع استرجاعه.

---

## 4. الدومين وشهادة TLS (مطلوب للإنتاج)

تطبيقات الجوال الحديثة تتطلب HTTPS. المسار الموصى به: Nginx كوسيط عكسي + Let's Encrypt.

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/vero`:

```nginx
server {
  server_name vero.company.example;

  # لوحة الإدارة
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # واجهة الـAPI
  location /v1/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 64M;   # لرفع ملفات الاستعادة
  }

  location /health { proxy_pass http://127.0.0.1:4000; }
  location /docs   { proxy_pass http://127.0.0.1:4000; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/vero /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d vero.company.example
```

ثم حدّث `.env`:

```bash
PUBLIC_BASE_URL=https://vero.company.example
ADMIN_ORIGIN=https://vero.company.example
```

وأعد البناء (العنوان مخبوز داخل حزمة اللوحة):

```bash
docker compose up -d --build admin
```

بعد تفعيل HTTPS يُنصح بإغلاق المنفذين 3000 و4000 من الجدار الناري وترك 80/443 فقط.

---

## 5. تطبيق العامل

التطبيق **لا يُنشر باسم البائع**. الشركة تبنيه وتنشره بحسابها الخاص.

```bash
cd mobile
pnpm install
npm i -g eas-cli && eas login          # بحساب الشركة على Expo
```

عدّل `eas.json` وضع عنوان خادمك في `VERO_API_URL`، وعدّل معرّف الحزمة:

```bash
export VERO_ANDROID_PACKAGE=com.yourcompany.vero
export VERO_IOS_BUNDLE_ID=com.yourcompany.vero
```

```bash
eas build --platform android --profile preview      # ملف APK للتوزيع الداخلي
eas build --platform android --profile production   # AAB لمتجر Google Play
eas build --platform ios --profile production       # يتطلب Apple Developer
```

| البند | التكلفة | مسؤولية |
|---|---|---|
| Google Play Console | 25$ مرة واحدة | الشركة |
| Apple Developer | 99$ سنويًا | الشركة |
| توزيع APK داخليًا | مجاني | الشركة |

> للتوزيع الداخلي على أجهزة أندرويد الشركة، ملف APK كافٍ ولا يحتاج أي حساب متجر.

---

## 6. أوامر التشغيل اليومي

```bash
docker compose ps                    # حالة الخدمات
docker compose logs -f api           # سجل الـAPI
docker compose logs -f admin         # سجل اللوحة
docker compose restart api           # إعادة تشغيل
docker compose down                  # إيقاف (البيانات تبقى)
docker compose up -d --build         # تحديث بعد تغيير الكود
docker compose down -v               # ⚠ حذف البيانات نهائيًا
```

**التحقق من بقاء البيانات بعد إعادة التشغيل:**

```bash
docker compose down && docker compose up -d
curl http://localhost:4000/health    # setupCompleted يجب أن يبقى true
```

البيانات محفوظة في وحدتَي تخزين Docker: `vero_db` و`vero_storage`.

---

## 7. حل المشكلات

| العرض | السبب المرجّح | الحل |
|---|---|---|
| `POSTGRES_PASSWORD مطلوب` | لم تملأ `.env` | املأ الأسرار الثلاثة |
| اللوحة تعرض «تعذّر الاتصال بخادم VERO» | `NEXT_PUBLIC_API_URL` خاطئ | صحّح `PUBLIC_BASE_URL` ثم `docker compose up -d --build admin` |
| `/health` يرجع 503 | قاعدة البيانات لم تُقلع بعد | `docker compose logs db` وانتظر انتهاء `start_period` |
| الجوال: «تعذّر الاتصال بالخادم» | عنوان خاطئ أو HTTP على أندرويد حديث | استخدم HTTPS، أو تحقّق من العنوان في شاشة التفعيل |
| الخريطة بلا خلفية | لا يوجد وصول إلى `tile.openstreetmap.org` | افتح الوصول، أو ضع `MAP_STYLE_URL` لنمط داخلي |
| ملصقات QR لا تُقرأ | طُبعت بمقياس مصغّر | اطبع بمقياس 100% بلا «ملاءمة الصفحة» |

---

## 8. ما بعد التسليم

بعد التركيب تصبح الشركة مسؤولة بالكامل عن: السيرفر، الاستضافة، الدومين، شهادة TLS، حسابات المتاجر، النسخ الاحتياطي خارج السيرفر، وأي تطوير مستقبلي.

**النظام لا يحتاج البائع للتشغيل اليومي إطلاقًا.**
