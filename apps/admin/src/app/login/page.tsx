"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel } from "@kawkab/ui";
import { adminLogin, ApiError } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminLogin(email, password);
      router.replace("/overview");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? "هذا الحساب لا يملك صلاحيات الإدارة." : "بيانات الدخول غير صحيحة.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Panel title="لوحة الإدارة — تسجيل الدخول">
          <form onSubmit={submit} className="space-y-3">
            <input type="email" required placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-bg border border-line rounded-md px-3 py-2 text-sm focus:border-tech outline-none" dir="ltr" />
            <input type="password" required placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-bg border border-line rounded-md px-3 py-2 text-sm focus:border-tech outline-none" dir="ltr" />
            {error && <div className="text-war text-xs">{error}</div>}
            <Button disabled={busy} style={{ width: "100%" }}>{busy ? "…" : "دخول"}</Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
