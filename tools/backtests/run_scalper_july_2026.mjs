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
const DATA = path.join(ROOT, 'data', 'XAUUSD_M1_DUKASCOPY_BID_2026-06-01_2026-08-01.csv');
const AUDIT = path.join(ROOT, 'data', 'DATA_AUDIT.json');
const SIGNAL_START = Date.parse('2026-07-01T00:00:00Z') / 1000;
const SIGNAL_END = Date.parse('2026-08-01T00:00:00Z') / 1000;
const OUTCOME_END = Date.parse('2026-08-02T00:00:00Z') / 1000;
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
  return Number.isFinite(Number(seconds)) ? new Date((Number(seconds) + WITA_OFFSET) * 1000).toISOString().replace('Z', '+08:00') : '';
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

function sum(values) { return values.reduce((total, value) => total + Number(value || 0), 0); }
function average(values) { return values.length ? sum(values) / values.length : null; }
function percent(part, total) { return total ? (part / total) * 100 : null; }
function fixed(value, digits = 2) { return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—'; }

function drawdown(results) {
  let equity = 0;
  let peak = 0;
  let maximum = 0;
  let maximumStart = null;
  let maximumEnd = null;
  let peakTime = null;
  for (const item of results) {
    const value = Number(item.result_r);
    if (!Number.isFinite(value)) continue;
    equity += value;
    if (equity > peak) {
      peak = equity;
      peakTime = item.exit_time;
    }
    const current = peak - equity;
    if (current > maximum) {
      maximum = current;
      maximumStart = peakTime;
      maximumEnd = item.exit_time;
    }
  }
  return { maximum_r: maximum, start_time: maximumStart, end_time: maximumEnd, ending_equity_r: equity };
}

function scoreRows(rows) {
  const closed = rows.filter(row => ['TP_HIT', 'SL_HIT', 'TIME_EXIT', 'BE_HIT'].includes(row.final_status));
  const results = closed.filter(row => Number.isFinite(Number(row.result_r)));
  const positive = results.filter(row => Number(row.result_r) > 0);
  const negative = results.filter(row => Number(row.result_r) < 0);
  const tp = closed.filter(row => row.final_status === 'TP_HIT').length;
  const sl = closed.filter(row => row.final_status === 'SL_HIT').length;
  const timeExit = closed.filter(row => row.final_status === 'TIME_EXIT').length;
  const grossProfit = sum(positive.map(row => row.result_r));
  const grossLoss = Math.abs(sum(negative.map(row => row.result_r)));
  return {
    closed_trades: closed.length,
    tp2_hits: tp,
    sl_hits: sl,
    time_exits: timeExit,
    tp1_hits: rows.filter(row => row.tp1_hit === true).length,
    tp2_win_rate_pct: percent(tp, closed.length),
    positive_r_rate_pct: percent(positive.length, results.length),
    average_r: average(results.map(row => row.result_r)),
    median_r: results.length ? [...results].map(row => Number(row.result_r)).sort((a, b) => a - b)[Math.floor(results.length / 2)] : null,
    total_r: sum(results.map(row => row.result_r)),
    profit_factor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? null : 0),
    gross_profit_r: grossProfit,
    gross_loss_r: grossLoss,
    ...drawdown([...results].sort((a, b) => Number(a.exit_time) - Number(b.exit_time))),
  };
}

fs.mkdirSync(ROOT, { recursive: true });
const dataAudit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const m1All = parseCsv(fs.readFileSync(DATA, 'utf8'));
const detectionM1 = m1All.filter(row => row.close_time <= SIGNAL_END);
const series = Object.fromEntries(Object.entries(TF_SECONDS).map(([timeframe, seconds]) => [timeframe, aggregate(detectionM1, seconds, timeframe)]));
const evaluation = evaluateScalperCandidates({
  series,
  h1: series.H1,
  nowSeconds: SIGNAL_END,
  maxSignalAgeSeconds: SIGNAL_END - SIGNAL_START + 900,
  config: DEFAULT_PATTERN_CONFIG,
});
const telemetryJuly = evaluation.telemetry.filter(item => Number(item?.signal_candle_close_time) >= SIGNAL_START && Number(item?.signal_candle_close_time) < SIGNAL_END);
const candidates = evaluation.candidates
  .filter(item => Number(item.signal_candle_close_time) >= SIGNAL_START && Number(item.signal_candle_close_time) < SIGNAL_END)
  .sort((a, b) => Number(a.signal_candle_close_time) - Number(b.signal_candle_close_time) || Number(a.priority) - Number(b.priority));

