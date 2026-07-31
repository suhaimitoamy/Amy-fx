import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  DRIVER_REGISTRY,
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
const MAX_SIGNAL_AGE_SECONDS = 20 * 60;
const NOTIFICATION_AGE_SECONDS = 10 * 60;
const STALE_M15_SECONDS = 35 * 60;
const STALE_H1_SECONDS = 3 * 60 * 60;

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
async function loadPreviousRun(bucket) {
  const rows = await rest(`amyfx_preview_scalper_runs?select=result&run_bucket=lt.${bucket}&status=eq.COMPLETED&order=run_bucket.desc&limit=1`);
  return Array.isArray(rows) && rows.length ? rows[0]?.result || null : null;
}
async function loadCandles(timeframe, limit) {
  const params = new URLSearchParams({ select: "symbol,timeframe,open_time,close_time,open,high,low,close,is_closed", symbol: "eq.XAU/USD", timeframe: `eq.${timeframe}`, is_closed: "eq.true", order: "open_time.desc", limit: String(limit) });
  const rows = await rest(`candles?${params.toString()}`);
  return (Array.isArray(rows) ? rows : []).reverse();
}
function aggregateCandles(rows, seconds, timeframe, sourceSeconds) {
  const buckets = new Map();
  const expectedCount = Math.floor(seconds / sourceSeconds);
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.is_closed === false) continue;
    const openTime = Number(row.open_time);
    const closeTime = Number(row.close_time);
    if (!Number.isFinite(openTime) || !Number.isFinite(closeTime)) continue;
    const bucket = Math.floor(openTime / seconds) * seconds;
    const current = buckets.get(bucket) || { rows: [] };
    current.rows.push({ ...row, open_time: openTime, close_time: closeTime });
    buckets.set(bucket, current);
  }
  const output = [];
  for (const [bucket, value] of buckets) {
    const source = value.rows.sort((a, b) => a.open_time - b.open_time);
    const complete = source.length === expectedCount
      && source[0]?.open_time === bucket
      && source.at(-1)?.close_time >= bucket + seconds
      && source.every((row, index) => row.open_time === bucket + index * sourceSeconds);
    if (!complete) continue;
    output.push({
      symbol: "XAU/USD", timeframe, open_time: bucket, close_time: bucket + seconds,
      open: Number(source[0].open), high: Math.max(...source.map(row => Number(row.high))),
      low: Math.min(...source.map(row => Number(row.low))), close: Number(source.at(-1).close), is_closed: true
    });
  }
  return output.sort((a, b) => a.open_time - b.open_time);
}
async function insertSetup(candidate) {
  const rows = await rest("amyfx_preview_scalper_setups?on_conflict=id", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ ...candidate, updated_at: new Date().toISOString() }) });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}
