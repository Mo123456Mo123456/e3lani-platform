"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

export default function AdminPage() {
  const [email, setEmail] = useState("superadmin@planet.local");
  const [password, setPassword] = useState("PlanetAdmin!23");
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setError(null);
    const res = await fetch(`${API}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      setError("Login failed");
      return;
    }
    const data = await res.json();
    setToken(data.accessToken);
  }

  useEffect(() => {
    if (!token) return;
    (async () => {
      const headers = { authorization: `Bearer ${token}` };
      const o = await fetch(`${API}/v1/admin/overview`, { headers });
      if (!o.ok) {
        setError("Forbidden — admin role required");
        return;
      }
      setOverview(await o.json());
      const u = await fetch(`${API}/v1/admin/users`, { headers });
      if (u.ok) {
        const body = await u.json();
        setUsers(body.users ?? []);
      }
    })();
  }, [token]);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <h1 style={{ marginTop: 0 }}>لوحة إدارة المحاكاة</h1>
      <p style={{ color: "#94a3b8" }}>
        غير مرتبطة بواجهة المستخدم العامة. الحساب التجريبي موثّق في README فقط.
      </p>

      {!token ? (
        <div
          style={{
            display: "grid",
            gap: 10,
            maxWidth: 360,
            padding: 16,
            border: "1px solid #334155",
            borderRadius: 12,
            background: "#0b1728",
          }}
        >
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={login}>دخول الإدارة</button>
          {error && <div style={{ color: "#f87171" }}>{error}</div>}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {overview && (
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
              }}
            >
              {(
                [
                  ["Users", overview.users],
                  ["Contributions", overview.contributions],
                  ["Events", overview.events],
                  ["AI Requests", overview.aiRequests],
                ] as Array<[string, unknown]>
              ).map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: "#0b1728",
                    border: "1px solid #334155",
                  }}
                >
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{String(value ?? 0)}</div>
                </div>
              ))}
            </section>
          )}

          <section>
            <h2>المستخدمون</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "right", color: "#94a3b8" }}>
                    <th>الاسم</th>
                    <th>البريد</th>
                    <th>الدور</th>
                    <th>المستوى</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={String(u.id)} style={{ borderTop: "1px solid #1e293b" }}>
                      <td style={{ padding: 8 }}>{String(u.displayName)}</td>
                      <td>{String(u.email)}</td>
                      <td>{String(u.role)}</td>
                      <td>{String(u.level)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
