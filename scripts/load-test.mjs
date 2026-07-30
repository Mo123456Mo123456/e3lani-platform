#!/usr/bin/env node
/**
 * Load test — hammers the API with concurrent mixed traffic and reports
 * latency percentiles + error rate. Zero external dependencies.
 *
 * Usage:
 *   API_URL=http://localhost:4100 node scripts/load-test.mjs [seconds] [concurrency]
 */
const API = process.env.API_URL ?? "http://localhost:4100";
const DURATION_S = Number(process.argv[2] ?? 15);
const CONCURRENCY = Number(process.argv[3] ?? 12);

const results = { ok: 0, failed: 0, throttled: 0, latencies: [] };

async function registerUser() {
  const email = `load-${Math.random().toString(36).slice(2, 10)}@test.dev`;
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "password-123", displayName: "load" }),
  });
  if (!res.ok) throw new Error(`register ${res.status}`);
  const body = await res.json();
  return { token: body.tokens.accessToken, planetId: null };
}

async function worker(id, planetId, token, stopAt) {
  while (Date.now() < stopAt) {
    const pick = Math.random();
    const started = performance.now();
    try {
      let res;
      if (pick < 0.45) {
        res = await fetch(`${API}/planets/${planetId}/events?limit=20`);
      } else if (pick < 0.75) {
        res = await fetch(`${API}/planets/${planetId}/grid-config`);
      } else {
        res = await fetch(`${API}/planets/${planetId}/contributions/analyze`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: "شجرة تمتص التلوث في الغابات", locale: "ar" }),
        });
      }
      if (res.status === 429) {
        results.throttled++;
        continue;
      }
      if (!res.ok) throw new Error(String(res.status));
      await res.arrayBuffer();
      results.ok++;
      results.latencies.push(performance.now() - started);
    } catch {
      results.failed++;
    }
  }
}

const planetsRes = await fetch(`${API}/planets`);
const { planets } = await planetsRes.json();
const planetId = planets[0].id;
const { token } = await registerUser();
console.log(`load test: ${DURATION_S}s × ${CONCURRENCY} workers against ${API} (planet ${planetId})`);

const stopAt = Date.now() + DURATION_S * 1000;
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i, planetId, token, stopAt)));

results.latencies.sort((a, b) => a - b);
const pct = (p) => results.latencies[Math.floor((results.latencies.length * p) / 100)]?.toFixed(1) ?? "—";
const total = results.ok + results.failed;
console.log(JSON.stringify({
  requests: total,
  ok: results.ok,
  failed: results.failed,
  throttled: results.throttled,
  errorRate: `${((results.failed / Math.max(1, total)) * 100).toFixed(2)}%`,
  rps: (total / DURATION_S).toFixed(1),
  latencyMs: { p50: pct(50), p90: pct(90), p99: pct(99) },
  note: results.throttled > 0 ? "429s are the rate limiter working as designed; raise RATE_LIMIT_MAX to measure raw capacity" : undefined,
}, null, 2));
