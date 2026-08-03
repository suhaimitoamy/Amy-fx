import { createHash, timingSafeEqual } from 'node:crypto';

export const config = { maxDuration: 60 };

const MAX_OUTPUT_SIZE = 2_000;
const PROVIDER_TIMEOUT_MS = 15_000;
const AUTH_TIMEOUT_MS = 5_000;
const AUTH_CACHE_MS = 15 * 60 * 1_000;
const USER_AUTH_CACHE_MS = 5 * 60 * 1_000;
const STREAM_MAX_MS = 50_000;
const HEARTBEAT_MS = 10_000;
const SYMBOL = 'XAU/USD';
const STREAM_SOURCE = 'TWELVE_DATA_WEBSOCKET_EDGE';
const SUPABASE_URL = String(
  process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://wliecyxzlwhmtftnfnps.supabase.co'
).replace(/\/$/, '');
const SUPABASE_PUBLISHABLE_KEY = String(
  process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || 'sb_publishable_g4ytNj6AWj3S9r-cxDg9Qw_dDVtCBED'
);
const verifiedTokens = globalThis.__amyFxVerifiedServiceTokens
  || (globalThis.__amyFxVerifiedServiceTokens = new Map());
const verifiedUsers = globalThis.__amyFxVerifiedUserTokens
  || (globalThis.__amyFxVerifiedUserTokens = new Map());

function parseOutputSize(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return 300;
  return Math.min(Math.max(parsed, 1), MAX_OUTPUT_SIZE);
}

function readBearerToken(req) {
  const authorization = String(req.headers?.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function safeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function localServiceTokenMatches(token) {
  const candidates = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_KEY,
    process.env.SUPABASE_SECRET_KEY
  ].map(value => String(value || '')).filter(Boolean);
  return candidates.some(candidate => safeEqual(token, candidate));
}

function tokenFingerprint(token) {
  return createHash('sha256').update(token).digest('hex');
}

function pruneCache(cache, maxSize = 50) {
  if (cache.size <= maxSize) return;
  const now = Date.now();
  for (const [key, expiresAt] of cache) {
    if (Number(expiresAt) <= now) cache.delete(key);
  }
  while (cache.size > maxSize) cache.delete(cache.keys().next().value);
}

async function verifiedBySupabaseAuth(token) {
  const fingerprint = tokenFingerprint(token);
  const cachedUntil = Number(verifiedTokens.get(fingerprint) || 0);
  if (cachedUntil > Date.now()) return true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, {
      signal: controller.signal,
      headers: {
        apikey: token,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
    if (!response.ok) return false;
    verifiedTokens.set(fingerprint, Date.now() + AUTH_CACHE_MS);
    pruneCache(verifiedTokens, 20);
    return true;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifiedUserBySupabaseAuth(token) {
  const fingerprint = tokenFingerprint(token);
  const cachedUntil = Number(verifiedUsers.get(fingerprint) || 0);
  if (cachedUntil > Date.now()) return true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
    if (!response.ok) return false;
    const user = await response.json().catch(() => null);
    if (typeof user?.id !== 'string') return false;
    verifiedUsers.set(fingerprint, Date.now() + USER_AUTH_CACHE_MS);
    pruneCache(verifiedUsers, 100);
    return true;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function authorized(req) {
  const token = readBearerToken(req);
  if (!token) return false;
  if (localServiceTokenMatches(token)) return true;
  return verifiedBySupabaseAuth(token);
}

async function authorizedUser(req) {
  const token = readBearerToken(req);
  return token ? verifiedUserBySupabaseAuth(token) : false;
}

function applyCommonHeaders(res, source = 'twelvedata-internal-direct') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Accept, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Cache-Control, X-AmyFX-Market-Source');
  res.setHeader('Cache-Control', 'private, no-store, no-transform, max-age=0');
  res.setHeader('CDN-Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vercel-CDN-Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-AmyFX-Market-Source', source);
}

function isMarketOpen(now = Date.now()) {
  const date = new Date(now);
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  if (day === 6) return false;
  if (day === 0 && hour < 22) return false;
  if (day === 5 && hour >= 22) return false;
  return true;
}

function parseProviderMessage(raw) {
  try {
    return JSON.parse(typeof raw === 'string' ? raw : String(raw));
  } catch (_) {
    return null;
  }
}

function openProviderSocket(apiKey) {
  if (typeof WebSocket !== 'function') throw new Error('websocket_runtime_unavailable');
  return new WebSocket(
    `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(apiKey)}`
  );
}

async function providerHealthcheck(apiKey) {
  return await new Promise(resolve => {
    let settled = false;
    const socket = openProviderSocket(apiKey);
    const finish = payload => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(1000, 'healthcheck complete'); } catch (_) {}
      resolve(payload);
    };
    const timer = setTimeout(() => finish({ ok: false, stage: 'timeout' }), 12_000);
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ action: 'subscribe', params: { symbols: SYMBOL } }));
    });
    socket.addEventListener('error', () => finish({ ok: false, stage: 'socket_error' }));
    socket.addEventListener('message', event => {
      const payload = parseProviderMessage(event.data);
      const type = String(payload?.event || '').toLowerCase();
      if (type === 'subscribe-status') {
        const providerStatus = String(payload?.status || '').toLowerCase();
        finish({
          ok: providerStatus !== 'error',
          stage: 'subscribed',
          providerStatus: providerStatus || 'unknown'
        });
      } else if (type === 'price') {
        finish({ ok: Number(payload?.price) > 0, stage: 'price_tick' });
      }
    });
  });
}

