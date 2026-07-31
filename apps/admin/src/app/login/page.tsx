"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorBox, Input, Label, Spinner } from "@planet/ui";
import { api, useAdminAuth } from "@/lib/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const setSession = useAdminAuth((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api().login({ email, password });
      if (!["admin", "super_admin", "sim_manager", "moderator"].includes(res.user.role)) {
        setError("هذا الحساب لا يملك صلاحيات الإدارة.");
        return;
      }
      setSession(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      api().setRefreshToken(res.tokens.refreshToken);
      router.replace("/");
    } catch {
      setError("تعذر تسجيل الدخول.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <Card style={{ width: 380, padding: 24 }}>
        <h1 style={{ fontSize: 19, marginTop: 0 }}>دخول الإدارة</h1>
        <form onSubmit={submit}>
          <Label>البريد</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
          <div style={{ height: 10 }} />
          <Label>كلمة المرور</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" />
          <div style={{ height: 14 }} />
          {error ? <ErrorBox>{error}</ErrorBox> : null}
          <div style={{ height: 10 }} />
          <Button variant="primary" block disabled={busy}>
            {busy ? <Spinner /> : "دخول"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
