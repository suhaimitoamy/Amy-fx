const ALLOWED_INTERVALS = new Set([
  '1min', '5min', '15min', '30min', '1h', '4h', '1day', '1week'
]);
const MAX_OUTPUT_SIZE = 500;
const FETCH_TIMEOUT_MS = 12_000;
const MEMORY_CACHE_LIMIT = 40;

const CACHE_TTL_SECONDS = Object.freeze({
  '1min': 55,
  '5min': 240,
  '15min': 600,
  '30min': 900,
  '1h': 1800,
  '4h': 7200,
  '1day': 14400,
  '1week': 43200
});

const memoryCache = globalThis.__amyFxTwelveDataCache
  || (globalThis.__amyFxTwelveDataCache = new Map());
const inFlight = globalThis.__amyFxTwelveDataInFlight
  || (globalThis.__amyFxTwelveDataInFlight = new Map());

function normalizeUtcDatetime(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00Z`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) {
    return `${text.replace(' ', 'T')}Z`;
  }
  return text;
}

function parseOutputSize(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return 300;
  return Math.min(Math.max(parsed, 1), MAX_OUTPUT_SIZE);
}

function ttlSeconds(interval) {
  return CACHE_TTL_SECONDS[interval] || 300;
}

function cacheKey(symbol, interval, outputsize) {
  return `${symbol}|${interval}|${outputsize}`;
}

function cloneData(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function readCache(key, { allowStale = false } = {}) {
  const item = memoryCache.get(key);
  if (!item) return null;
  const now = Date.now();
  if (!allowStale && item.expiresAt <= now) return null;
  if (allowStale && item.staleUntil <= now) {
    memoryCache.delete(key);
    return null;
  }
  return cloneData(item.data);
}

function writeCache(key, data, ttl) {
  const now = Date.now();
  memoryCache.set(key, {
    data: cloneData(data),
    storedAt: now,
    expiresAt: now + ttl * 1000,
    staleUntil: now + Math.max(ttl * 10, 900) * 1000
  });

  if (memoryCache.size <= MEMORY_CACHE_LIMIT) return;
  [...memoryCache.entries()]
    .sort((a, b) => a[1].storedAt - b[1].storedAt)
    .slice(0, memoryCache.size - 30)
    .forEach(([entryKey]) => memoryCache.delete(entryKey));
}

function setCacheHeaders(res, ttl, state = 'MISS') {
  const staleSeconds = Math.max(ttl * 4, 300);
  res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${staleSeconds}, stale-if-error=${staleSeconds}`);
  res.setHeader('CDN-Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${staleSeconds}, stale-if-error=${staleSeconds}`);
  res.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${staleSeconds}, stale-if-error=${staleSeconds}`);
  res.setHeader('X-AmyFX-Market-Cache', state);
}

async function fetchFromProvider({ symbol, interval, outputsize, apiKey }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const fetchUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${outputsize}&timezone=UTC&apikey=${encodeURIComponent(apiKey)}`;
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      const error = new Error(`TwelveData HTTP ${response.status}`);
      error.statusCode = 502;
      throw error;
    }

    const data = await response.json();
    if (data?.status === 'error') {
      const error = new Error(data.message || 'TwelveData returned an error');
      error.statusCode = 502;
      error.providerData = data;
      throw error;
    }

    if (Array.isArray(data?.values)) {
      data.values = data.values.map(item => ({
        ...item,
        datetime: normalizeUtcDatetime(item.datetime)
      }));
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const { symbol = 'XAU/USD', interval, outputsize = '300' } = req.query;
  const targetKey = process.env.TWELVEDATA_API_KEY;

  if (symbol !== 'XAU/USD') {
    return res.status(403).json({ status: 'error', message: 'Hanya XAU/USD yang diizinkan' });
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    return res.status(400).json({ status: 'error', message: 'Interval tidak didukung' });
  }
  if (!targetKey) {
    return res.status(503).json({ status: 'error', message: 'Market service belum dikonfigurasi' });
  }

  const safeOutputSize = parseOutputSize(outputsize);
  const ttl = ttlSeconds(interval);
  const key = cacheKey(symbol, interval, safeOutputSize);
  const fresh = readCache(key);
  if (fresh) {
    setCacheHeaders(res, ttl, 'MEMORY_HIT');
    return res.status(200).json(fresh);
  }

  let request = inFlight.get(key);
  if (!request) {
    request = fetchFromProvider({
      symbol,
      interval,
      outputsize: safeOutputSize,
      apiKey: targetKey
    });
    inFlight.set(key, request);
  }

  try {
    const data = await request;
    writeCache(key, data, ttl);
    setCacheHeaders(res, ttl, 'PROVIDER_MISS');
    return res.status(200).json(data);
  } catch (error) {
    const stale = readCache(key, { allowStale: true });
    if (stale) {
      setCacheHeaders(res, Math.min(ttl, 60), 'STALE_FALLBACK');
      return res.status(200).json({
        ...stale,
        amyfxCacheState: 'STALE_FALLBACK'
      });
    }

    if (error?.name === 'AbortError') {
      return res.status(504).json({ status: 'error', message: 'Market service timeout' });
    }
    if (error?.providerData) return res.status(error.statusCode || 502).json(error.providerData);
    return res.status(error?.statusCode || 502).json({
      status: 'error',
      message: error?.message || 'Market service unavailable'
    });
  } finally {
    if (inFlight.get(key) === request) inFlight.delete(key);
  }
}
