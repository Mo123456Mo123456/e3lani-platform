"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel } from "@kawkab/ui";
import { authApi } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { useT } from "@/components/LocaleProvider";

export default function LoginPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const setUser = useWorldStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const { user } = await authApi.login(email, password);
      setUser(user);
      router.push(`/${locale}`);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Panel title={t("auth.login")}>
          <form onSubmit={submit} className="space-y-3">
            <Field label={t("auth.email")}>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} dir="ltr" />
            </Field>
            <Field label={t("auth.password")}>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} dir="ltr" />
            </Field>
            {error && <div className="text-war text-xs">{t("auth.error")}</div>}
            <Button disabled={busy} style={{ width: "100%" }}>{busy ? "…" : t("auth.submit.login")}</Button>
            <div className="text-xs text-dim text-center">
              <Link href={`/${locale}/auth/register`} className="text-tech hover:underline">
                {t("auth.needAccount")}
              </Link>
            </div>
            <div className="text-[10px] text-dim/70 text-center">{t("auth.oauthNote")}</div>
          </form>
        </Panel>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-bg border border-line rounded-md px-3 py-2 text-sm focus:border-tech outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-dim mb-1">{label}</span>
      {children}
    </label>
  );
}
