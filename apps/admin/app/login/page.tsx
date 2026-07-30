'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setToken } from '../../lib/api';

/**
 * Admin login — Sandbox operators use +966500000001.
 * OTP is never shown in the UI; check API server logs for sandbox code.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('+966500000001');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  async function login() {
    setError('');
    setHint('');
    try {
      await api.requestOtp({ phone, acceptedTerms: true, locale: 'ar', countryCode: 'SA' });
      setHint('تم طلب الرمز — في Sandbox راجع سجلات الخادم (لا يُعرض الرمز هنا).');
      if (!code.trim()) {
        setError('أدخل رمز التحقق من سجلات الخادم ثم أعد المحاولة');
        return;
      }
      const res = await api.verifyOtp({ phone, code });
      setToken(res.accessToken);
      router.push('/ads/review');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="panel stack" style={{ maxWidth: 420 }}>
      <h2 style={{ margin: 0 }}>دخول المشرف</h2>
      <p className="muted">لوحة إدارة إعلاني — محمية بصلاحيات RBAC.</p>
      <label className="stack">
        <span>رقم الجوال</span>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="stack">
        <span>رمز التحقق</span>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="من سجلات الخادم في Sandbox"
        />
      </label>
      <button className="btn btn-primary" onClick={login}>
        دخول
      </button>
      {hint ? <p className="muted">{hint}</p> : null}
      {error ? <p style={{ color: '#b00020' }}>{error}</p> : null}
    </div>
  );
}
