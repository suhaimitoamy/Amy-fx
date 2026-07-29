import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  ENGINE_VERSION,
  NON_TERMINAL_STATUSES,
  activateCandidate,
  advanceSetupLifecycle,
  assignRecommendations,
  detectScalperCandidates,
  findNextOpen,
  lifecycleMessage,
} from "./engine.mjs";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const PUSH_FUNCTION = "scalper-system-push";
const MARKET_FUNCTION = "market-candles";
const MAX_SIGNAL_AGE_SECONDS = 6 * 60 * 60;
const NOTIFICATION_AGE_SECONDS = 20 * 60;
const STALE_M15_SECONDS = 35 * 60;
const responseHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: responseHeaders }); }
function dbHeaders(extra = {}) { return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Accept: "application/json", ...extra }; }
async function rest(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders(), ...(init.headers || {}) } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
async function acquireRun(nowSeconds) {
  const bucket = Math.floor(nowSeconds / 60);
  const rows = await rest("amyfx_preview_scalper_runs?on_conflict=run_bucket", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ run_bucket: bucket, started_at: new Date().toISOString() }) });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}
async function finishRun(bucket, payload, error = null) {
  await rest(`amyfx_preview_scalper_runs?run_bucket=eq.${bucket}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ status: error ? "FAILED" : "COMPLETED", completed_at: new Date().toISOString(), result: payload || {}, error: error ? String(error).slice(0, 1800) : null }) });
}
async function refreshMarketSeries(interval, outputsize) {
  const params = new URLSearchParams({ symbol: "XAU/USD", interval, outputsize: String(outputsize) });
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${MARKET_FUNCTION}?${params.toString()}`, { headers: { Accept: "application/json" } });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch (_) { payload = { raw: text.slice(0, 500) }; }
  if (!response.ok || payload?.status === "error") throw new Error(`market_refresh_${interval}_${response.status}: ${payload?.message || payload?.raw || "unknown"}`);
  return { interval, source: payload?.source || "unknown", latestOpenTime: payload?.latestOpenTime || null };
}
async function refreshMarketData() { return Promise.all([refreshMarketSeries("1min", 500), refreshMarketSeries("15min", 700), refreshMarketSeries("1h", 400)]); }
async function loadCandles(timeframe, limit) {
  const params = new URLSearchParams({ select: "symbol,timeframe,open_time,close_time,open,high,low,close,is_closed", symbol: "eq.XAU/USD", timeframe: `eq.${timeframe}`, is_closed: "eq.true", order: "open_time.desc", limit: String(limit) });
  const rows = await rest(`candles?${params.toString()}`);
  return (Array.isArray(rows) ? rows : []).reverse();
}
async function insertSetup(candidate) {
  const rows = await rest("amyfx_preview_scalper_setups?on_conflict=id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ ...candidate, updated_at: new Date().toISOString() }) });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}
async function updateSetup(setup) { await rest(`amyfx_preview_scalper_setups?id=eq.${encodeURIComponent(setup.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ ...setup, updated_at: new Date().toISOString() }) }); }
async function loadActiveSetups() {
  const params = new URLSearchParams({ select: "*", status: `in.(${NON_TERMINAL_STATUSES.join(",")})`, order: "signal_candle_close_time.asc", limit: "100" });
  const rows = await rest(`amyfx_preview_scalper_setups?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}
async function insertEvent(setup, event, notificationEligible) {
  if (!event?.status) return false;
  const rows = await rest("amyfx_preview_scalper_events?on_conflict=setup_id,status", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ setup_id: setup.id, status: event.status, event_time: new Date().toISOString(), candle_time: event.candle_time || null, price: event.price ?? null, result_r: event.result_r ?? null, message: lifecycleMessage(setup, event.status), notification_eligible: Boolean(notificationEligible), payload: { model: setup.model, direction: setup.direction, recommendation_status: setup.recommendation_status, bars_elapsed: setup.bars_elapsed } }) });
  return Array.isArray(rows) && rows.length > 0;
}
async function invokePush() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${PUSH_FUNCTION}`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: "{}" });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch (_) { payload = { raw: text.slice(0, 500) }; }
  return { ok: response.ok, status: response.status, payload };
}
Deno.serve(async (request) => {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "backend_not_configured" }, 503);
  const url = new URL(request.url);
  if (url.searchParams.get("health") === "1") return json({ ok: true, engine: ENGINE_VERSION, mode: "shadow", max_active_recommendations: 2 });
  const nowSeconds = Math.floor(Date.now() / 1000);
  let run = null;
  try {
    run = await acquireRun(nowSeconds);
    if (!run) return json({ ok: true, skipped: true, reason: "minute_already_processed", engine: ENGINE_VERSION });
    const marketRefresh = await refreshMarketData();
    const [m15, h1, m1] = await Promise.all([loadCandles("M15", 700), loadCandles("H1", 400), loadCandles("M1", 500)]);
    const latestM15 = m15.at(-1);
    if (!latestM15 || nowSeconds - Number(latestM15.close_time || 0) > STALE_M15_SECONDS) {
      const payload = { ok: false, skipped: true, reason: "m15_data_stale", latest_m15_close_time: latestM15?.close_time || null };
      await finishRun(run.run_bucket, payload);
      return json(payload);
    }
    const candidates = detectScalperCandidates({ m15, h1, nowSeconds, maxSignalAgeSeconds: MAX_SIGNAL_AGE_SECONDS });
    let inserted = 0, activated = 0, lifecycleEvents = 0;
    for (const candidate of candidates) {
      const freshEnough = nowSeconds - Number(candidate.signal_candle_close_time) <= NOTIFICATION_AGE_SECONDS;
      const created = await insertSetup({ ...candidate, notification_enabled: freshEnough });
      if (!created) continue;
      inserted += 1;
      if (await insertEvent(created, { status: "WAITING_NEXT_OPEN", price: null, candle_time: candidate.signal_candle_open_time, result_r: null }, created.notification_enabled === true)) lifecycleEvents += 1;
    }
    let active = await loadActiveSetups();
    for (const current of active) {
      let setup = current;
      if (setup.status === "WAITING_NEXT_OPEN") {
        const nextOpen = findNextOpen(setup, { m1, m15 });
        if (nextOpen) {
          const activatedResult = activateCandidate(setup, nextOpen);
          setup = activatedResult.setup;
          await updateSetup(setup);
          if (activatedResult.event && await insertEvent(setup, activatedResult.event, setup.notification_enabled === true)) lifecycleEvents += 1;
          activated += setup.status === "ACTIVE" ? 1 : 0;
        }
      }
      if (setup.status === "ACTIVE" || setup.status === "BE_ACTIVE") {
        const advanced = advanceSetupLifecycle(setup, m15);
        setup = advanced.setup;
        if (advanced.events.length || setup.last_evaluated_open_time !== current.last_evaluated_open_time) await updateSetup(setup);
        for (const event of advanced.events) if (await insertEvent(setup, event, setup.notification_enabled === true)) lifecycleEvents += 1;
      }
    }
    active = await loadActiveSetups();
    const recommended = assignRecommendations(active, 2);
    for (const setup of recommended) {
      const previous = active.find(item => item.id === setup.id);
      if (previous?.recommendation_status !== setup.recommendation_status) await updateSetup(setup);
    }
    const push = lifecycleEvents > 0 ? await invokePush() : { ok: true, skipped: true };
    const payload = { ok: true, engine: ENGINE_VERSION, mode: "shadow", candles: { M15: m15.length, H1: h1.length, M1: m1.length }, market_refresh: marketRefresh, candidates: candidates.length, inserted, activated, lifecycle_events: lifecycleEvents, active_setups: recommended.length, recommended_active: recommended.filter(item => item.recommendation_status === "VALID").length, push };
    await finishRun(run.run_bucket, payload);
    return json(payload);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("scalper-engine failed", error);
    if (run?.run_bucket != null) await finishRun(run.run_bucket, null, detail).catch(() => null);
    return json({ error: "scalper_engine_failed", detail, engine: ENGINE_VERSION }, 500);
  }
});
