"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel } from "@kawkab/ui";
import { authApi } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { useT } from "@/components/LocaleProvider";

export default function RegisterPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const setUser = useWorldStore((s) => s.setUser);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const { user } = await authApi.register(email, password, displayName, locale);
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
        <Panel title={t("auth.register")}>
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="block text-xs text-dim mb-1">{t("auth.displayName")}</span>
              <input required minLength={2} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-bg border border-line rounded-md px-3 py-2 text-sm focus:border-tech outline-none" />
            </label>
            <label className="block">
              <span className="block text-xs text-dim mb-1">{t("auth.email")}</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-bg border border-line rounded-md px-3 py-2 text-sm focus:border-tech outline-none" dir="ltr" />
            </label>
            <label className="block">
              <span className="block text-xs text-dim mb-1">{t("auth.password")}</span>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-bg border border-line rounded-md px-3 py-2 text-sm focus:border-tech outline-none" dir="ltr" />
            </label>
            {error && <div className="text-war text-xs">{t("auth.error")}</div>}
            <Button disabled={busy} style={{ width: "100%" }}>{busy ? "…" : t("auth.submit.register")}</Button>
            <div className="text-xs text-dim text-center">
              <Link href={`/${locale}/auth/login`} className="text-tech hover:underline">
                {t("auth.haveAccount")}
              </Link>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
