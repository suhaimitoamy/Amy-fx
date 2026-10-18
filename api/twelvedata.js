import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCandles, marketStoreInfo } from '../lib/market-candle-store.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_PATH = path.join(__dirname, '../lib/market-snapshot-offline.json');

function readSnapshotFallback(symbol, interval, limit = 300) {
  try {
    if (fs.existsSync(SNAPSHOT_PATH)) {
      const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      const safeSymbol = String(symbol || 'XAU_USD').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
      const safeInterval = String(interval || '').toLowerCase();
      const rows = parsed?.snapshots?.[`${safeSymbol}_${safeInterval}`];
      if (Array.isArray(rows) && rows.length) {
        const values = rows.slice(0, limit).map(row => ({
          datetime: new Date(Number(row.open_time) * 1000).toISOString().replace('.000Z', 'Z'),
          open: String(row.open),
          high: String(row.high),
          low: String(row.low),
          close: String(row.close),
          volume: String(row.volume_tick || 0)
        }));
        return {
          status: 'ok',
          meta: { symbol, interval },
          values,
          source: 'offline-snapshot',
          amyfxCacheState: 'STALE_FALLBACK',
          closedOnly: true
        };
      }
    }
  } catch (_) {}
  return null;
}

const ALLOWED_INTERVALS = new Set([
  '1min', '5min', '15min', '30min', '1h', '4h', '1day', '1week'
]);
const MAX_OUTPUT_SIZE = 5_000;
const MEMORY_CACHE_LIMIT = 40;
const SHARED_M1_OUTPUT_SIZE = 300;

export const CACHE_TTL_SECONDS = Object.freeze({
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

function parseOutputSize(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return 300;
  return Math.min(Math.max(parsed, 1), MAX_OUTPUT_SIZE);
}

function ttlSeconds(interval) {
  const duration = { '1min': 60, '5min': 300, '15min': 900, '30min': 1800,
    '1h': 3600, '4h': 14400, '1day': 86400, '1week': 604800 }[interval] || 60;
  const now = Date.now() / 1000;
  const nextClose = (Math.floor((now - 10) / duration) + 1) * duration + 10;
  return Math.max(1, Math.min(30, Math.ceil(nextClose - now)));
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
  if (allowStale && item.staleUntil && item.staleUntil <= now) {
    memoryCache.delete(key);
    return null;
  }
  return cloneData(item.data);
}

function findAnyCached(symbol, interval) {
  for (const [k, v] of memoryCache.entries()) {
    if (k.startsWith(`${symbol}|${interval}|`) && v?.data?.values?.length) {
      return cloneData(v.data);
    }
  }
  return null;
}

function writeCache(key, data, ttl) {
  const now = Date.now();
  memoryCache.set(key, {
    data: cloneData(data),
    storedAt: now,
    expiresAt: now + ttl * 1000,
    staleUntil: now + Math.max(ttl * 10, 3600) * 1000
  });

  if (memoryCache.size <= MEMORY_CACHE_LIMIT) return;
  [...memoryCache.entries()]
    .sort((a, b) => a[1].storedAt - b[1].storedAt)
    .slice(0, memoryCache.size - 30)
    .forEach(([entryKey]) => memoryCache.delete(entryKey));
}

function setCacheHeaders(res, ttl, state = 'MISS', source = '') {
  // A fresh HTTP response must not relabel old candle data as fresh.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-AmyFX-Market-Cache', state);
  if (source) res.setHeader('X-AmyFX-Market-Source', source);
}

function clientCompatibleData(data) {
  if (!data?.closedOnly || !Array.isArray(data.values) || !data.values.length) return data;
  return {
    ...data,
    values: [{ ...data.values[0], amyfxSyntheticCurrent: true }, ...data.values],
    clientCompatibility: 'CLOSED_SERIES_SENTINEL_V1'
  };
}

function canonicalM1Url(symbol) {
  const params = new URLSearchParams({
    symbol,
    interval: '1min',
    outputsize: String(SHARED_M1_OUTPUT_SIZE)
  });
  return `/api/twelvedata?${params.toString()}`;
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
  if (symbol !== 'XAU/USD') {
    return res.status(403).json({ status: 'error', message: 'Hanya XAU/USD yang diizinkan' });
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    return res.status(400).json({ status: 'error', message: 'Interval tidak didukung' });
  }

  const requestedOutputSize = parseOutputSize(outputsize);
  if (interval === '1min' && requestedOutputSize < SHARED_M1_OUTPUT_SIZE) {
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.redirect(307, canonicalM1Url(symbol));
  }

  const configuredTtl = CACHE_TTL_SECONDS[interval] || 60;
  const ttl = interval === '1min' || interval === '5min' ? ttlSeconds(interval) : configuredTtl;
  const key = cacheKey(symbol, interval, requestedOutputSize);
  const fresh = readCache(key);
  if (fresh) {
    setCacheHeaders(res, ttl, 'MEMORY_HIT', fresh.source || 'memory');
    return res.status(200).json(fresh);
  }

  let request = inFlight.get(key);
  if (!request) {
    request = getCandles({
      symbol,
      interval,
      outputsize: requestedOutputSize,
      apiKey: process.env.TWELVEDATA_API_KEY
    });
    inFlight.set(key, request);
  }

  try {
    const rawData = await request;
    const data = clientCompatibleData(rawData);
    if (!/stale/i.test(`${data.source || ''} ${data.amyfxCacheState || ''}`)) writeCache(key, data, ttl);
    const cacheState = data.amyfxCacheState || 'PROVIDER_MISS';
    const responseTtl = cacheState === 'SUPABASE_STALE_FALLBACK' ? Math.min(ttl, 60) : ttl;
    setCacheHeaders(res, responseTtl, cacheState, data.source || 'unknown');
    return res.status(200).json(data);
  } catch (error) {
    const isRateLimited = error?.providerData?.code === 429
      || error?.status === 429
      || error?.statusCode === 429
      || /429|rate limit/i.test(error?.message || '');

    const stale = readCache(key, { allowStale: true })
      || findAnyCached(symbol, interval)
      || readSnapshotFallback(symbol, interval, requestedOutputSize);
    if (stale) {
      setCacheHeaders(res, Math.min(ttl, 60), 'STALE_FALLBACK', stale.source || 'memory-stale');
      return res.status(200).json({
        ...stale,
        amyfxCacheState: 'STALE_FALLBACK',
        rateLimited: isRateLimited,
        staleFallback: true,
        warning: isRateLimited
          ? 'TwelveData rate limit (HTTP 429), serving offline/cached snapshot'
          : (error?.message || 'Upstream provider error')
      });
    }

    if (error?.providerData) {
      if (isRateLimited) {
        setCacheHeaders(res, 30, 'RATE_LIMITED', 'twelvedata');
        return res.status(429).json({
          status: 'error',
          code: 429,
          message: error.providerData.message || 'TwelveData rate limit reached, please wait',
          rateLimited: true
        });
      }
      return res.status(502).json(error.providerData);
    }
    return res.status(error?.name === 'AbortError' ? 504 : 502).json({
      status: 'error',
      message: error?.message || 'Market service unavailable',
      store: marketStoreInfo()
    });
  } finally {
    if (inFlight.get(key) === request) inFlight.delete(key);
  }
}
