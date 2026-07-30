"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AdminPage() {
  const [email, setEmail] = useState("admin@kawkab.local");
  const [password, setPassword] = useState("change-me-admin");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Not signed in");

  async function login() {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      setStatus(`Login failed: ${response.status}`);
      return;
    }
    const data = await response.json();
    setToken(data.accessToken);
    setStatus(`Signed in as ${data.user.email}`);
  }

  return (
    <main className="admin-shell">
      <header className="admin-card">
        <h1>Kawkab Admin</h1>
        <p>Protected console for users, planets, moderation, simulation controls, and AI cost visibility.</p>
        <p className="status-warn">AI cost charts: غير مفعّل until provider billing integrations are connected.</p>
      </header>
      <section className="admin-grid">
        <aside className="admin-card">
          <h2>Login</h2>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button onClick={login}>Sign in</button>
          <p>{status}</p>
        </aside>
        <section className="admin-card">
          <h2>Operations</h2>
          <div className="stat-grid">
            <div className="stat"><strong>Users</strong><p>Requires token: {token ? "ready" : "locked"}</p></div>
            <div className="stat"><strong>Planets</strong><p>Live API read models</p></div>
            <div className="stat"><strong>Moderation</strong><p>Contribution review queue</p></div>
            <div className="stat"><strong>Simulation</strong><p>Manual tick controls</p></div>
          </div>
          <p className="status-warn">غير مفعّل: role-based admin route guards and cost graphs are marked until production auth policies are added.</p>
        </section>
      </section>
    </main>
  );
}
