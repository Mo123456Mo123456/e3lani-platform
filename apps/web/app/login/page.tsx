'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setToken } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function requestOtp() {
    if (!accepted) {
      setError('يجب الموافقة على الشروط وسياسة الخصوصية');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.requestOtp({
        phone,
        acceptedTerms: true,
        locale: 'ar',
        countryCode: 'SA',
      });
      setHint('تم إرسال رمز التحقق إلى جوالك');
      setStep('otp');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setLoading(true);
    setError('');
    try {
      const res = await api.verifyOtp({ phone, code });
      setToken(res.accessToken);
      router.push('/account');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <div className="panel stack" style={{ maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ margin: 0 }}>دخول إعلاني</h1>
        <p className="muted">سجّل برقم الجوال — منصة الإعلانات المرئية لكل شيء.</p>
        {step === 'phone' ? (
          <>
            <label className="stack">
              <span>رقم الجوال</span>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+9665XXXXXXXX"
                inputMode="tel"
              />
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span className="muted" style={{ fontSize: 14 }}>
                أوافق على الشروط وسياسة الخصوصية
              </span>
            </label>
            <button className="btn btn-primary" disabled={loading} onClick={requestOtp}>
              إرسال الرمز
            </button>
          </>
        ) : (
          <>
            <label className="stack">
              <span>رمز التحقق</span>
              <input
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </label>
            {hint ? <p className="success">{hint}</p> : null}
            <button className="btn btn-primary" disabled={loading} onClick={verify}>
              تأكيد الدخول
            </button>
          </>
        )}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </main>
  );
}
