
"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function api(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(`${path} failed ${response.status}`);
  return response.json();
}

export default function AdminPage() {
  const [email, setEmail] = useState("admin@kawkab.local");
  const [password, setPassword] = useState("change-me-admin");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Not signed in");
  const [users, setUsers] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [simulation, setSimulation] = useState<any>();

  async function login() {
    const data = await api("/auth/login", "", { method: "POST", body: JSON.stringify({ email, password }) });
    setToken(data.accessToken);
    setStatus(`Signed in as ${data.user.email}`);
  }

  async function refresh() {
    const [u, c, s] = await Promise.all([api("/admin/users", token), api("/admin/contributions", token), api("/simulation/status", token)]);
    setUsers(u.users);
    setContributions(c.contributions);
    setSimulation(s);
  }

  async function moderate(id: string, status: "previewed" | "rejected") {
    await api(`/admin/contributions/${id}/moderate`, token, { method: "POST", body: JSON.stringify({ status }) });
    await refresh();
  }

  async function tick() {
    const data = await api("/admin/simulation/tick", token, { method: "POST" });
    setSimulation({ tick: data.state?.tick, ageYears: data.state?.planet?.ageYears, running: true });
  }

  async function pause(paused: boolean) {
    const data = await api(paused ? "/admin/simulation/pause" : "/admin/simulation/resume", token, { method: "POST" });
    setSimulation((current: any) => ({ ...(current ?? {}), paused: data.paused }));
  }

  return (
    <main className="admin-shell">
      <header className="admin-card">
        <h1>Kawkab Admin</h1>
        <p>Protected console for users, moderation, and simulation controls.</p>
        <p className="status-warn">AI cost charts: غير مفعّل until provider billing integrations are connected.</p>
      </header>
      <section className="admin-grid">
        <aside className="admin-card">
          <h2>Login</h2>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button onClick={login}>Sign in</button>
          <p>{status}</p>
          <button disabled={!token} onClick={refresh}>Load admin data</button>
        </aside>
        <section className="admin-card">
          <h2>Simulation</h2>
          <div className="stat-grid">
            <div className="stat"><strong>Tick</strong><p>{simulation?.tick ?? "-"}</p></div>
            <div className="stat"><strong>Age</strong><p>{simulation?.ageYears ?? "-"}</p></div>
            <div className="stat"><strong>Paused</strong><p>{String(simulation?.paused ?? false)}</p></div>
            <div className="stat"><strong>Cost</strong><p className="status-warn">غير مفعّل</p></div>
          </div>
          <div className="admin-actions"><button disabled={!token} onClick={tick}>Run tick</button><button disabled={!token} onClick={() => pause(true)}>Pause</button><button disabled={!token} onClick={() => pause(false)}>Resume</button></div>
        </section>
      </section>
      <section className="admin-grid wide">
        <section className="admin-card"><h2>Users</h2>{users.map((user) => <div className="row" key={user.id}><strong>{user.email}</strong><span>{user.roles.join(", ")}</span><span>score {user.contributionScore}</span></div>)}</section>
        <section className="admin-card"><h2>Contributions</h2>{contributions.map((item) => <div className="row" key={item.id}><strong>{item.category}</strong><span>{item.status}</span><span>{item.prompt}</span><button onClick={() => moderate(item.id, "previewed")}>Approve</button><button onClick={() => moderate(item.id, "rejected")}>Reject</button></div>)}</section>
      </section>
    </main>
  );
}