const lookaheadChecks = new Map();
for (const candidate of candidates) {
  const cutoff = Number(candidate.signal_candle_close_time);
  const replaySeries = Object.fromEntries(Object.entries(series).map(([timeframe, rows]) => [timeframe, rows.filter(row => row.close_time <= cutoff)]));
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
  let setup = { ...original, quality: { ...(original.quality || {}) }, created_at: Number(original.signal_candle_close_time) + 1 };
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
  const signalTime = Number(setup.signal_candle_close_time);
  const enteredInJuly = entryTime != null && entryTime >= SIGNAL_START && entryTime < SIGNAL_END;
  const signalOnlyCarryover = entryTime != null && entryTime >= SIGNAL_END;
  const finalStatus = String(setup.status || 'UNKNOWN');
  rows.push({
    candidate_id: setup.id,
    engine_version: setup.engine_version,
    driver_id: setup.driver_id,
    driver_name: setup.driver_name,
    driver_rule_version: setup.driver_rule_version,
    timeframe: setup.timeframe,
    direction: setup.direction,
    signal_time: signalTime,
    signal_time_utc: iso(signalTime),
    signal_time_wita: wita(signalTime),
    pattern_gate: setup.quality?.pattern_gate || '',
    htf_bias: setup.htf_bias || '',
    zone_bottom: safeNumber(setup.zone_bottom),
    zone_top: safeNumber(setup.zone_top),
    entry_time: entryTime,
    entry_time_utc: iso(entryTime),
    entry_time_wita: wita(entryTime),
    entry_price: safeNumber(setup.entry_price),
    stop_loss: safeNumber(setup.initial_stop_loss),
    tp1: safeNumber(setup.break_even_trigger),
    tp2: safeNumber(setup.target_price),
    risk_points: safeNumber(setup.risk),
    tp1_hit: setup.quality?.tp1_hit === true,
    final_status: finalStatus,
    exit_time: safeNumber(setup.exit_time),
    exit_time_utc: iso(setup.exit_time),
    exit_time_wita: wita(setup.exit_time),
    exit_price: safeNumber(setup.exit_price),
    result_r: safeNumber(setup.result_r),
    invalidation_reason: setup.quality?.invalidation_reason || '',
    entry_source: setup.quality?.entry_source || entryResolution?.source || '',
    entered_in_july: enteredInJuly,
    carryover_entry_august: signalOnlyCarryover,
    scored: enteredInJuly,
    lookahead_verified: lookaheadChecks.get(setup.id) === true,
    event_sequence: events.map(event => event.status).join(' > '),
  });
}

const scored = rows.filter(row => row.scored === true);
const carryover = rows.filter(row => row.scored !== true);
const score = scoreRows(scored);
const driverSummary = DRIVER_REGISTRY.map(driver => {
  const accepted = rows.filter(row => row.driver_id === driver.id);
  const trades = scored.filter(row => row.driver_id === driver.id);
  const metrics = scoreRows(trades);
  return {
    driver_id: driver.id,
    driver_name: driver.name,
    official_timeframes: driver.timeframes.join('|'),
    accepted_signals: accepted.length,
    july_entries: trades.length,
    tp1_hits: metrics.tp1_hits,
    tp2_hits: metrics.tp2_hits,
    sl_hits: metrics.sl_hits,
    time_exits: metrics.time_exits,
    average_r: metrics.average_r,
    total_r: metrics.total_r,
    tp2_win_rate_pct: metrics.tp2_win_rate_pct,
    carryover_or_no_entry: accepted.length - trades.length,
  };
}).filter(item => item.accepted_signals > 0 || item.july_entries > 0);

const timeframeSummary = [...new Set(rows.map(row => row.timeframe))].sort().map(timeframe => {
  const accepted = rows.filter(row => row.timeframe === timeframe);
  const trades = scored.filter(row => row.timeframe === timeframe);
  const metrics = scoreRows(trades);
  return {
    timeframe,
    accepted_signals: accepted.length,
    july_entries: trades.length,
    tp2_hits: metrics.tp2_hits,
    sl_hits: metrics.sl_hits,
    time_exits: metrics.time_exits,
    tp2_win_rate_pct: metrics.tp2_win_rate_pct,
    average_r: metrics.average_r,
    total_r: metrics.total_r,
  };
});