function writeSse(res, event, payload) {
  if (res.writableEnded || res.destroyed) return false;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    return true;
  } catch (_) {
    return false;
  }
}

async function streamLivePrice(req, res, apiKey) {
  applyCommonHeaders(res, STREAM_SOURCE);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.statusCode = 200;
  res.flushHeaders?.();

  writeSse(res, 'status', {
    status: 'CONNECTING',
    source: STREAM_SOURCE,
    message: 'Menghubungkan Twelve Data WebSocket.',
    marketOpen: isMarketOpen()
  });

  await new Promise(resolve => {
    let socket = null;
    let closed = false;
    let heartbeatTimer = null;
    let lifetimeTimer = null;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (lifetimeTimer) clearTimeout(lifetimeTimer);
      try { socket?.close(1000, 'stream closed'); } catch (_) {}
      socket = null;
      if (!res.writableEnded) res.end();
      resolve();
    };

    req.once('close', cleanup);
    req.once('aborted', cleanup);

    try {
      socket = openProviderSocket(apiKey);
    } catch (error) {
      writeSse(res, 'status', {
        status: 'ERROR',
        source: STREAM_SOURCE,
        message: error?.message || 'Runtime WebSocket tidak tersedia.',
        marketOpen: isMarketOpen()
      });
      cleanup();
      return;
    }

    heartbeatTimer = setInterval(() => {
      if (closed || res.writableEnded) return cleanup();
      if (socket?.readyState === WebSocket.OPEN) {
        try { socket.send(JSON.stringify({ action: 'heartbeat' })); } catch (_) {}
      }
      try { res.write(`: heartbeat ${Date.now()}\n\n`); } catch (_) { cleanup(); }
    }, HEARTBEAT_MS);

    lifetimeTimer = setTimeout(() => {
      writeSse(res, 'status', {
        status: 'RECONNECT',
        source: STREAM_SOURCE,
        message: 'Menyegarkan koneksi harga live.',
        marketOpen: isMarketOpen()
      });
      cleanup();
    }, STREAM_MAX_MS);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ action: 'subscribe', params: { symbols: SYMBOL } }));
      writeSse(res, 'status', {
        status: 'CONNECTED',
        source: STREAM_SOURCE,
        message: 'Twelve Data WebSocket tersambung.',
        marketOpen: isMarketOpen()
      });
    });

    socket.addEventListener('message', event => {
      if (closed) return;
      const payload = parseProviderMessage(event.data);
      if (!payload) return;
      const eventType = String(payload.event || '').toLowerCase();

      if (eventType === 'subscribe-status') {
        const providerStatus = String(payload.status || '').toLowerCase();
        writeSse(res, 'status', {
          status: providerStatus === 'error' ? 'ERROR' : 'SUBSCRIBED',
          source: STREAM_SOURCE,
          message: providerStatus === 'error'
            ? 'Langganan harga XAU/USD ditolak.'
            : 'Harga live XAU/USD aktif.',
          marketOpen: isMarketOpen()
        });
        return;
      }
      if (eventType && eventType !== 'price') return;

      const price = Number(payload.price);
      const normalizedSymbol = String(payload.symbol || SYMBOL).replace('/', '').toUpperCase();
      if (!Number.isFinite(price) || price <= 0 || normalizedSymbol !== 'XAUUSD') return;
      const providerTimestamp = Number(payload.timestamp) > 0
        ? Math.floor(Number(payload.timestamp))
        : Math.floor(Date.now() / 1000);

      writeSse(res, 'price', {
        price,
        timestamp: providerTimestamp,
        capturedAt: providerTimestamp * 1000,
        symbol: SYMBOL,
        source: STREAM_SOURCE,
        snapshot: false,
        stale: false,
        marketOpen: isMarketOpen()
      });
    });

    socket.addEventListener('error', () => {
      writeSse(res, 'status', {
        status: 'ERROR',
        source: STREAM_SOURCE,
        message: 'WebSocket harga gagal tersambung.',
        marketOpen: isMarketOpen()
      });
    });

    socket.addEventListener('close', () => {
      if (closed) return;
      writeSse(res, 'status', {
        status: 'RECONNECT',
        source: STREAM_SOURCE,
        message: 'Stream harga terputus dan akan disambungkan ulang.',
        marketOpen: isMarketOpen()
      });
      cleanup();
    });
  });
}

