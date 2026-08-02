#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  ENGINE_VERSION,
  DRIVER_REGISTRY,
  BASE_CONFIG_VERSION,
  REPAIR_CONFIG_VERSION,
  AMD_CONFIG_VERSION,
  DEFAULT_PATTERN_CONFIG,
  evaluateScalperCandidates,
  findNextOpen,
  resolveTriggerEntry,
  activateCandidate,
  advanceSetupLifecycle,
} from '../../supabase/functions/scalper-engine/engine.mjs';

const ROOT = path.resolve('backtest_output');
const DATA = path.join(ROOT, 'data', 'XAUUSD_M1_DUKASCOPY_BID_2025-05-01_2025-07-01.csv');
const AUDIT = path.join(ROOT, 'data', 'DATA_AUDIT.json');
const SIGNAL_START = Date.parse('2025-06-01T00:00:00Z') / 1000;
const SIGNAL_END = Date.parse('2025-07-01T00:00:00Z') / 1000;
const OUTCOME_END = Date.parse('2025-07-02T00:00:00Z') / 1000;
const WITA_OFFSET = 8 * 3600;
const TF_SECONDS = { M15: 900, M30: 1800, H1: 3600, H4: 14400 };

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map(line => {
    const values = line.split(',');
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    return {
      open_time: Number(row.open_time), close_time: Number(row.close_time),
      open: Number(row.open), high: Number(row.high), low: Number(row.low), close: Number(row.close),
      volume: Number(row.volume), is_closed: true,
    };
  });
}

function aggregate(rows, seconds, timeframe) {
  const buckets = new Map();
  for (const row of rows) {
    const bucket = Math.floor(row.open_time / seconds) * seconds;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push(row);
  }
  const expected = seconds / 60;
  const output = [];
  for (const [bucket, input] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    input.sort((a, b) => a.open_time - b.open_time);
    const complete = input.length === expected
      && input[0].open_time === bucket
      && input.at(-1).close_time === bucket + seconds
      && input.every((row, index) => row.open_time === bucket + index * 60);
    if (!complete) continue;
    output.push({
      symbol: 'XAU/USD', timeframe, open_time: bucket, close_time: bucket + seconds,
      open: input[0].open, high: Math.max(...input.map(row => row.high)),
      low: Math.min(...input.map(row => row.low)), close: input.at(-1).close, is_closed: true,
    });
  }
  return output;
}

function iso(seconds) {
  return Number.isFinite(Number(seconds)) ? new Date(Number(seconds) * 1000).toISOString() : '';
}

