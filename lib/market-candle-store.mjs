const SUPABASE_URL = String(
  process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://wliecyxzlwhmtftnfnps.supabase.co'
).replace(/\/$/, '');

const SUPABASE_SERVICE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.SUPABASE_SECRET_KEY
  || ''
);

const PROVIDER_TIMEOUT_MS = 12_000;
const SUPABASE_TIMEOUT_MS = 10_000;
const MAX_PROVIDER_OUTPUT_SIZE = 5_000;
const MAX_DATABASE_READ = 5_000;
const DEFAULT_FETCH_SIZE = 300;
const CLOSE_GRACE_SECONDS = 10;

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

function expectedClosedOpenTime(interval, nowMs = Date.now()) {
  const { seconds } = intervalConfig(interval);
  const safeNow = Math.floor(nowMs / 1000) - CLOSE_GRACE_SECONDS;
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

async function fetchWithTimeout(url, options = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    Accept: 'application/json',
    ...extra
  };
}

async function readSupabaseCandles({ symbol, interval, limit }) {
  if (!supabaseConfigured()) return [];
  const { timeframe } = intervalConfig(interval);
  const params = new URLSearchParams({
    select: 'symbol,timeframe,open_time,close_time,open,high,low,close,volume_tick,is_closed',
    symbol: `eq.${symbol}`,
    timeframe: `eq.${timeframe}`,
    is_closed: 'eq.true',
    order: 'open_time.desc',
    limit: String(Math.min(Math.max(limit, 1), MAX_DATABASE_READ))
  });
  const response = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/candles?${params.toString()}`,
    { headers: supabaseHeaders() },
    SUPABASE_TIMEOUT_MS
  );
  if (!response.ok) throw new Error(`Supabase candle read HTTP ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function upsertSupabaseCandles(rows) {
  if (!supabaseConfigured() || !rows.length) return false;
  const response = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/candles?on_conflict=symbol,timeframe,open_time`,
    {
      method: 'POST',
      headers: supabaseHeaders({
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      }),
      body: JSON.stringify(rows)
    },
    SUPABASE_TIMEOUT_MS
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase candle upsert HTTP ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`);
  }
  return true;
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
  if (!response.ok) throw new Error(`TwelveData HTTP ${response.status}`);
  const data = await response.json();
  if (data?.status === 'error') {
    const error = new Error(data.message || 'TwelveData returned an error');
    error.providerData = data;
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
  let databaseRows = [];
  let databaseError = null;

  try {
    databaseRows = await readSupabaseCandles({ symbol, interval, limit: requested });
  } catch (error) {
    databaseError = error;
  }

  const latestDatabaseOpenTime = Number(databaseRows[0]?.open_time || 0);
  const databaseFresh = latestDatabaseOpenTime >= expectedOpenTime;
  const databaseComplete = databaseRows.length >= requested;
  const requiresLiveProvider = interval === '1min';

  if (!forceRefresh && !requiresLiveProvider && databaseFresh && databaseComplete) {
    return {
      status: 'ok',
      meta: { symbol, interval },
      values: databaseRows.map(rowToProviderValue),
      source: 'supabase',
      amyfxCacheState: 'SUPABASE_HIT',
      storedCount: databaseRows.length,
      latestOpenTime: latestDatabaseOpenTime,
      closedOnly: true
    };
  }

  try {
    const data = await fetchProviderCandles({
      symbol,
      interval,
      outputsize: providerOutputSize({
        requested,
        latestOpenTime: latestDatabaseOpenTime,
        expectedOpenTime,
        interval
      }),
      apiKey
    });

    const normalizedProviderRows = data.values
      .map(value => providerValueToRow(value, symbol, interval))
      .filter(Boolean);
    const providerRows = normalizedProviderRows
      .filter(row => row.open_time <= expectedOpenTime);
    const liveProviderValues = interval === '1min'
      ? data.values.filter(value => parseUtcSeconds(value?.datetime) > expectedOpenTime).slice(0, 1)
      : [];

    let stored = false;
    if (providerRows.length) {
      try {
        stored = await upsertSupabaseCandles(providerRows);
      } catch (error) {
        databaseError = databaseError || error;
      }
    }

    const closedLimit = Math.max(1, requested - liveProviderValues.length);
    const mergedRows = mergeRows(providerRows, databaseRows, closedLimit);
    const closedValues = mergedRows.length
      ? mergedRows.map(rowToProviderValue)
      : data.values.filter(value => parseUtcSeconds(value?.datetime) <= expectedOpenTime).slice(0, closedLimit);
    const values = [...liveProviderValues, ...closedValues].slice(0, requested);

    return {
      ...data,
      values,
      source: stored ? 'twelvedata+supabase' : 'twelvedata',
      amyfxCacheState: stored ? 'PROVIDER_SYNCED_TO_SUPABASE' : 'PROVIDER_DIRECT',
      storedCount: providerRows.length,
      latestOpenTime: Number(mergedRows[0]?.open_time || 0),
      storageWarning: databaseError?.message || undefined,
      closedOnly: liveProviderValues.length === 0
    };
  } catch (providerError) {
    if (databaseRows.length) {
      return {
        status: 'ok',
        meta: { symbol, interval },
        values: databaseRows.map(rowToProviderValue),
        source: 'supabase-stale',
        amyfxCacheState: 'SUPABASE_STALE_FALLBACK',
        storedCount: databaseRows.length,
        latestOpenTime: latestDatabaseOpenTime,
        providerWarning: providerError.message,
        storageWarning: databaseError?.message || undefined,
        closedOnly: true
      };
    }
    if (providerError.providerData) throw providerError;
    const message = databaseError
      ? `${providerError.message}; ${databaseError.message}`
      : providerError.message;
    throw new Error(message);
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
    supabaseConfigured: supabaseConfigured(),
    supabaseUrl: SUPABASE_URL,
    intervals: Object.keys(INTERVALS)
  };
}