export default async function handler(req, res) {
  applyCommonHeaders(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET,OPTIONS');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const apiKey = String(process.env.TWELVEDATA_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(503).json({ status: 'error', message: 'TWELVEDATA_API_KEY is not configured' });
  }

  const streamMode = String(req.query?.stream || '');
  if (streamMode === 'health') {
    if (!(await authorized(req))) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized internal market request' });
    }
    const result = await providerHealthcheck(apiKey).catch(error => ({
      ok: false,
      stage: 'exception',
      message: error?.message || String(error)
    }));
    return res.status(result.ok ? 200 : 502).json(result);
  }

  if (streamMode === '1') {
    if (!(await authorizedUser(req))) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized live-price stream request' });
    }
    return streamLivePrice(req, res, apiKey);
  }

  if (!(await authorized(req))) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized internal market request' });
  }

  const symbol = String(req.query?.symbol || SYMBOL).toUpperCase();
  const interval = String(req.query?.interval || '1min').toLowerCase();
  if (symbol !== SYMBOL || interval !== '1min') {
    return res.status(400).json({ status: 'error', message: 'Only XAU/USD 1min is allowed' });
  }

  const params = new URLSearchParams({
    symbol,
    interval,
    outputsize: String(parseOutputSize(req.query?.outputsize)),
    timezone: 'UTC',
    apikey: apiKey
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.twelvedata.com/time_series?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(502).json({
        status: 'error',
        message: `Twelve Data HTTP ${response.status}`
      });
    }
    if (!payload || payload.status === 'error' || !Array.isArray(payload.values)) {
      return res.status(502).json(payload || {
        status: 'error',
        message: 'Twelve Data returned an invalid response'
      });
    }
    return res.status(200).json({
      ...payload,
      amyfxProviderOnly: true,
      source: 'twelvedata-internal-direct'
    });
  } catch (error) {
    return res.status(error?.name === 'AbortError' ? 504 : 502).json({
      status: 'error',
      message: error?.message || 'Internal provider request failed'
    });
  } finally {
    clearTimeout(timeout);
  }
}
