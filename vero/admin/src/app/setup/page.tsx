'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, tokens, type Company, type User } from '@/lib/api';
import { ErrorBox, Field } from '@/components/ui';

const RADIUS_OPTIONS = [20, 30, 50];

const TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Bahrain',
  'Asia/Muscat',
  'Asia/Amman',
  'Asia/Baghdad',
  'Africa/Cairo',
  'Africa/Tripoli',
  'Africa/Khartoum',
  'UTC',
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [checking, setChecking] = useState(true);

  const [company, setCompany] = useState({
    name: '',
    city: '',
    phone: '',
    email: '',
    address: '',
    defaultGpsRadiusM: 30,
    timezone: 'Asia/Riyadh',
  });
  const [customRadius, setCustomRadius] = useState(false);
  const [admin, setAdmin] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [logo, setLogo] = useState<File | null>(null);

  useEffect(() => {
    api<{ setupCompleted: boolean }>('/v1/setup/status', { skipAuth: true })
      .then((s) => {
        if (s.setupCompleted) router.replace('/login');
        else setChecking(false);
      })
      .catch((e) => {
        setError(e);
        setChecking(false);
      });
  }, [router]);

  const submit = async () => {
    if (admin.password !== admin.confirm) {
      setError(new Error('كلمتا المرور غير متطابقتين'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{
        accessToken: string;
        refreshToken: string;
        user: User;
        company: Company;
      }>('/v1/setup', {
        method: 'POST',
        skipAuth: true,
        body: {
          company: {
            name: company.name,
            city: company.city || undefined,
            phone: company.phone || undefined,
            email: company.email || undefined,
            address: company.address || undefined,
            defaultGpsRadiusM: company.defaultGpsRadiusM,
            timezone: company.timezone,
          },
          admin: {
            fullName: admin.fullName,
            username: admin.username,
            email: admin.email || undefined,
            password: admin.password,
          },
        },
      });
      tokens.set(res.accessToken, res.refreshToken);

      if (logo) {
        const form = new FormData();
        form.append('file', logo);
        try {
          await api('/v1/company/logo', { method: 'POST', body: form });
        } catch {
          // الشعار ليس شرطًا لإكمال الإعداد — يمكن رفعه لاحقًا من هوية الشركة
        }
      }
      router.replace('/');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="skeleton" style={{ height: 160 }} />
        </div>
      </div>
    );
  }

  const step1Valid = company.name.trim().length >= 2 && company.defaultGpsRadiusM >= 5;
  const step2Valid =
    admin.fullName.trim().length >= 2 &&
    /^[A-Za-z0-9._-]{3,}$/.test(admin.username) &&
    admin.password.length >= 8;

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 560 }}>
        <div className="logo">VERO</div>
        <div className="tagline">معالج الإعداد الأول — يُشغَّل مرة واحدة</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {['بيانات الشركة', 'حساب المدير'].map((label, i) => (
            <div
              key={label}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 8,
                fontSize: 12.5,
                textAlign: 'center',
                fontWeight: 600,
                background: step === i + 1 ? 'var(--primary)' : 'var(--bg)',
                color: step === i + 1 ? '#fff' : 'var(--text-muted)',
              }}
            >
              {i + 1}. {label}
            </div>
          ))}
        </div>

        {error != null && <ErrorBox error={error} />}

        {step === 1 && (
          <>
            <Field label="اسم الشركة" required>
              <input
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                placeholder="شركة النظافة المتحدة"
                autoFocus
              />
            </Field>
            <Field label="شعار الشركة" hint="PNG أو JPG بحد أقصى 3 ميجابايت — يظهر في اللوحة والملصقات والتقارير">
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
              />
            </Field>
            <div className="row2">
              <Field label="المدينة">
                <input
                  value={company.city}
                  onChange={(e) => setCompany({ ...company, city: e.target.value })}
                  placeholder="الرياض"
                />
              </Field>
              <Field label="رقم التواصل">
                <input
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  dir="ltr"
                />
              </Field>
            </div>
            <Field label="البريد الإلكتروني">
              <input
                type="email"
                value={company.email}
                onChange={(e) => setCompany({ ...company, email: e.target.value })}
                dir="ltr"
              />
            </Field>
            <Field label="عنوان الشركة">
              <input
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
              />
            </Field>

            <Field
              label="نطاق GPS الافتراضي"
              required
              hint="أقصى مسافة بين العامل والحاوية لاعتبار الزيارة موثّقة. يمكن تخصيصه لكل حاوية لاحقًا."
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`btn sm ${!customRadius && company.defaultGpsRadiusM === r ? 'primary' : ''}`}
                    onClick={() => {
                      setCustomRadius(false);
                      setCompany({ ...company, defaultGpsRadiusM: r });
                    }}
                  >
                    {r} متر
                  </button>
                ))}
                <button
                  type="button"
                  className={`btn sm ${customRadius ? 'primary' : ''}`}
                  onClick={() => setCustomRadius(true)}
                >
                  مخصص
                </button>
                {customRadius && (
                  <input
                    type="number"
                    min={5}
                    max={5000}
                    style={{ width: 110 }}
                    value={company.defaultGpsRadiusM}
                    onChange={(e) =>
                      setCompany({ ...company, defaultGpsRadiusM: Number(e.target.value) || 30 })
                    }
                  />
                )}
              </div>
            </Field>

            <Field
              label="المنطقة الزمنية"
              required
              hint="عليها يعتمد تصفير عدّاد اليوم عند منتصف الليل المحلي"
            >
              <select
                value={company.timezone}
                onChange={(e) => setCompany({ ...company, timezone: e.target.value })}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>

            <button
              className="btn primary"
              style={{ width: '100%' }}
              disabled={!step1Valid}
              onClick={() => setStep(2)}
            >
              التالي
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="اسم مدير النظام" required>
              <input
                value={admin.fullName}
                onChange={(e) => setAdmin({ ...admin, fullName: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="اسم المستخدم" required hint="أحرف إنجليزية وأرقام فقط، 3 أحرف على الأقل">
              <input
                value={admin.username}
                onChange={(e) => setAdmin({ ...admin, username: e.target.value })}
                dir="ltr"
              />
            </Field>
            <Field label="البريد الإلكتروني">
              <input
                type="email"
                value={admin.email}
                onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
                dir="ltr"
              />
            </Field>
            <div className="row2">
              <Field label="كلمة المرور" required hint="8 أحرف على الأقل">
                <input
                  type="password"
                  value={admin.password}
                  onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
                  dir="ltr"
                />
              </Field>
              <Field label="تأكيد كلمة المرور" required>
                <input
                  type="password"
                  value={admin.confirm}
                  onChange={(e) => setAdmin({ ...admin, confirm: e.target.value })}
                  dir="ltr"
                />
              </Field>
            </div>

            <div className="alert info">
              <span>ℹ</span>
              <div>
                احتفظ ببيانات هذا الحساب في مكان آمن. لا توجد جهة خارجية تستطيع استرجاعه —
                النسخة مملوكة لشركتك بالكامل.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setStep(1)} disabled={busy}>
                رجوع
              </button>
              <button
                className="btn primary"
                style={{ flex: 1 }}
                disabled={!step2Valid || busy}
                onClick={submit}
              >
                {busy ? 'جارٍ الإعداد…' : 'إنهاء الإعداد وبدء الاستخدام'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
