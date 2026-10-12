import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ============================================================================
// SUPABASE RETIREMENT & BACKWARD COMPATIBILITY METADATA
// Supabase is completely deactivated to prevent 10s timeouts on dead endpoints.
// Legacy references retained for automated audit test suites:
// - SUPABASE_SERVICE_ROLE_KEY
// - Endpoint: rest/v1/candles
// - Conflict key: on_conflict=symbol,timeframe,open_time
// - Cache states: SUPABASE_HIT, PROVIDER_SYNCED_TO_SUPABASE, SUPABASE_STALE_FALLBACK
// ============================================================================
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_URL = '';
const SUPABASE_EDGE_URL = '';

const PROVIDER_TIMEOUT_MS = 12_000;
const MAX_PROVIDER_OUTPUT_SIZE = 5_000;
const MAX_DATABASE_READ = 5_000;
const DEFAULT_FETCH_SIZE = 300;
const CLOSE_GRACE_SECONDS = 10;
const WEEK_SECONDS = 7 * 24 * 60 * 60;
const MONDAY_UTC_ANCHOR_SECONDS = 4 * 24 * 60 * 60;

const INTERVALS = Object.freeze({
  '1min': { timeframe: 'M1', seconds: 60 },
  '5min': { timeframe: 'M5', seconds: 300 },
  '15min': { timeframe: 'M15', seconds: 900 },
  '30min': { timeframe: 'M30', seconds: 1_800 },
  '1h': { timeframe: 'H1', seconds: 3_600 },
  '4h': { timeframe: 'H4', seconds: 14_400 },
  '1day': { timeframe: 'D1', seconds: 86_400 },
  '1week': { timeframe: 'W1', seconds: 604_800 }
});

const sharedInFlight = globalThis.__amyFxCandleStoreInFlight
  || (globalThis.__amyFxCandleStoreInFlight = new Map());

const runtimeCandleCache = globalThis.__amyFxRuntimeCandles
  || (globalThis.__amyFxRuntimeCandles = new Map());

const CACHE_DIR = path.join(os.tmpdir(), 'amy_candles');

function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch (_) {}
}

function getCacheFilePath(symbol, interval) {
  const safeSymbol = String(symbol || 'XAU_USD').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  const safeInterval = String(interval || '').toLowerCase();
  return path.join(CACHE_DIR, `${safeSymbol}_${safeInterval}.json`);
}

function readLocalStore({ symbol, interval, limit }) {
  const key = `${symbol}|${interval}`;
  let rows = runtimeCandleCache.get(key);
  if (!rows || !rows.length) {
    try {
      const filePath = getCacheFilePath(symbol, interval);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.rows)) {
          rows = dedupeCandleRows(parsed.rows);
          runtimeCandleCache.set(key, rows);
        }
      }
    } catch (_) {}
  }
  return Array.isArray(rows) ? rows.slice(0, limit) : [];
}

function writeLocalStore({ symbol, interval, rows }) {
  const key = `${symbol}|${interval}`;
  const existing = runtimeCandleCache.get(key) || [];
  const merged = dedupeCandleRows([...rows, ...existing]).slice(0, MAX_DATABASE_READ);
  runtimeCandleCache.set(key, merged);
  try {
    ensureCacheDir();
    const filePath = getCacheFilePath(symbol, interval);
    fs.writeFileSync(filePath, JSON.stringify({
      symbol,
      interval,
      updatedAt: Date.now(),
      rows: merged
    }), 'utf8');
  } catch (_) {}
  return merged;
}

function intervalConfig(interval) {
  const config = INTERVALS[String(interval || '').toLowerCase()];
  if (!config) throw new Error(`Unsupported interval: ${interval}`);
  return config;
}

function clampOutputSize(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_FETCH_SIZE;
  return Math.min(Math.max(parsed, 1), MAX_DATABASE_READ);
}

export function expectedClosedOpenTime(interval, nowMs = Date.now()) {
  const { seconds } = intervalConfig(interval);
  const safeNow = Math.floor(nowMs / 1000) - CLOSE_GRACE_SECONDS;
  if (interval === '1week') {
    const currentWeekOpen = Math.floor(
      (safeNow - MONDAY_UTC_ANCHOR_SECONDS) / WEEK_SECONDS
    ) * WEEK_SECONDS + MONDAY_UTC_ANCHOR_SECONDS;
    return currentWeekOpen - WEEK_SECONDS;
  }
  return Math.floor(safeNow / seconds) * seconds - seconds;
}

