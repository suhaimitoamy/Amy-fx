import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Accept,Content-Type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: cors }); }
async function rest(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Accept: "application/json" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
const lifecycleSequence: Record<string, number> = {
  WAITING_NEXT_OPEN: 10,
  ACTIVE: 20,
  BE_ACTIVE: 30,
  TP_HIT: 100,
  SL_HIT: 100,
  BE_HIT: 100,
  TIME_EXIT: 100,
  INVALIDATED: 100,
  CANCELLED: 100,
};
function publicSetup(row) {
  const quality = row.quality && typeof row.quality === "object" ? row.quality : {};
  return {
    id: row.id, engineVersion: row.engine_version, model: row.model, symbol: row.symbol,
    direction: row.direction, status: row.status, recommendationStatus: row.recommendation_status,
    signalCandleOpenTime: row.signal_candle_open_time, signalCandleCloseTime: row.signal_candle_close_time,
    entryCandleOpenTime: row.entry_candle_open_time, entry: row.entry_price,
    stopLoss: row.stop_loss, initialStopLoss: row.initial_stop_loss,
    breakEvenTrigger: row.break_even_trigger, target: row.target_price, risk: row.risk,
    bufferAtr: row.buffer_atr, maxBars: row.max_bars, barsElapsed: row.bars_elapsed,
    htfBias: row.htf_bias, htfCandleCloseTime: row.htf_candle_close_time,
    zoneBottom: row.zone_bottom, zoneTop: row.zone_top, beArmed: row.be_armed,
    resultR: row.result_r, exitPrice: row.exit_price, exitTime: row.exit_time,
    priority: row.priority, updatedAt: row.updated_at, createdAt: row.created_at,
    lastEvaluatedOpenTime: row.last_evaluated_open_time,
    lifecycleSequence: Number(quality.lifecycle_sequence || lifecycleSequence[row.status] || 0),
    entryTimestamp: quality.entry_timestamp || row.entry_candle_open_time,
    sourceCandleTimestamp: quality.source_candle_timestamp || row.signal_candle_close_time,
    ...(quality.stop_basis_label ? { stopBasis: quality.stop_basis_label } : {}),
  };
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "backend_not_configured" }, 503);
  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") || "8", 10) || 8, 1), 20);
    const recentThreshold = Math.floor(Date.now() / 1000) - 6 * 60 * 60;
    const select = "id,engine_version,model,symbol,direction,status,recommendation_status,signal_candle_open_time,signal_candle_close_time,entry_candle_open_time,entry_price,initial_stop_loss,stop_loss,break_even_trigger,target_price,risk,buffer_atr,max_bars,bars_elapsed,last_evaluated_open_time,htf_bias,htf_candle_close_time,zone_bottom,zone_top,be_armed,result_r,exit_price,exit_time,priority,quality,created_at,updated_at";
    const [active, recent, lastRun] = await Promise.all([
      rest(`amyfx_preview_scalper_setups?select=${select}&status=in.(WAITING_NEXT_OPEN,ACTIVE,BE_ACTIVE)&order=priority.asc,signal_candle_close_time.asc&limit=${limit}`),
      rest(`amyfx_preview_scalper_setups?select=${select}&status=in.(TP_HIT,SL_HIT,BE_HIT,TIME_EXIT,INVALIDATED,CANCELLED)&signal_candle_close_time=gte.${recentThreshold}&order=exit_time.desc&limit=${limit}`),
      rest("amyfx_preview_scalper_runs?select=status,started_at,completed_at,result,error&order=run_bucket.desc&limit=1"),
    ]);
    const activeRows = Array.isArray(active) ? active : [];
    const recentRows = Array.isArray(recent) ? recent : [];
    const recommended = activeRows.filter(row => row.recommendation_status === "VALID");
    const primary = recommended[0] || activeRows[0] || recentRows[0] || null;
    return json({
      ok: true, mode: "shadow", generatedAt: new Date().toISOString(),
      primary: primary ? publicSetup(primary) : null,
      active: activeRows.map(publicSetup), recent: recentRows.map(publicSetup),
      limits: { recommendedActive: 2, riskUnits: 2 },
      engine: Array.isArray(lastRun) ? lastRun[0] || null : null,
    });
  } catch (error) {
    console.error("scalper-setups failed", error);
    return json({ error: "scalper_setups_failed", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
});
