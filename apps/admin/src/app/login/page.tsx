'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input, Logo } from '@e3lani/ui';
import { adminLogin, adminSession } from '@/lib/admin-api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await adminLogin(email, password);
      adminSession.save(result.accessToken);
      router.replace('/');
    } catch (err: any) {
      setError(err.message ?? 'تعذّر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Card className="w-full max-w-sm space-y-5 p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={40} />
          <p className="text-sm text-ink-muted">لوحة الإدارة — دخول مصرّح به فقط</p>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <form onSubmit={submit} className="space-y-4">
          <Input
            label="البريد الإلكتروني"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="username"
          />
          <Input
            label="كلمة المرور"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
          <Button type="submit" fullWidth loading={loading}>
            دخول
          </Button>
        </form>
      </Card>
    </main>
  );
}
