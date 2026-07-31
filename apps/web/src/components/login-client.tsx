'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AuthTokensDto, CityDto, SessionUserDto } from '@e3lani/types';
import { ACCOUNT_TYPES } from '@e3lani/types';
import { Button, Input, Logo, Select } from '@e3lani/ui';
import { apiFetch } from '@/lib/api';
import { authedFetch, session } from '@/lib/session';

const ACCOUNT_LABELS: Record<string, string> = {
  INDIVIDUAL: 'فرد',
  STORE: 'متجر',
  BRAND: 'براند',
  COMPANY: 'شركة',
};

type Step = 'phone' | 'code' | 'profile';

/** تسجيل الدخول برقم الجوال + رمز تحقق فقط. */
export function LoginClient({ cities }: { cities: CityDto[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/account';

  const [step, setStep] = React.useState<Step>('phone');
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [profile, setProfile] = React.useState({
    name: '',
    cityId: '',
    accountType: 'INDIVIDUAL',
    email: '',
    acceptedTerms: false,
    acceptedPrivacy: false,
  });

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<{ resendAfterSeconds: number }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setCooldown(result.resendAfterSeconds);
      setStep('code');
    } catch (err: any) {
      setError(err.message ?? 'تعذّر إرسال الرمز');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<{ tokens: AuthTokensDto; user: SessionUserDto }>(
        '/auth/otp/verify',
        { method: 'POST', body: JSON.stringify({ phone, code }) },
      );
      session.save(result.tokens);
      if (result.user.profileComplete) {
        router.replace(next);
        return;
      }
      setStep('profile');
    } catch (err: any) {
      setError(err.message ?? 'رمز غير صحيح');
    } finally {
      setLoading(false);
    }
  };

  const completeProfile = async () => {
    setError(null);
    setLoading(true);
    try {
      await authedFetch('/auth/profile', {
        method: 'POST',
        body: JSON.stringify({
          name: profile.name,
          cityId: profile.cityId,
          accountType: profile.accountType,
          email: profile.email || undefined,
          acceptedTerms: profile.acceptedTerms,
          acceptedPrivacy: profile.acceptedPrivacy,
        }),
      });
      router.replace(next);
    } catch (err: any) {
      setError(err.errors?.[0]?.message ?? err.message ?? 'تعذّر حفظ البيانات');
    } finally {
      setLoading(false);
    }
  };

  const isBusiness = profile.accountType !== 'INDIVIDUAL';

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo size={44} />
        <p className="text-sm text-ink-muted">منصة الإعلانات المرئية لكل شيء</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {step === 'phone' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void requestOtp();
          }}
          className="space-y-4"
        >
          <Input
            label="رقم الجوال"
            inputMode="tel"
            placeholder="05xxxxxxxx"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            hint="سنرسل لك رمز تحقق برسالة نصية."
          />
          <Button type="submit" fullWidth loading={loading}>
            إرسال رمز التحقق
          </Button>
        </form>
      ) : null}

      {step === 'code' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void verifyOtp();
          }}
          className="space-y-4"
        >
          <Input
            label="رمز التحقق"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            hint={`أُرسل إلى ${phone}`}
          />
          <Button type="submit" fullWidth loading={loading}>
            تأكيد
          </Button>
          <button
            type="button"
            disabled={cooldown > 0}
            onClick={() => void requestOtp()}
            className="w-full text-sm font-semibold text-ink-muted disabled:opacity-50"
          >
            {cooldown > 0 ? `إعادة الإرسال بعد ${cooldown} ثانية` : 'إعادة إرسال الرمز'}
          </button>
        </form>
      ) : null}

      {step === 'profile' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void completeProfile();
          }}
          className="space-y-4"
        >
          <Input
            label="الاسم"
            value={profile.name}
            onChange={(event) => setProfile({ ...profile, name: event.target.value })}
            required
          />
          <Select
            label="المدينة"
            value={profile.cityId}
            onChange={(event) => setProfile({ ...profile, cityId: event.target.value })}
            required
          >
            <option value="">اختر المدينة</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.nameAr}
              </option>
            ))}
          </Select>
          <Select
            label="نوع الحساب"
            value={profile.accountType}
            onChange={(event) => setProfile({ ...profile, accountType: event.target.value })}
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ACCOUNT_LABELS[type]}
              </option>
            ))}
          </Select>
          <Input
            label={isBusiness ? 'البريد الإلكتروني (مطلوب)' : 'البريد الإلكتروني (اختياري)'}
            type="email"
            value={profile.email}
            onChange={(event) => setProfile({ ...profile, email: event.target.value })}
            required={isBusiness}
          />

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.acceptedTerms}
              onChange={(event) => setProfile({ ...profile, acceptedTerms: event.target.checked })}
              required
              className="mt-1"
            />
            <span>
              أوافق على{' '}
              <a href="/legal/terms" className="font-bold underline">
                الشروط والأحكام
              </a>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.acceptedPrivacy}
              onChange={(event) => setProfile({ ...profile, acceptedPrivacy: event.target.checked })}
              required
              className="mt-1"
            />
            <span>
              أوافق على{' '}
              <a href="/legal/privacy" className="font-bold underline">
                سياسة الخصوصية
              </a>
            </span>
          </label>

          <Button type="submit" fullWidth loading={loading}>
            إنشاء الحساب
          </Button>
        </form>
      ) : null}
    </div>
  );
}