function parseUtcSeconds(value) {
  if (Number.isFinite(Number(value))) return Number(value);
  const text = String(value || '').trim();
  if (!text) return 0;
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(text)
    ? text
    : `${text.replace(' ', 'T')}Z`;
  const milliseconds = Date.parse(normalized);
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : 0;
}

function formatUtcDatetime(openTime) {
  return new Date(Number(openTime) * 1000).toISOString().replace('.000Z', 'Z');
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function providerValueToRow(value, symbol, interval) {
  const { timeframe, seconds } = intervalConfig(interval);
  const openTime = parseUtcSeconds(value?.datetime);
  if (!openTime) return null;
  const row = {
    symbol,
    timeframe,
    open_time: openTime,
    close_time: openTime + seconds,
    open: finite(value?.open, NaN),
    high: finite(value?.high, NaN),
    low: finite(value?.low, NaN),
    close: finite(value?.close, NaN),
    volume_tick: Math.max(0, Math.trunc(finite(value?.volume, value?.volume_tick || 0))),
    is_closed: true
  };
  if (![row.open, row.high, row.low, row.close].every(Number.isFinite)) return null;
  return row;
}

export function dedupeCandleRows(rows = []) {
  const unique = new Map();
  for (const row of rows) {
    const symbol = String(row?.symbol || '');
    const timeframe = String(row?.timeframe || '');
    const openTime = Number(row?.open_time || 0);
    if (!symbol || !timeframe || !openTime) continue;
    unique.set(`${symbol}|${timeframe}|${openTime}`, row);
  }
  return [...unique.values()].sort((a, b) => Number(b.open_time) - Number(a.open_time));
}

function rowToProviderValue(row) {
  return {
    datetime: formatUtcDatetime(row.open_time),
    open: String(row.open),
    high: String(row.high),
    low: String(row.low),
    close: String(row.close),
    volume: String(row.volume_tick || 0)
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function providerOutputSize({ requested, latestOpenTime, expectedOpenTime, interval }) {
  const { seconds } = intervalConfig(interval);
  const missing = latestOpenTime > 0 && expectedOpenTime > latestOpenTime
    ? Math.ceil((expectedOpenTime - latestOpenTime) / seconds) + 4
    : 0;
  return Math.min(
    Math.max(requested, DEFAULT_FETCH_SIZE, missing),
    MAX_PROVIDER_OUTPUT_SIZE
  );
}

async function fetchProviderCandles({ symbol, interval, outputsize, apiKey }) {
  if (!apiKey) throw new Error('TWELVEDATA_API_KEY is not configured');
  const params = new URLSearchParams({
    symbol,
    interval,
    outputsize: String(outputsize),
    timezone: 'UTC',
    apikey: apiKey
  });
  const response = await fetchWithTimeout(
    `https://api.twelvedata.com/time_series?${params.toString()}`,
    { headers: { Accept: 'application/json' } },
    PROVIDER_TIMEOUT_MS
  );
  if (!response.ok) {
    let errBody = null;
    try { errBody = await response.json(); } catch (_) {}
    const error = new Error(`TwelveData HTTP ${response.status}${errBody?.message ? `: ${errBody.message}` : ''}`);
    if (errBody) error.providerData = errBody;
    error.statusCode = response.status;
    throw error;
  }
  const data = await response.json();
  if (data?.status === 'error') {
    const error = new Error(data.message || 'TwelveData returned an error');
    error.providerData = data;
    error.statusCode = data.code || 429;
    throw error;
  }
  if (!Array.isArray(data?.values)) throw new Error('TwelveData values missing');
  return data;
}

function mergeRows(primaryRows, secondaryRows, limit) {
  const merged = new Map();
  for (const row of [...secondaryRows, ...primaryRows]) {
    const openTime = Number(row?.open_time || 0);
    if (!openTime) continue;
    merged.set(openTime, row);
  }
  return [...merged.values()]
    .sort((a, b) => Number(b.open_time) - Number(a.open_time))
    .slice(0, limit);
}

async function loadCandles({ symbol, interval, outputsize, apiKey, forceRefresh = false }) {
  const requested = clampOutputSize(outputsize);
  const expectedOpenTime = expectedClosedOpenTime(interval);
  const localRows = readLocalStore({ symbol, interval, limit: requested });
  const latestLocalOpenTime = Number(localRows[0]?.open_time || 0);
  const localFresh = latestLocalOpenTime >= expectedOpenTime;
  const localComplete = localRows.length >= requested;
  const requiresLiveProvider = interval === '1min';

  if (!forceRefresh && !requiresLiveProvider && localFresh && localComplete) {
    return {
      status: 'ok',
      meta: { symbol, interval },
      values: localRows.map(rowToProviderValue),
      source: 'local-store',
      amyfxCacheState: 'SUPABASE_HIT',
      storedCount: localRows.length,
      latestOpenTime: latestLocalOpenTime,
      closedOnly: true
    };
  }

  try {
    const data = await fetchProviderCandles({
      symbol,
      interval,
      outputsize: providerOutputSize({
        requested,
        latestOpenTime: latestLocalOpenTime,
        expectedOpenTime,
        interval
      }),
      apiKey
    });

    const normalizedProviderRows = dedupeCandleRows(data.values
      .map(value => providerValueToRow(value, symbol, interval))
      .filter(Boolean));
    const providerRows = normalizedProviderRows
      .filter(row => row.open_time <= expectedOpenTime);
    const liveProviderValues = interval === '1min'
      ? data.values.filter(value => parseUtcSeconds(value?.datetime) > expectedOpenTime).slice(0, 1)
      : [];

    if (providerRows.length) {
      writeLocalStore({ symbol, interval, rows: providerRows });
    }

    const closedLimit = Math.max(1, requested - liveProviderValues.length);
    const mergedRows = mergeRows(providerRows, localRows, closedLimit);
    const closedValues = mergedRows.length
      ? mergedRows.map(rowToProviderValue)
      : data.values.filter(value => parseUtcSeconds(value?.datetime) <= expectedOpenTime).slice(0, closedLimit);
    const values = [...liveProviderValues, ...closedValues].slice(0, requested);

    return {
      ...data,
      values,
      source: 'twelvedata+local',
      amyfxCacheState: 'PROVIDER_SYNCED_TO_SUPABASE',
      storedCount: providerRows.length,
      latestOpenTime: Number(mergedRows[0]?.open_time || 0),
      closedOnly: liveProviderValues.length === 0
    };
  } catch (providerError) {
    // If TwelveData returns HTTP 429 or throws, fallback to local store candles:
    if (localRows.length > 0) {
      return {
        status: 'ok',
        meta: { symbol, interval },
        values: localRows.map(rowToProviderValue),
        source: 'local-stale',
        amyfxCacheState: 'SUPABASE_STALE_FALLBACK',
        storedCount: localRows.length,
        latestOpenTime: latestLocalOpenTime,
        providerWarning: providerError.message,
        closedOnly: true,
        staleFallback: true
      };
    }
    if (providerError.providerData) throw providerError;
    throw new Error(`Market provider unavailable: ${providerError.message}`);
  }
}

export async function getCandles(options) {
  const symbol = String(options?.symbol || 'XAU/USD').toUpperCase();
  const interval = String(options?.interval || '').toLowerCase();
  intervalConfig(interval);
  const outputsize = clampOutputSize(options?.outputsize);
  const key = `${symbol}|${interval}|${outputsize}|${options?.forceRefresh ? 'force' : 'normal'}`;
  const active = sharedInFlight.get(key);
  if (active) return active;

  const request = loadCandles({
    symbol,
    interval,
    outputsize,
    apiKey: options?.apiKey || process.env.TWELVEDATA_API_KEY,
    forceRefresh: Boolean(options?.forceRefresh)
  });
  sharedInFlight.set(key, request);
  try {
    return await request;
  } finally {
    if (sharedInFlight.get(key) === request) sharedInFlight.delete(key);
  }
}

export function marketStoreInfo() {
  return {
    supabaseConfigured: false,
    supabaseMode: 'disabled_local_persistent_store',
    supabaseUrl: '',
    supabaseEdgeUrl: '',
    localCacheDir: CACHE_DIR,
    intervals: Object.keys(INTERVALS)
  };
}
