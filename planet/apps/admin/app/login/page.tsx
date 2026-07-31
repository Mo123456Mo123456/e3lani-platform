"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@planet/ui";
import { api, setToken } from "@/lib/api";

export default function AdminLogin() {
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
      const { accessToken } = await api<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      // Verify the account actually has an admin role before entering.
      const me = await api<{ role: string }>("/users/me");
      void me;
      setToken(accessToken);
      const me2 = await api<{ role: string }>("/users/me");
      const adminRoles = ["content_moderator", "simulation_manager", "system_admin", "super_admin"];
      if (!adminRoles.includes(me2.role)) {
        setToken(null);
        setError("this_account_is_not_an_admin");
        return;
      }
      router.replace("/");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form
        onSubmit={submit}
        style={{
          width: 360, background: "var(--planet-bg-panel)", border: "1px solid var(--planet-border)",
          borderRadius: 14, padding: 28, display: "flex", flexDirection: "column", gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, color: "var(--planet-accent)" }}>لوحة الإدارة</h1>
        <p style={{ margin: 0, fontSize: 11, color: "var(--planet-text-dim)" }}>
          منطقة مقيدة — حسابات الإدارة فقط
        </p>
        <input className="input" type="email" required placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        <input className="input" type="password" required placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        {error && <p style={{ color: "var(--planet-red)", fontSize: 12 }}>{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? <Spinner size={14} /> : "دخول"}</Button>
      </form>
    </div>
  );
}
