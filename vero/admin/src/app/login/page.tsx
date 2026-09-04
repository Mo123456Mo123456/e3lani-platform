'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, tokens, type User } from '@/lib/api';
import { ErrorBox, Field } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [checking, setChecking] = useState(true);

  // لو لم يُعد النظام بعد، نوجّه إلى معالج الإعداد بدل شاشة دخول لا تعمل
  useEffect(() => {
    api<{ setupCompleted: boolean }>('/v1/setup/status', { skipAuth: true })
      .then((s) => {
        if (!s.setupCompleted) router.replace('/setup');
        else setChecking(false);
      })
      .catch((e) => {
        setError(e);
        setChecking(false);
      });
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ accessToken: string; refreshToken: string; user: User }>(
        '/v1/auth/login',
        { method: 'POST', body: { username, password }, skipAuth: true },
      );
      tokens.set(res.accessToken, res.refreshToken);
      router.replace('/');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo">VERO</div>
        <div className="tagline">كل زيارة لها إثبات</div>

        {error != null && <ErrorBox error={error} />}

        {!checking && (
          <form onSubmit={submit}>
            <Field label="اسم المستخدم" required>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                dir="ltr"
              />
            </Field>
            <Field label="كلمة المرور" required>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                dir="ltr"
              />
            </Field>
            <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'جارٍ التحقق…' : 'دخول'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
