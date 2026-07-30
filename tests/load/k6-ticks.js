import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Load test (provided): world reads + contribution previews.
 *   k6 run -e API=http://localhost:4000 tests/load/k6-ticks.js
 */
export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "60s", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<800"],
  },
};

const API = __ENV.API ?? "http://localhost:4000";

export function setup() {
  const res = http.post(`${API}/api/auth/register`, JSON.stringify({
    email: `load-${Date.now()}@kawkab.dev`,
    password: "load-password-1",
    displayName: "Load",
  }), { headers: { "content-type": "application/json" } });
  const planets = http.get(`${API}/api/worlds`).json();
  return { token: res.json("accessToken"), planetId: planets[0].id };
}

export default function (ctx) {
  const headers = { headers: { authorization: `Bearer ${ctx.token}`, "content-type": "application/json" } };
  check(http.get(`${API}/api/worlds/${ctx.planetId}`), { "planet ok": (r) => r.status === 200 });
  check(http.get(`${API}/api/worlds/${ctx.planetId}/layers/temperature`), { "layer ok": (r) => r.status === 200 });
  check(http.get(`${API}/api/simulation/${ctx.planetId}/status`), { "status ok": (r) => r.status === 200 });
  if (Math.random() < 0.1) {
    check(http.post(`${API}/api/contributions?locale=ar`, JSON.stringify({
      planetId: ctx.planetId, category: "plant", text: "شجرة تمتص التلوث",
    }), headers), { "preview ok": (r) => r.status === 201 || r.status === 200 });
  }
  sleep(0.5);
}