const rejectionMap = new Map();
for (const item of telemetryJuly.filter(entry => entry?.accepted === false)) {
  const gate = String(item.gate_id || 'UNKNOWN');
  const current = rejectionMap.get(gate) || { gate_id: gate, rejected: 0, failed_conditions: new Map() };
  current.rejected += 1;
  for (const condition of item.failed_conditions || []) current.failed_conditions.set(condition, (current.failed_conditions.get(condition) || 0) + 1);
  rejectionMap.set(gate, current);
}
const rejectionSummary = [...rejectionMap.values()].map(item => ({
  gate_id: item.gate_id,
  rejected: item.rejected,
  top_failed_conditions: [...item.failed_conditions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([condition, count]) => `${condition} (${count})`).join(' | '),
})).sort((a, b) => b.rejected - a.rejected);

const dailyMap = new Map();
for (const trade of scored) {
  const day = trade.entry_time_wita.slice(0, 10);
  if (!dailyMap.has(day)) dailyMap.set(day, []);
  dailyMap.get(day).push(trade);
}
const dailySummary = [...dailyMap.entries()].map(([date_wita, trades]) => ({ date_wita, trades: trades.length, ...scoreRows(trades) }));

const summary = {
  title: 'Amy FX Preview Scalper Engine Backtest — July 2026',
  generated_at: new Date().toISOString(),
  app_version: '2.0.0-preview.298',
  app_version_code: 940298,
  branch_source: 'personal/amyfx-private',
  engine_version: ENGINE_VERSION,
  schema_version: 3,
  config: {
    base_version: BASE_CONFIG_VERSION,
    repair_version: REPAIR_CONFIG_VERSION,
    amd_version: AMD_CONFIG_VERSION,
    lifecycle: DEFAULT_PATTERN_CONFIG.lifecycle,
  },
  scope: {
    signal_period_utc: ['2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z'],
    warmup_start_utc: '2026-06-01T00:00:00Z',
    lifecycle_data_end_utc: '2026-08-02T00:00:00Z',
    performance_cohort: 'Accepted July signals that entered before 2026-08-01T00:00:00Z',
    carryover_policy: 'Signals entering in August or not entering are reported but excluded from July performance metrics',
  },
  data_audit: dataAudit,
  aggregate_counts: Object.fromEntries(Object.entries(series).map(([key, value]) => [key, value.length])),
  candidate_audit: {
    raw_july_candidates: telemetryJuly.length,
    accepted_july_signals: rows.length,
    rejected_july_candidates: telemetryJuly.filter(item => item?.accepted === false).length,
    lookahead_verified: rows.filter(row => row.lookahead_verified).length,
    lookahead_mismatches: rows.filter(row => !row.lookahead_verified).length,
  },
  july_performance: score,
  carryover: {
    total: carryover.length,
    entered_august: carryover.filter(row => row.carryover_entry_august).length,
    cancelled_or_invalid_before_entry: carryover.filter(row => ['CANCELLED', 'INVALIDATED'].includes(row.final_status)).length,
    waiting_or_unresolved: carryover.filter(row => !['CANCELLED', 'INVALIDATED', 'TP_HIT', 'SL_HIT', 'TIME_EXIT', 'BE_HIT'].includes(row.final_status)).length,
  },
  driver_summary: driverSummary,
  timeframe_summary: timeframeSummary,
  rejection_summary: rejectionSummary,
  daily_summary: dailySummary,
};

fs.writeFileSync(path.join(ROOT, 'AMYFX_SCALPER_JULY_2026_SUMMARY.json'), JSON.stringify(summary, null, 2));
writeCsv(path.join(ROOT, 'AMYFX_SCALPER_JULY_2026_TRADES.csv'), Object.keys(rows[0] || { candidate_id: '' }), rows);
writeCsv(path.join(ROOT, 'AMYFX_SCALPER_JULY_2026_DRIVER_SUMMARY.csv'), Object.keys(driverSummary[0] || { driver_id: '' }), driverSummary);
writeCsv(path.join(ROOT, 'AMYFX_SCALPER_JULY_2026_TIMEFRAME_SUMMARY.csv'), Object.keys(timeframeSummary[0] || { timeframe: '' }), timeframeSummary);
writeCsv(path.join(ROOT, 'AMYFX_SCALPER_JULY_2026_REJECTIONS.csv'), Object.keys(rejectionSummary[0] || { gate_id: '' }), rejectionSummary);
writeCsv(path.join(ROOT, 'AMYFX_SCALPER_JULY_2026_DAILY.csv'), Object.keys(dailySummary[0] || { date_wita: '' }), dailySummary);

