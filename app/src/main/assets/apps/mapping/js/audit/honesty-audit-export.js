const DB_NAME = 'amyfx-honesty-audit-v1';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots';
const ANOMALY_STORE = 'anomalies';
const MAX_MEMORY_ROWS = 500;
const POLL_MS = 750;
const TIMEFRAME_MS = Object.freeze({
  M1: 60_000,
  M5: 5 * 60_000,
  M15: 15 * 60_000,
  M30: 30 * 60_000,
  H1: 60 * 60_000,
  H4: 4 * 60 * 60_000,
  D1: 24 * 60 * 60_000,
  W1: 7 * 24 * 60 * 60_000
});

let databasePromise = null;
let lastFingerprint = '';
let repairInFlight = false;
const memorySnapshots = [];
const memoryAnomalies = [];

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function upper(value) {
  return String(value || '').trim().toUpperCase();
}

function clampScore(value) {
  const number = finite(value, 0);
  return Math.max(0, Math.min(100, Math.round(number)));
}

function isoFromValue(value) {
  const numeric = Number(value);
  let date = null;
  if (Number.isFinite(numeric) && numeric > 0) {
    date = new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
  } else if (value) {
    date = new Date(String(value));
  }
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function latestClosedTime(tf, candles) {
  const latest = Array.isArray(candles) ? candles.at(-1) : null;
  const openMs = finite(latest?.time, 0) * 1000;
  if (!openMs) return null;
  return new Date(openMs + (TIMEFRAME_MS[tf] || TIMEFRAME_MS.M15)).toISOString();
}

function forecastScore(result) {
  const forecast = result?.validatedMarketContext?.directionForecast
    || result?.validatedDirectionForecast
    || null;
  if (!forecast) return 0;
  return clampScore(forecast.confidenceScore ?? forecast.confidence ?? forecast.score ?? 0);
}

function replaceForecastPercent(text, score) {
  if (typeof text !== 'string' || !text) return text;
  const safeScore = clampScore(score);
  return text
    .replace(/VALIDATED FORECAST\s*\(\s*\d+(?:\.\d+)?\s*%\s*\)/gi, `VALIDATED FORECAST · SCORE ${safeScore}/100`)
    .replace(/Direction Forecast tervalidasi\s+([A-Z]+)\s*\(\s*\d+(?:\.\d+)?\s*%\s*\)/gi, `Direction Forecast tervalidasi $1 · SCORE ${safeScore}/100`)
    .replace(/\bvalidated\s+\d+(?:\.\d+)?\s*%/gi, `validated score ${safeScore}/100`);
}

function repairResultLabels(result) {
  if (!result || typeof result !== 'object') return false;
  const score = forecastScore(result);
  let changed = false;
  const forecast = result?.validatedMarketContext?.directionForecast || result?.validatedDirectionForecast;
  if (forecast && forecast.confidenceScore !== score) {
    forecast.confidenceScore = score;
    changed = true;
  }

  const targets = [
    [result, 'statusText'],
    [result?.directionDecision, 'status'],
    [result?.mappingExplanation, 'reason'],
    [result?.mappingExplanation, 'headline'],
    [result?.mappingExplanation, 'marketContext']
  ];
  for (const [object, key] of targets) {
    if (!object || typeof object[key] !== 'string') continue;
    const repaired = replaceForecastPercent(object[key], score);
    if (repaired !== object[key]) {
      object[key] = repaired;
      changed = true;
    }
  }

  const state = window.state;
  if (state && Array.isArray(state.logs)) {
    state.logs = state.logs.map(line => replaceForecastPercent(line, score));
  }
  return changed;
}

function setupGeometryIssue(execution) {
  const direction = upper(execution?.direction);
  if (direction !== 'BUY' && direction !== 'SELL') return null;
  const entryLow = finite(execution?.entryLow);
  const entryHigh = finite(execution?.entryHigh);
  const stopLoss = finite(execution?.stopLoss ?? execution?.sl);
  const target1 = finite(execution?.target1 ?? execution?.tp1);
  const target2 = finite(execution?.target2 ?? execution?.tp2);
  const singleTarget = Boolean(execution?.singleTarget ?? target2 == null);

  if ([entryLow, entryHigh, stopLoss, target1].some(value => value == null)) {
    return { code: 'SETUP_GEOMETRY_MISSING', message: 'Setup BUY/SELL tidak memiliki angka entry, SL, atau target yang lengkap.' };
  }
  if (entryLow > entryHigh) {
    return { code: 'ENTRY_RANGE_REVERSED', message: 'entryLow lebih tinggi daripada entryHigh.' };
  }
  if (direction === 'BUY') {
    if (stopLoss >= entryLow) return { code: 'BUY_STOP_INVALID', message: 'SL BUY harus berada di bawah entryLow.' };
    if (target1 <= entryHigh) return { code: 'BUY_TARGET_INVALID', message: 'Target BUY harus berada di atas entryHigh.' };
    if (!singleTarget && (target2 == null || target2 < target1)) return { code: 'BUY_TARGET2_INVALID', message: 'Target 2 BUY harus sama atau lebih tinggi dari Target 1.' };
  } else {
    if (stopLoss <= entryHigh) return { code: 'SELL_STOP_INVALID', message: 'SL SELL harus berada di atas entryHigh.' };
    if (target1 >= entryLow) return { code: 'SELL_TARGET_INVALID', message: 'Target SELL harus berada di bawah entryLow.' };
    if (!singleTarget && (target2 == null || target2 > target1)) return { code: 'SELL_TARGET2_INVALID', message: 'Target 2 SELL harus sama atau lebih rendah dari Target 1.' };
  }
  return null;
}

function buildSnapshot(reason = 'automatic') {
  const state = window.state;
  const result = state?.result;
  if (!state || !result) return null;
  repairResultLabels(result);

  const tf = upper(result.tf || state.tf || 'M15');
  const decision = result.directionDecision || {};
  const validated = result.validatedMarketContext || {};
  const forecast = validated.directionForecast || result.validatedDirectionForecast || {};
  const marketState = validated.marketState || result.validatedMarketState || {};
  const execution = result.setupExecution || {};
  const sourceCandles = {};
  for (const [sourceTf, candles] of Object.entries(state.candles || {})) {
    const closeTime = latestClosedTime(upper(sourceTf), candles);
    if (closeTime) sourceCandles[upper(sourceTf)] = closeTime;
  }

  const sourceCandleTime = sourceCandles[tf] || null;
  const capturedAt = new Date().toISOString();
  const score = forecastScore(result);

  return {
    schema: 'amyfx.honesty.snapshot.v1',
    engine: 'Amy FX Mapping',
    branch: 'personal/amyfx-private',
    reason,
    sourceMode: 'LIVE_RUNTIME',
    historicalReplay: false,
    capturedAt,
    analyzedAt: isoFromValue(result.analyzedAt) || capturedAt,
    timeframe: tf,
    sourceCandleTime,
    sourceCandles,
    price: finite(state.price || result.price),
    dataStale: Boolean(result.dataStale),
    directionDecision: {
      bias: upper(decision.bias),
      signal: upper(decision.signal),
      source: upper(decision.source),
      status: replaceForecastPercent(decision.status || '', score),
      invalidated: Boolean(decision.invalidated),
      invalidationReason: decision.invalidationReason || ''
    },
    directionForecast: {
      active: Boolean(forecast.active),
      invalidated: Boolean(forecast.invalidated),
      expired: Boolean(forecast.expired),
      direction: upper(forecast.direction),
      directionValue: finite(forecast.directionValue, 0),
      confidenceScore: score,
      startTime: isoFromValue(forecast.startTime),
      invalidationReason: forecast.invalidationReason || ''
    },
    marketState: {
      state: upper(marketState.state),
      structureTrend: upper(marketState.structureTrend)
    },
    setupExecution: {
      active: Boolean(execution.active),
      terminal: Boolean(execution.terminal),
      setupId: execution.setupId || '',
      direction: upper(execution.direction),
      status: execution.status || '',
      lifecycleStage: upper(execution.lifecycleStage),
      entryLow: finite(execution.entryLow),
      entryHigh: finite(execution.entryHigh),
      stopLoss: finite(execution.stopLoss),
      target1: finite(execution.target1),
      target2: finite(execution.target2),
      singleTarget: Boolean(execution.singleTarget),
      entryTouched: Boolean(execution.entryTouched),
      target1Secured: Boolean(execution.target1Secured),
      alignedWithForecast: Boolean(execution.alignedWithForecast),
      geometryValid: Boolean(execution.geometryValid),
      invalidated: Boolean(execution.invalidated),
      invalidationReason: execution.invalidationReason || ''
    },
    observations: {
      rawBias: upper(result.st?.trend || result.rawBias),
      rawStructure: upper(result.marketConcepts?.structure || result.structure),
      fvgCount: Array.isArray(result.marketConcepts?.nearestFairValueGaps) ? result.marketConcepts.nearestFairValueGaps.length : 0,
      orderBlockCount: Array.isArray(result.marketConcepts?.nearestOrderBlocks) ? result.marketConcepts.nearestOrderBlocks.length : 0,
      bsl: finite(result.bsl),
      ssl: finite(result.ssl),
      score: finite(result.score)
    },
    claims: [
      { kind: 'raw_bias', label: 'OBSERVATION ONLY' },
      { kind: 'raw_structure', label: 'OBSERVATION ONLY' },
      { kind: 'raw_fvg', label: 'OBSERVATION ONLY' },
      { kind: 'raw_order_block', label: 'OBSERVATION ONLY' },
      { kind: 'raw_bsl_ssl', label: 'OBSERVATION ONLY' },
      { kind: 'engine_score', label: 'SCORE, NOT PROBABILITY' }
    ]
  };
}

function auditSnapshot(snapshot) {
  if (!snapshot) return [];
  const issues = [];
  const add = (code, severity, message, details = null) => issues.push({
    schema: 'amyfx.honesty.anomaly.v1',
    code,
    severity,
    message,
    timestamp: snapshot.sourceCandleTime || snapshot.capturedAt,
    timeframe: snapshot.timeframe,
    details,
    snapshotFingerprint: fingerprint(snapshot)
  });

  const decision = snapshot.directionDecision || {};
  const forecast = snapshot.directionForecast || {};
  const execution = snapshot.setupExecution || {};
  const signal = upper(decision.signal);

  if (snapshot.dataStale && signal && signal !== 'WAIT' && signal !== 'DATA USANG') {
    add('STALE_DATA_DIRECTION', 'critical', 'Data usang menghasilkan arah selain WAIT.', { signal });
  }
  if (snapshot.dataStale && execution.active) {
    add('STALE_DATA_ACTIVE_SETUP', 'critical', 'Data usang masih meninggalkan setup aktif.');
  }
  if ((!forecast.active || forecast.invalidated || forecast.expired) && execution.active) {
    add('INACTIVE_FORECAST_ACTIVE_SETUP', 'critical', 'Forecast tidak aktif/terminal tetapi setup masih aktif.');
  }
  if (execution.terminal && execution.active) {
    add('TERMINAL_SETUP_ACTIVE', 'critical', 'Setup terminal juga ditandai aktif.');
  }

  const geometry = setupGeometryIssue(execution);
  if (geometry && (execution.active || ['BUY', 'SELL'].includes(upper(execution.direction)))) {
    add(geometry.code, 'critical', geometry.message);
  }

  const now = Date.now();
  for (const [sourceTf, value] of Object.entries(snapshot.sourceCandles || {})) {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp) && timestamp > now + 1000) {
      add('FUTURE_SOURCE_CANDLE', 'critical', 'Snapshot memakai candle dari masa depan.', { sourceTf, value });
    }
    if (snapshot.historicalReplay && Number.isFinite(timestamp) && new Date(timestamp).getUTCFullYear() === 2026) {
      add('REJECTED_YEAR_DATA', 'critical', 'Arsip historis 2026 yang ditolak masuk ke replay.', { sourceTf, value });
    }
  }

  const strings = [decision.status, execution.status, execution.invalidationReason];
  if (strings.some(value => /(?:VALIDATED\s+FORECAST|Direction\s+Forecast)[^\n]{0,100}?\d+(?:\.\d+)?\s*%/i.test(String(value || '')))) {
    add('SCORE_PRESENTED_AS_PROBABILITY', 'error', 'Score forecast ditampilkan sebagai persentase tanpa kalibrasi probabilitas.');
  }
  return issues;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(snapshot) {
  const focus = {
    timeframe: snapshot?.timeframe,
    sourceCandleTime: snapshot?.sourceCandleTime,
    dataStale: snapshot?.dataStale,
    directionDecision: snapshot?.directionDecision,
    directionForecast: snapshot?.directionForecast,
    setupExecution: snapshot?.setupExecution
  };
  let hash = 2166136261;
  const text = stable(focus);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  if (!('indexedDB' in window)) return Promise.resolve(null);
  databasePromise = new Promise(resolve => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        const store = db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('capturedAt', 'capturedAt');
        store.createIndex('sourceCandleTime', 'sourceCandleTime');
      }
      if (!db.objectStoreNames.contains(ANOMALY_STORE)) {
        const store = db.createObjectStore(ANOMALY_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('code', 'code');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return databasePromise;
}

async function storeRows(storeName, rows) {
  if (!rows.length) return;
  const db = await openDatabase();
  if (!db) return;
  await new Promise(resolve => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    rows.forEach(row => store.add(row));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

async function readRows(storeName) {
  const db = await openDatabase();
  if (!db) return storeName === SNAPSHOT_STORE ? [...memorySnapshots] : [...memoryAnomalies];
  return new Promise(resolve => {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

async function clearRows() {
  memorySnapshots.length = 0;
  memoryAnomalies.length = 0;
  const db = await openDatabase();
  if (!db) return;
  await new Promise(resolve => {
    const transaction = db.transaction([SNAPSHOT_STORE, ANOMALY_STORE], 'readwrite');
    transaction.objectStore(SNAPSHOT_STORE).clear();
    transaction.objectStore(ANOMALY_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

async function capture(reason = 'manual') {
  const snapshot = buildSnapshot(reason);
  if (!snapshot) return null;
  const currentFingerprint = fingerprint(snapshot);
  if (reason !== 'manual' && currentFingerprint === lastFingerprint) return snapshot;
  lastFingerprint = currentFingerprint;
  snapshot.fingerprint = currentFingerprint;
  const anomalies = auditSnapshot(snapshot);

  memorySnapshots.push(snapshot);
  if (memorySnapshots.length > MAX_MEMORY_ROWS) memorySnapshots.splice(0, memorySnapshots.length - MAX_MEMORY_ROWS);
  memoryAnomalies.push(...anomalies);
  if (memoryAnomalies.length > MAX_MEMORY_ROWS) memoryAnomalies.splice(0, memoryAnomalies.length - MAX_MEMORY_ROWS);
  await storeRows(SNAPSHOT_STORE, [snapshot]);
  await storeRows(ANOMALY_STORE, anomalies);

  window.dispatchEvent(new CustomEvent('amyfx:honesty-audit-snapshot', { detail: { snapshot, anomalies } }));
  if (anomalies.length) {
    console.error('Amy FX honesty anomaly', anomalies, snapshot);
    window.dispatchEvent(new CustomEvent('amyfx:honesty-audit-anomaly', { detail: { snapshot, anomalies } }));
  }
  return snapshot;
}

async function exportJsonl(kind = 'snapshots') {
  const storeName = kind === 'anomalies' ? ANOMALY_STORE : SNAPSHOT_STORE;
  const rows = await readRows(storeName);
  const text = rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
  const blob = new Blob([text], { type: 'application/x-ndjson;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `amyfx-${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return rows.length;
}

function scheduleRepairAndCapture(reason = 'automatic') {
  if (repairInFlight) return;
  repairInFlight = true;
  queueMicrotask(async () => {
    try {
      const result = window.state?.result;
      const changed = repairResultLabels(result);
      if (changed) {
        try { window.save?.(); } catch (_) {}
        try { window.render?.(); } catch (_) {}
      }
      await capture(reason);
    } finally {
      repairInFlight = false;
    }
  });
}

function boot() {
  setInterval(() => scheduleRepairAndCapture('automatic'), POLL_MS);
  window.addEventListener('amyfx:candles-updated', () => setTimeout(() => scheduleRepairAndCapture('candles-updated'), 100));
  window.addEventListener('amyfx:market-update', () => scheduleRepairAndCapture('market-update'));
  window.addEventListener('amyfx:entry-watch-updated', () => scheduleRepairAndCapture('entry-watch-updated'));
  window.addEventListener('focus', () => scheduleRepairAndCapture('focus'));
  scheduleRepairAndCapture('startup');
}

if (typeof window !== 'undefined') {
  window.AmyFXHonestyAudit = Object.freeze({
    version: '1.0.0',
    branch: 'personal/amyfx-private',
    snapshot: reason => capture(reason || 'manual'),
    auditSnapshot,
    buildSnapshot,
    exportJsonl,
    exportSnapshots: () => exportJsonl('snapshots'),
    exportAnomalies: () => exportJsonl('anomalies'),
    getSnapshots: () => readRows(SNAPSHOT_STORE),
    getAnomalies: () => readRows(ANOMALY_STORE),
    clear: clearRows,
    repairResultLabels
  });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }
}
