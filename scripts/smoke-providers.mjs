import { readFile } from "node:fs/promises";

function readDotEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      return [key, value];
    }));
}

let fileEnv = {};
try { fileEnv = readDotEnv(await readFile(".env", "utf8")); } catch { /* Environment variables may be injected by CI/deploy. */ }
const env = (key, fallback = "") => process.env[key] || fileEnv[key] || fallback;
const outcomes = [];
async function probe(name, url, init = {}) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    outcomes.push({ name, ok: response.ok, message: `HTTP ${response.status}` });
  } catch (error) {
    outcomes.push({ name, ok: false, message: error instanceof Error ? error.name : "request failed" });
  }
}

await probe("Open-Meteo forecast", "https://api.open-meteo.com/v1/forecast?latitude=10.956&longitude=106.838&hourly=precipitation&forecast_days=1");

const orsKey = env("ORS_API_KEY");
if (orsKey) {
  const base = env("ORS_BASE_URL", "https://api.openrouteservice.org").replace(/\/$/, "");
  await probe("ORS driving-car", `${base}/v2/directions/driving-car/geojson`, {
    method: "POST", headers: { Authorization: orsKey, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [[106.838, 10.956], [106.85, 10.96]], instructions: false }),
  });
} else outcomes.push({ name: "ORS driving-car", ok: null, message: "BLOCKED — ORS_API_KEY chưa cấu hình" });

const redisReady = Boolean(env("UPSTASH_REDIS_REST_URL") && env("UPSTASH_REDIS_REST_TOKEN"));
if (!redisReady) outcomes.push({ name: "Valhalla motor_scooter", ok: null, message: "BLOCKED — Upstash chưa cấu hình, endpoint cộng đồng đang fail-closed" });
else {
  const base = env("VALHALLA_BASE_URL", "https://valhalla1.openstreetmap.de").replace(/\/$/, "");
  const params = new URLSearchParams({ json: JSON.stringify({ locations: [{ lat: 10.956, lon: 106.838 }, { lat: 10.96, lon: 106.85 }], costing: "motor_scooter", units: "kilometers" }) });
  await probe("Valhalla motor_scooter", `${base}/route?${params}`);
}

for (const item of outcomes) {
  const label = item.ok === true ? "PASS" : item.ok === false ? "FAIL" : "NOT VERIFIED";
  console.log(`[${label}] ${item.name}: ${item.message}`);
}
console.log("DeepSeek live calls are not made by this smoke command; use an explicit consented app request to test the configured model.");
if (outcomes.some((item) => item.ok === false)) process.exitCode = 1;
