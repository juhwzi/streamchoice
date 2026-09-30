// Pico de votos gratuitos + fluxo de webhooks Pix (assinados com HMAC) em paralelo.
//   k6 run -e BASE_URL=https://staging.seuapp.com load/spike.k6.js
import http from "k6/http";
import { check } from "k6";
import exec from "k6/execution";
import { hmac } from "k6/crypto";

const fx = JSON.parse(open("./fixtures.json"));
const BASE = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  scenarios: {
    // Simula uma raid: sobe rápido, sustenta o pico, desce.
    votes_spike: {
      executor: "ramping-arrival-rate", exec: "vote", startRate: 20, timeUnit: "1s",
      preAllocatedVUs: 200, maxVUs: 1500,
      stages: [
        { target: 60, duration: "20s" },
        { target: 500, duration: "10s" },
        { target: 500, duration: "30s" },
        { target: 30, duration: "20s" },
      ],
    },
    pix_webhooks: { executor: "constant-arrival-rate", exec: "pix", rate: 5, timeUnit: "1s", duration: "80s", preAllocatedVUs: 20, maxVUs: 100 },
  },
  thresholds: {
    "http_req_duration{scenario:votes_spike}": ["p(95)<800", "p(99)<1500"],
    "http_req_duration{scenario:pix_webhooks}": ["p(95)<800"],
    "checks": ["rate>0.99"],
  },
};

export function vote() {
  const i = exec.scenario.iterationInTest;
  const token = fx.tokens[i % fx.tokens.length]; // depois de esgotar, repete e recebe 409 (esperado)
  const sug = fx.suggestionIds[i % fx.suggestionIds.length];
  const r = http.post(`${BASE}/api/votes`, JSON.stringify({ pollId: fx.pollId, suggestionId: sug }), {
    headers: { "Content-Type": "application/json", Cookie: `sc_session=${token}` },
  });
  check(r, { "voto aceito (200) ou repetido (409)": (x) => x.status === 200 || x.status === 409 });
}

export function pix() {
  const id = `k6-${exec.vu.idInTest}-${exec.vu.iterationInScenario}-${Date.now()}`;
  const body = JSON.stringify({ id, amount: 5, name: "k6", message: `Voto ${fx.tags[Number(exec.vu.iterationInScenario) % fx.tags.length]}` });
  const headers = { "Content-Type": "application/json", "x-signature": hmac("sha256", fx.webhookSecret, body, "hex") };
  const url = `${BASE}/api/webhooks/livepix?channel=${fx.slug}`;
  const r = http.post(url, body, { headers });
  check(r, { "pix ok": (x) => x.status === 200 && x.json("outcome") === "ok" });
  if (exec.vu.iterationInScenario % 10 === 0) {
    const again = http.post(url, body, { headers }); // reentrega do gateway → idempotência
    check(again, { "reentrega ignorada": (x) => x.status === 200 && x.json("outcome") === "duplicate" });
  }
  const forged = http.post(url, body, { headers: { "Content-Type": "application/json", "x-signature": "0".repeat(64) } });
  check(forged, { "assinatura forjada → 401": (x) => x.status === 401 });
}
