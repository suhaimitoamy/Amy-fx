import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const API_KEY = String(Deno.env.get("TWELVEDATA_API_KEY") || "");
const BASE = "https://api.twelvedata.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function clampSize(value: string | null) {
  const parsed = Number.parseInt(String(value || "160"), 10);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 160, 20), 240);
}

function parseUtcSeconds(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text.replace(" ", "T")}Z`;
  const milliseconds = Date.parse(normalized);
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : 0;
}

async function request(path: string, params: Record<string, string>) {
  const query = new URLSearchParams({ ...params, apikey: API_KEY });
  const response = await fetch(`${BASE}/${path}?${query.toString()}`, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status === "error") {
    throw new Error(String(payload?.message || `twelvedata_http_${response.status}`));
  }
  return payload;
}

async function discoverDxySymbol() {
  try {
    const payload = await request("symbol_search", { symbol: "DXY", outputsize: "20" });
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const ranked = rows
      .filter((row: any) => String(row?.symbol || "").toUpperCase().includes("DXY"))
      .sort((a: any, b: any) => {
        const exactA = String(a?.symbol || "").toUpperCase() === "DXY" ? 0 : 1;
        const exactB = String(b?.symbol || "").toUpperCase() === "DXY" ? 0 : 1;
        const indexA = String(a?.instrument_type || a?.type || "").toLowerCase().includes("index") ? 0 : 1;
        const indexB = String(b?.instrument_type || b?.type || "").toLowerCase().includes("index") ? 0 : 1;
        return exactA - exactB || indexA - indexB;
      });
    return String(ranked[0]?.symbol || "").trim() || null;
  } catch (_) {
    return null;
  }
}

async function fetchSeries(symbol: string, outputsize: number) {
  return request("time_series", {
    symbol,
    interval: "15min",
    outputsize: String(outputsize + 4),
    timezone: "UTC",
    format: "JSON",
  });
}

async function resolveSeries(outputsize: number) {
  const candidates = ["DXY", "DXY:ICE"];
  const discovered = await discoverDxySymbol();
  if (discovered && !candidates.includes(discovered)) candidates.unshift(discovered);
  let lastError = "DXY symbol unavailable";
  for (const symbol of candidates) {
    try {
      const payload = await fetchSeries(symbol, outputsize);
      if (Array.isArray(payload?.values) && payload.values.length) return { symbol, payload };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "GET") return json({ status: "error", message: "method_not_allowed" }, 405);
  if (!API_KEY) return json({ status: "error", message: "TWELVEDATA_API_KEY_not_configured" }, 503);

  try {
    const url = new URL(request.url);
    const outputsize = clampSize(url.searchParams.get("outputsize"));
    const { symbol, payload } = await resolveSeries(outputsize);
    const currentBucket = Math.floor(Date.now() / 1000 / 900) * 900;
    const values = (Array.isArray(payload.values) ? payload.values : [])
      .map((value: any) => ({ ...value, _open_time: parseUtcSeconds(value?.datetime) }))
      .filter((value: any) => value._open_time > 0 && value._open_time < currentBucket)
      .slice(0, outputsize)
      .map(({ _open_time, ...value }: any) => value);
    if (!values.length) return json({ status: "error", message: "DXY_closed_M15_unavailable" }, 503);

    return json({
      status: "ok",
      meta: { symbol: "DXY", provider_symbol: symbol, interval: "15min", timezone: "UTC" },
      values,
      source: "twelvedata-dxy-readonly",
      closedOnly: true,
      evidenceOnly: true,
    });
  } catch (error) {
    return json({ status: "error", message: error instanceof Error ? error.message : String(error) }, 502);
  }
});