async function updateSetup(setup, expected) {
  if (!expected?.updated_at || !expected?.status) throw new Error(`optimistic_update_missing_state:${setup?.id || "unknown"}`);
  const expectedRevision = Number(expected.revision || 0);
  const params = new URLSearchParams({ id: `eq.${setup.id}`, engine_version: `eq.${ENGINE_VERSION}`, updated_at: `eq.${expected.updated_at}`, status: `eq.${expected.status}`, revision: `eq.${expectedRevision}` });
  const rows = await rest(`amyfx_preview_scalper_setups?${params.toString()}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ ...setup, revision: expectedRevision + 1, updated_at: new Date().toISOString() }) });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}
async function loadActiveSetups() {
  const statuses = NON_TERMINAL_STATUSES.join(",");
  const params = new URLSearchParams({ select: "*", engine_version: `eq.${ENGINE_VERSION}`, status: `in.(${statuses})`, order: "signal_candle_close_time.asc", limit: "200" });
  const rows = await rest(`amyfx_preview_scalper_setups?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}
async function insertEvent(setup, event, notificationEligible) {
  if (!event?.status) return false;
  const rows = await rest("amyfx_preview_scalper_events?on_conflict=setup_id,status", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ setup_id: setup.id, status: event.status, event_time: new Date().toISOString(), candle_time: event.candle_time || null, price: event.price ?? null, result_r: event.result_r ?? null, message: lifecycleMessage(setup, event.status), notification_eligible: Boolean(notificationEligible), payload: { engine_version: ENGINE_VERSION, model: setup.model, driver_id: setup.driver_id || setup.quality?.driver_id, driver_name: setup.driver_name || setup.quality?.driver_name, timeframe: setup.timeframe || setup.quality?.timeframe, direction: setup.direction, recommendation_status: setup.recommendation_status, bars_elapsed: setup.bars_elapsed } }) });
  return Array.isArray(rows) && rows.length > 0;
}
async function invokePush() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${PUSH_FUNCTION}`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: "{}" });
  const text = await response.text(); let payload;
  try { payload = JSON.parse(text); } catch (_) { payload = { raw: text.slice(0, 500) }; }
  return { ok: response.ok, status: response.status, payload };
}

Deno.serve(async (request) => {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "backend_not_configured" }, 503);
  const url = new URL(request.url);
  if (url.searchParams.get("health") === "1") return json({ ok: true, engine: ENGINE_VERSION, mode: "unified-shadow", candle_source: "supabase-central-read-only", active_driver_count: DRIVER_REGISTRY.length, max_active_recommendations: null, drivers: DRIVER_REGISTRY });

  const nowSeconds = Math.floor(Date.now() / 1000); let run = null;
  try {
    run = await acquireRun(nowSeconds);
    if (!run) return json({ ok: true, skipped: true, reason: "minute_already_processed", engine: ENGINE_VERSION });

    const [m15, h1, m1, previousRun] = await Promise.all([
      loadCandles("M15", 1200),
      loadCandles("H1", 800),
      loadCandles("M1", 2000),
      loadPreviousRun(run.run_bucket),
    ]);
    const latestM15 = m15.at(-1), latestH1 = h1.at(-1), latestM1 = m1.at(-1);
    if (!latestM15 || nowSeconds - Number(latestM15.close_time || 0) > STALE_M15_SECONDS || !latestH1 || nowSeconds - Number(latestH1.close_time || 0) > STALE_H1_SECONDS) {
      const payload = { ok: false, skipped: true, reason: "driver_source_data_stale", candle_source: "supabase-central-read-only", latest_m1_close_time: latestM1?.close_time || null, latest_m15_close_time: latestM15?.close_time || null, latest_h1_close_time: latestH1?.close_time || null };
      await finishRun(run.run_bucket, payload);
      return json(payload, 200);
    }

    const m30 = aggregateCandles(m15, 1800, "M30", 900), h4 = aggregateCandles(h1, 14400, "H4", 3600);
    const series = { M15: m15, M30: m30, H1: h1, H4: h4 };
    const previousM15 = Number(previousRun?.latest_m15_close_time || 0);
    const sourceChanged = previousM15 !== Number(latestM15.close_time || 0) || previousRun?.engine !== ENGINE_VERSION;
    const candidates = sourceChanged
      ? detectScalperCandidates({ series, h1, nowSeconds, maxSignalAgeSeconds: MAX_SIGNAL_AGE_SECONDS })
      : [];

    let inserted = 0, activated = 0, lifecycleEvents = 0;
    for (const candidate of candidates) {
      const freshEnough = nowSeconds - Number(candidate.signal_candle_close_time) <= NOTIFICATION_AGE_SECONDS;
      const created = await insertSetup({ ...candidate, notification_enabled: freshEnough });
      if (!created) continue;
      inserted++;
      if (await insertEvent(created, { status: "WAITING_NEXT_OPEN", price: null, candle_time: candidate.signal_candle_open_time, result_r: null }, created.notification_enabled === true)) lifecycleEvents++;
    }

    let active = await loadActiveSetups();
    for (const current of active) {
      let setup = current;
      if (["WAITING_NEXT_OPEN", "ENTRY_READY"].includes(setup.status)) {
        const nextOpen = findNextOpen(setup, { m1, m15 });
        if (nextOpen) {
          const activatedResult = activateCandidate(setup, nextOpen);
          const saved = await updateSetup(activatedResult.setup, setup);
          if (!saved) continue;
          setup = saved;
          if (activatedResult.event && await insertEvent(setup, activatedResult.event, setup.notification_enabled === true)) lifecycleEvents++;
          activated += setup.status === "ACTIVE" ? 1 : 0;
          continue;
        }
      }
      if (setup.status === "ACTIVE" || setup.status === "BE_ACTIVE") {
        if (setup.quality?.entry_locked !== true) {
          const locked = { ...setup, quality: { ...(setup.quality || {}), entry_locked: true, entry_locked_at: setup.entry_candle_open_time, entry_timestamp: setup.entry_candle_open_time, lifecycle_sequence: Number(setup.quality?.lifecycle_sequence || 0) } };
          await updateSetup(locked, setup);
          continue;
        }
        const advanced = advanceSetupLifecycle(setup, m1, { evaluationSeconds: 60 });
        const nextSetup = advanced.setup;
        if (advanced.events.length || nextSetup.last_evaluated_open_time !== current.last_evaluated_open_time) {
          const saved = await updateSetup(nextSetup, setup);
          if (!saved) continue;
          setup = saved;
        }
        for (const event of advanced.events) if (await insertEvent(setup, event, setup.notification_enabled === true)) lifecycleEvents++;
      }
    }

    active = await loadActiveSetups();
    const recommended = assignRecommendations(active);
    for (const setup of recommended) {
      const previous = active.find(item => item.id === setup.id);
      if (previous?.recommendation_status !== setup.recommendation_status) await updateSetup(setup, previous);
    }
    const push = lifecycleEvents > 0 ? await invokePush() : { ok: true, skipped: true };
    const payload = {
      ok: true,
      engine: ENGINE_VERSION,
      mode: "unified-shadow",
      candle_source: "supabase-central-read-only",
      provider_requests: 0,
      source_changed: sourceChanged,
      latest_m1_close_time: latestM1?.close_time || null,
      latest_m15_close_time: latestM15?.close_time || null,
      latest_h1_close_time: latestH1?.close_time || null,
      driver_count: DRIVER_REGISTRY.length,
      candles: { M1: m1.length, M15: m15.length, M30: m30.length, H1: h1.length, H4: h4.length },
      candidates: candidates.length,
      inserted,
      activated,
      lifecycle_events: lifecycleEvents,
      active_setups: recommended.length,
      recommended_active: recommended.filter(item => item.recommendation_status === "VALID").length,
      push,
    };
    await finishRun(run.run_bucket, payload);
    return json(payload, push.ok === false ? 207 : 200);
  } catch (error) {
    console.error("scalper-engine failed", error);
    if (run?.run_bucket != null) await finishRun(run.run_bucket, {}, error instanceof Error ? error.message : String(error)).catch(() => {});
    return json({ error: "scalper_engine_failed", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
});
