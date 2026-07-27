'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setToken } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('+966512345678');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    setLoading(true);
    setError('');
    try {
      const res = await api.requestOtp({
        phone,
        acceptedTerms: true,
        locale: 'ar',
        countryCode: 'SA',
      });
      setHint(res.sandboxCode ? `رمز التجربة: ${res.sandboxCode}` : 'تم إرسال الرمز');
      setStep('otp');
      if (res.sandboxCode) setCode(res.sandboxCode);
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
        <p className="muted">دخول تجريبي بالرمز — المراجعة قبل الدفع.</p>
        {step === 'phone' ? (
          <>
            <label className="stack">
              <span>رقم الجوال</span>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={loading} onClick={requestOtp}>
              إرسال الرمز
            </button>
          </>
        ) : (
          <>
            <label className="stack">
              <span>رمز التحقق</span>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
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