const report = `# Amy FX Preview — Scalper Engine Backtest Juli 2026\n\n` +
`## Identitas\n\n- Branch sumber: \`personal/amyfx-private\`\n- Versi aplikasi: \`2.0.0-preview.298\` (\`940298\`)\n- Engine: \`${ENGINE_VERSION}\`\n- Konfigurasi: \`${BASE_CONFIG_VERSION}\` + \`${REPAIR_CONFIG_VERSION}\` + \`${AMD_CONFIG_VERSION}\`\n- Mode: replay historis closed-candle, Shadow Mode, tanpa perubahan rule.\n\n` +
`## Data\n\n- Provider: Dukascopy Bank SA, XAUUSD BID, UTC.\n- Warm-up: 1–30 Juni 2026.\n- Sinyal yang dinilai: candle sinyal close pada Juli 2026.\n- Penyelesaian lifecycle: data sampai 1 Agustus 2026 23:59 UTC.\n- Semua candle provider dipertahankan; tidak ada interpolasi, forward-fill, smoothing, atau penghapusan berdasarkan bentuk candle.\n- M1: ${dataAudit.rows_after_dedup} candle; M15: ${series.M15.length}; M30: ${series.M30.length}; H1: ${series.H1.length}; H4: ${series.H4.length}.\n\n` +
`## Audit anti-future-candle\n\n- Kandidat diterima Juli: ${rows.length}.\n- Kandidat yang muncul kembali saat engine dijalankan hanya sampai candle sinyalnya: ${summary.candidate_audit.lookahead_verified}.\n- Ketidaksesuaian anti-lookahead: ${summary.candidate_audit.lookahead_mismatches}.\n\n` +
`## Hasil utama — entry pada Juli\n\n- Setup masuk posisi: ${scored.length}.\n- TP2: ${score.tp2_hits}.\n- SL: ${score.sl_hits}.\n- Time Exit: ${score.time_exits}.\n- TP1 tersentuh: ${score.tp1_hits}.\n- Win rate TP2: ${fixed(score.tp2_win_rate_pct)}%.\n- Positive-R rate: ${fixed(score.positive_r_rate_pct)}%.\n- Rata-rata hasil: ${fixed(score.average_r)}R.\n- Total hasil: ${fixed(score.total_r)}R.\n- Profit factor: ${fixed(score.profit_factor)}.\n- Maximum drawdown: ${fixed(score.maximum_r)}R.\n\n` +
`## Carryover\n\n- Sinyal Juli yang tidak masuk cohort performa Juli: ${carryover.length}.\n- Entry baru terjadi pada Agustus: ${summary.carryover.entered_august}.\n- Batal/invalid sebelum entry: ${summary.carryover.cancelled_or_invalid_before_entry}.\n- Masih menunggu/tidak terselesaikan dalam jendela data: ${summary.carryover.waiting_or_unresolved}.\n\n` +
`## Catatan metodologi\n\n- Target BT6 tetap +10 poin (TP1) dan +20 poin (TP2).\n- Stop memakai invalidasi struktural + buffer ATR dan ditolak bila risiko melebihi 50 poin.\n- Stop tidak dipindahkan ke breakeven.\n- Bila SL dan target tersentuh dalam candle M1 yang sama, SL dinilai lebih dahulu.\n- Setup yang entry pada Agustus tidak dimasukkan ke statistik performa Juli agar batas bulan tidak bias.\n`;
fs.writeFileSync(path.join(ROOT, 'AMYFX_SCALPER_JULY_2026_REPORT.md'), report);
console.log(JSON.stringify({ accepted_signals: rows.length, july_entries: scored.length, ...score, lookahead_mismatches: summary.candidate_audit.lookahead_mismatches }, null, 2));
