'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setToken } from '../../lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('+966500000001');
  const [code, setCode] = useState('123456');
  const [error, setError] = useState('');

  async function login() {
    setError('');
    try {
      await api.requestOtp({ phone, acceptedTerms: true, locale: 'ar', countryCode: 'SA' });
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
      <p className="muted">في Sandbox أي مستخدم يمكنه المراجعة محليًا.</p>
      <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
      <button className="btn btn-primary" onClick={login}>
        دخول
      </button>
      {error ? <p style={{ color: '#b00020' }}>{error}</p> : null}
    </div>
  );
}