function wita(seconds) {
  return Number.isFinite(Number(seconds))
    ? new Date((Number(seconds) + WITA_OFFSET) * 1000).toISOString().replace('Z', '+08:00')
    : '';
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(file, headers, rows) {
  const output = [headers.join(',')];
  for (const row of rows) output.push(headers.map(header => csvCell(row[header])).join(','));
  fs.writeFileSync(file, `${output.join('\n')}\n`);
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percent(part, total) { return total ? (part / total) * 100 : 0; }
function sum(values) { return values.reduce((total, value) => total + Number(value || 0), 0); }
function average(values) { return values.length ? sum(values) / values.length : null; }
function signedPoints(row) {
  if (!Number.isFinite(row.entry_price) || !Number.isFinite(row.exit_price)) return 0;
  return row.direction === 'BUY' ? row.exit_price - row.entry_price : row.entry_price - row.exit_price;
}

fs.mkdirSync(ROOT, { recursive: true });
const dataAudit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const m1All = parseCsv(fs.readFileSync(DATA, 'utf8'));
const detectionM1 = m1All.filter(row => row.close_time <= SIGNAL_END);
const series = Object.fromEntries(
  Object.entries(TF_SECONDS).map(([timeframe, seconds]) => [timeframe, aggregate(detectionM1, seconds, timeframe)])
);

const evaluation = evaluateScalperCandidates({
  series,
  h1: series.H1,
  nowSeconds: SIGNAL_END,
  maxSignalAgeSeconds: SIGNAL_END - SIGNAL_START + 900,
  config: DEFAULT_PATTERN_CONFIG,
});
const telemetryJune = evaluation.telemetry.filter(item =>
  Number(item?.signal_candle_close_time) >= SIGNAL_START && Number(item?.signal_candle_close_time) < SIGNAL_END
);
const candidates = evaluation.candidates
  .filter(item => Number(item.signal_candle_close_time) >= SIGNAL_START && Number(item.signal_candle_close_time) < SIGNAL_END)
  .sort((a, b) => Number(a.signal_candle_close_time) - Number(b.signal_candle_close_time) || Number(a.priority) - Number(b.priority));

const lookaheadChecks = new Map();
for (const candidate of candidates) {
  const cutoff = Number(candidate.signal_candle_close_time);
  const replaySeries = Object.fromEntries(
    Object.entries(series).map(([timeframe, rows]) => [timeframe, rows.filter(row => row.close_time <= cutoff)])
  );
  const replay = evaluateScalperCandidates({
    series: replaySeries,
    h1: replaySeries.H1,
    nowSeconds: cutoff,
    maxSignalAgeSeconds: 900,
    config: DEFAULT_PATTERN_CONFIG,
  });
  lookaheadChecks.set(candidate.id, replay.candidates.some(item => item.id === candidate.id));
}

const rows = [];
for (const original of candidates) {
  let setup = {
    ...original,
    quality: { ...(original.quality || {}) },
    created_at: Number(original.signal_candle_close_time) + 1,
  };
  const events = [];
  let entryResolution = null;
  if (setup.status === 'WAITING_TRIGGER') {
    const trigger = resolveTriggerEntry(setup, { m1: m1All, nowSeconds: OUTCOME_END });
    setup = trigger.setup;
    if (trigger.event) events.push(trigger.event);
    if (trigger.nextOpen) entryResolution = trigger.nextOpen;
  } else if (['WAITING_NEXT_OPEN', 'ENTRY_READY'].includes(setup.status)) {
    entryResolution = findNextOpen(setup, { m1: m1All, m15: series.M15 });
  }
  if (entryResolution) {
    const activated = activateCandidate(setup, entryResolution);
    setup = activated.setup;
    if (activated.event) events.push(activated.event);
  }
  if (['ACTIVE', 'BE_ACTIVE'].includes(setup.status)) {
    const advanced = advanceSetupLifecycle(setup, m1All, { evaluationSeconds: 60 });
    setup = advanced.setup;
    events.push(...advanced.events);
  }

  const entryTime = safeNumber(setup.entry_candle_open_time);
  const enteredInJune = entryTime != null && entryTime >= SIGNAL_START && entryTime < SIGNAL_END;
  const row = {
    candidate_id: setup.id,
    driver_id: setup.driver_id,
    driver_name: setup.driver_name,
    timeframe: setup.timeframe,
    direction: setup.direction,
    signal_time_wita: wita(setup.signal_candle_close_time),
    pattern_gate: setup.quality?.pattern_gate || '',
    entry_time_wita: wita(entryTime),
    entry_price: safeNumber(setup.entry_price),
    stop_loss: safeNumber(setup.initial_stop_loss),
    tp1: safeNumber(setup.break_even_trigger),
    tp2: safeNumber(setup.target_price),
    risk_points: safeNumber(setup.risk),
    tp1_hit: setup.quality?.tp1_hit === true,
    final_status: String(setup.status || 'UNKNOWN'),
    exit_time_wita: wita(setup.exit_time),
    exit_price: safeNumber(setup.exit_price),
    result_r: safeNumber(setup.result_r),
    invalidation_reason: setup.quality?.invalidation_reason || '',
    entry_source: setup.quality?.entry_source || entryResolution?.source || '',
    scored: enteredInJune,
    lookahead_verified: lookaheadChecks.get(setup.id) === true,
    event_sequence: events.map(event => event.status).join(' > '),
  };
  row.realized_points = signedPoints(row);
  row.tp1_only_points = row.tp1_hit ? 10 : row.realized_points;
  rows.push(row);
}

const scored = rows.filter(row => row.scored === true);
const tp1Hits = scored.filter(row => row.tp1_hit).length;
const tp2Hits = scored.filter(row => row.final_status === 'TP_HIT').length;
const slHits = scored.filter(row => row.final_status === 'SL_HIT').length;
const timeExits = scored.filter(row => row.final_status === 'TIME_EXIT').length;
const riskValues = scored.filter(row => Number.isFinite(row.risk_points)).map(row => row.risk_points);
const summary = {
  title: 'Amy FX Preview Scalper Engine Backtest — June 2025',
  generated_at: new Date().toISOString(),
  app_version: '2.0.0-preview.298',
  app_version_code: 940298,
  branch_source: 'personal/amyfx-private',
  engine_version: ENGINE_VERSION,
  config: {
    base_version: BASE_CONFIG_VERSION,
    repair_version: REPAIR_CONFIG_VERSION,
    amd_version: AMD_CONFIG_VERSION,
    lifecycle: DEFAULT_PATTERN_CONFIG.lifecycle,
  },
  data_audit: dataAudit,
  accepted_signals: rows.length,
  june_entries: scored.length,
  tp1_hits: tp1Hits,
  tp1_accuracy_pct: percent(tp1Hits, scored.length),
  tp2_hits: tp2Hits,
  tp2_accuracy_pct: percent(tp2Hits, scored.length),
  sl_hits: slHits,
  time_exits: timeExits,
  average_sl_points: average(riskValues),
  minimum_sl_points: riskValues.length ? Math.min(...riskValues) : null,
  maximum_sl_points: riskValues.length ? Math.max(...riskValues) : null,
  full_lifecycle_net_points: sum(scored.map(row => row.realized_points)),
  tp1_only_net_points: sum(scored.map(row => row.tp1_only_points)),
  lookahead_verified: rows.filter(row => row.lookahead_verified).length,
  lookahead_mismatches: rows.filter(row => !row.lookahead_verified).length,
  rejected_candidates: telemetryJune.filter(item => item?.accepted === false).length,
  cancelled_or_invalid_before_entry: rows.filter(row => !row.scored && ['CANCELLED', 'INVALIDATED'].includes(row.final_status)).length,
  driver_entries: Object.fromEntries(DRIVER_REGISTRY.map(driver => [driver.id, scored.filter(row => row.driver_id === driver.id).length])),
};

fs.writeFileSync(path.join(ROOT, 'AMYFX_SCALPER_JUNE_2025_SUMMARY.json'), JSON.stringify(summary, null, 2));
writeCsv(path.join(ROOT, 'AMYFX_SCALPER_JUNE_2025_TRADES.csv'), Object.keys(rows[0] || { candidate_id: '' }), rows);
console.log(JSON.stringify(summary, null, 2));
