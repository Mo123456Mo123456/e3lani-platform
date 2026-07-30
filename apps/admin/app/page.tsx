"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("admin@planet-born.local");
  const [password, setPassword] = useState("PlanetAdmin!2026");
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<unknown[]>([]);
  const [error, setError] = useState("");

  const login = async () => {
    setError("");
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "login_failed");
      return;
    }
    if (!["super_admin", "system_admin", "simulation_manager", "content_moderator"].includes(data.user.role)) {
      setError("not_admin");
      return;
    }
    setToken(data.accessToken);
    localStorage.setItem("pb_admin_access", data.accessToken);
  };

  const load = async (t: string) => {
    const headers = { Authorization: `Bearer ${t}` };
    const [o, u] = await Promise.all([
      fetch(`${API}/admin/overview`, { headers }).then((r) => r.json()),
      fetch(`${API}/admin/users`, { headers }).then((r) => r.json()),
    ]);
    if (o.error) {
      setError(o.error);
      return;
    }
    setOverview(o);
    setUsers(u.users ?? []);
  };

  useEffect(() => {
    const t = localStorage.getItem("pb_admin_access");
    if (t) {
      setToken(t);
      void load(t);
    }
  }, []);

  useEffect(() => {
    if (token) void load(token);
  }, [token]);

  const tick = async (n: number) => {
    await fetch(`${API}/simulation/tick`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ count: n }),
    });
    await load(token);
  };

  const pause = async (resume: boolean) => {
    await fetch(`${API}/simulation/${resume ? "resume" : "pause"}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    await load(token);
  };

  if (!token) {
    return (
      <main style={{ maxWidth: 420, margin: "4rem auto", padding: 24 }}>
        <h1>لوحة الإدارة — كوكب يولد أمامك</h1>
        <p style={{ opacity: 0.7 }}>غير معروضة للمستخدم العادي. Sandbox Super Admin فقط.</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} style={inp} />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inp}
        />
        {error && <div style={{ color: "#f87171" }}>{error}</div>}
        <button onClick={login} style={btn}>
          دخول الإدارة
        </button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>إدارة المحاكاة</h1>
          <p style={{ opacity: 0.7, margin: "4px 0 0" }}>RBAC · Ticks · AI cost · Users</p>
        </div>
        <button
          style={btn}
          onClick={() => {
            localStorage.removeItem("pb_admin_access");
            setToken("");
          }}
        >
          خروج
        </button>
      </header>

      {error && <div style={{ color: "#f87171", marginBottom: 12 }}>{error}</div>}

      {overview && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {Object.entries({
            users: overview.users,
            contributions: overview.contributions,
            events: overview.events,
            aiCostUsd: overview.aiCostUsd,
            tick: overview.tick,
            year: overview.year,
            running: String(overview.running),
          }).map(([k, v]) => (
            <div
              key={k}
              style={{
                background: "#121a2b",
                border: "1px solid #243044",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ opacity: 0.6, fontSize: 12 }}>{k}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{String(v)}</div>
            </div>
          ))}
        </section>
      )}

      <section style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <button style={btn} onClick={() => tick(1)}>
          Tick +1
        </button>
        <button style={btn} onClick={() => tick(5)}>
          Tick +5
        </button>
        <button style={btn} onClick={() => pause(false)}>
          Pause
        </button>
        <button style={btn} onClick={() => pause(true)}>
          Resume
        </button>
      </section>

      <section>
        <h2>المستخدمون</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["email", "displayName", "role", "level", "xp"].map((h) => (
                  <th key={h} style={{ textAlign: "right", borderBottom: "1px solid #243044", padding: 8 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(users as { email: string; displayName: string; role: string; level: number; xp: number }[]).map(
                (u) => (
                  <tr key={u.email}>
                    <td style={td}>{u.email}</td>
                    <td style={td}>{u.displayName}</td>
                    <td style={td}>{u.role}</td>
                    <td style={td}>{u.level}</td>
                    <td style={td}>{u.xp}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const inp: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginBottom: 8,
  padding: 10,
  borderRadius: 8,
  border: "1px solid #243044",
  background: "#121a2b",
  color: "#e8eef8",
};
const btn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #164e63",
  background: "#0e7490",
  color: "white",
  cursor: "pointer",
};
const td: React.CSSProperties = { padding: 8, borderBottom: "1px solid #1a2438" };
