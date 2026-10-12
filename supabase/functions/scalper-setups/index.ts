import { deviceScope } from '../_shared/scalper-device.mjs';
import {SIX_ENGINE_VERSION} from '../scalper-engine/six-drivers.mjs';
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Accept,Content-Type,x-amy-device-token",
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
const lifecycleSequence = {
  WAITING_TRIGGER: 5,
  WAITING_NEXT_OPEN: 10,
  ENTRY_READY: 15,
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
  const driverId = row.driver_id || quality.driver_id || row.model;
  const driverName = row.driver_name || quality.driver_name || (row.model === "IFVG_SCALPER" ? "IFVG Legacy" : row.model);
  const timeframe = row.timeframe || quality.timeframe || "M15";
  return {
    id: row.id,
    engineVersion: row.engine_version,
    schemaVersion: row.schema_version || quality.schema_version || 1,
    model: row.model,
    driverId,
    driverName,
    driverRuleVersion: row.driver_rule_version || quality.driver_rule_version || "legacy",
    timeframe,
    symbol: row.symbol,
    direction: row.direction,
    status: row.status,
    recommendationStatus: row.recommendation_status,
    signalCandleOpenTime: row.signal_candle_open_time,
    signalCandleCloseTime: row.signal_candle_close_time,
    entryCandleOpenTime: row.entry_candle_open_time,
    entry: row.entry_price,
    stopLoss: row.stop_loss,
    initialStopLoss: row.initial_stop_loss,
    tp1: row.break_even_trigger,
    breakEvenTrigger: row.break_even_trigger,
    tp2: row.target_price,
    target: row.target_price,
    risk: row.risk,
    bufferAtr: row.buffer_atr,
    maxBars: row.max_bars,
    maxHoldSeconds: Number(quality.max_hold_seconds || Number(row.max_bars || 4) * 900),
    barsElapsed: row.bars_elapsed,
    htfBias: row.htf_bias,
    htfCandleCloseTime: row.htf_candle_close_time,
    zoneBottom: row.zone_bottom,
    zoneTop: row.zone_top,
    beArmed: row.be_armed,
    tp1Hit: quality.tp1_hit === true,
    resultR: row.result_r,
    exitPrice: row.exit_price,
    exitTime: row.exit_time,
    priority: row.priority,
    priorityDisplay: row.priority_display ?? row.priority,
    revision: Number(row.revision || 0),
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    lastEvaluatedOpenTime: row.last_evaluated_open_time,
    lifecycleSequence: Number(quality.lifecycle_sequence || lifecycleSequence[row.status] || 0),
    entryTimestamp: quality.entry_timestamp || row.entry_candle_open_time,
    sourceCandleTimestamp: quality.source_candle_timestamp || row.signal_candle_close_time,
    reason: quality.reason || null,
    invalidationReason: quality.invalidation_reason || null,
    stopBasis: quality.stop_basis_label || null,
    targetModel: quality.lifecycle_policy === "DISCIPLINE_LIQUIDITY_V1" ? "LIQUIDITY" : "DEFAULT",
    entryModel: quality.entry_model || "NEXT_OPEN",
    patternGate: quality.pattern_gate || null,
    baseConfigVersion: quality.base_config_version || null,
    repairConfigVersion: quality.repair_config_version || null,
    amdConfigVersion: quality.amd_config_version || null,
    isLegacy: row.engine_version !== SIX_ENGINE_VERSION && (!row.driver_id || Number(row.schema_version || 1) < 3 || row.engine_version !== "amyfx-preview-scalper-pattern-v3.0"),
    qualityScore: quality.score ?? null,
    tradeManagement: quality.plan?.management ?? null,
    exitReason: quality.exit_reason ?? null,
    outcomeAmbiguous: quality.outcome_ambiguous === true,
    costsIncluded: quality.costs_included === true,
  };
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "backend_not_configured" }, 503);
  try {
    const scope=await deviceScope(request);
    const preferences=scope?await rest(`amyfx_scalper_device_preferences?device_scope=eq.${scope}&select=created_at,enabled_drivers&limit=1`):[];
    const sharedScope=scope?`&or=(device_scope.eq.${scope},and(device_scope.is.null,engine_version.eq.${SIX_ENGINE_VERSION}))`:'&device_scope=is.null';
    const enabledDrivers=preferences[0]?.enabled_drivers||{};
    const cutoff=preferences[0]?.created_at;
    const historyScope=scope&&cutoff?`&or=(device_scope.eq.${scope},and(device_scope.is.null,created_at.lt.${encodeURIComponent(cutoff)}),and(device_scope.is.null,engine_version.eq.${SIX_ENGINE_VERSION}))`:sharedScope;
    const url = new URL(request.url);
    const historyLimit = Math.min(Math.max(Number.parseInt(url.searchParams.get("history_limit") || "500", 10) || 500, 1), 2000);
    const includeAllHistory = url.searchParams.get("history") === "all";
    const setupId = String(url.searchParams.get("setup_id") || "").trim();
    const recentThreshold = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
    const select = "id,engine_version,schema_version,model,driver_id,driver_name,driver_rule_version,timeframe,symbol,direction,status,recommendation_status,signal_candle_open_time,signal_candle_close_time,entry_candle_open_time,entry_price,initial_stop_loss,stop_loss,break_even_trigger,target_price,risk,buffer_atr,max_bars,bars_elapsed,last_evaluated_open_time,htf_bias,htf_candle_close_time,zone_bottom,zone_top,be_armed,result_r,exit_price,exit_time,priority,priority_display,revision,quality,created_at,updated_at";
    const historyTimeFilter = includeAllHistory ? "" : `&signal_candle_close_time=gte.${recentThreshold}`;
    const selectedRequest = setupId
      ? rest(`amyfx_preview_scalper_setups?select=${select}${historyScope}&id=eq.${encodeURIComponent(setupId)}&limit=1`)
      : Promise.resolve([]);
    const [history, selectedRows, lastRun,activeRows] = await Promise.all([
      rest(`amyfx_preview_scalper_setups?select=${select}${historyScope}&status=in.(TP_HIT,SL_HIT,BE_HIT,TIME_EXIT,INVALIDATED,CANCELLED)${historyTimeFilter}&order=exit_time.desc&limit=${historyLimit}`),
      selectedRequest,
      rest("amyfx_preview_scalper_runs?select=status,started_at,completed_at,result,error&order=run_bucket.desc&limit=1"),
      rest(`amyfx_preview_scalper_setups?select=${select}${sharedScope}&engine_version=eq.${SIX_ENGINE_VERSION}&status=in.(WAITING_TRIGGER,WAITING_NEXT_OPEN,ACTIVE,BE_ACTIVE)&order=signal_candle_close_time.desc&limit=100`),
    ]);
    const historyRows = Array.isArray(history) ? history : [];
    const selectedRow = Array.isArray(selectedRows) ? selectedRows[0] || null : null;
    const run = Array.isArray(lastRun) ? lastRun[0] || null : null;
    const context = run?.status === 'COMPLETED' && run?.result?.engine === 'amyfx-gold-context-v1'
      ? run.result.context || null : null;
    const publicHistory = historyRows.map(publicSetup);
    const active=(activeRows||[]).filter(s=>enabledDrivers[s.driver_id]!==false).map(publicSetup);
    const evaluation=run?.status==='COMPLETED'&&run.result?.driverEvaluation?.version===SIX_ENGINE_VERSION?run.result.driverEvaluation:null;
    const driverEvaluation=evaluation?{...evaluation,drivers:evaluation.drivers.map(d=>enabledDrivers[d.id]===false?{...d,state:'DISABLED',reason:'Driver dinonaktifkan di perangkat ini.',setupId:null,lifecycleStatus:null,plan:null}:d)}:null;
    return json({
      ok: true,
      mode: "market_context",
      context,
      deviceScope: scope,
      generatedAt: new Date().toISOString(),
      primary: active.find(s=>s.status==='ACTIVE'||s.status==='BE_ACTIVE')||active[0]||null,
      driverEvaluation,
      enabledDrivers,
      selected: selectedRow ? publicSetup(selectedRow) : null,
      // Only the new driver engine can publish live plans; older rows remain archives.
      active,
      history: publicHistory,
      recent: publicHistory,
      historyCount: publicHistory.length,
      historyPermanent: includeAllHistory,
      limits: { recommendedActive: null, riskUnits: null, history: historyLimit },
      engine: run,
    });
  } catch (error) {
    console.error("scalper-setups failed", error);
    return json({ error: "scalper_setups_failed", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
});
