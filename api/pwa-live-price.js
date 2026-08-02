import WebSocket from 'ws';

export const config = { maxDuration: 60 };

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
const SUPABASE_CLIENT_KEY = String(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_ANON_KEY
  || SUPABASE_SERVICE_KEY
  || ''
);
const TWELVEDATA_API_KEY = String(process.env.TWELVEDATA_API_KEY || '').trim();
const SYMBOL = 'XAU/USD';
const STREAM_MAX_MS = 50_000;
const HEARTBEAT_MS = 15_000;
const SNAPSHOT_FRESH_MS = 180_000;
const PERSIST_THROTTLE_MS = 5_000;
const SOURCE = 'TWELVE_DATA_WEBSOCKET_EDGE';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Accept, Content-Type',
    'Cache-Control': 'private, no-store, no-transform, max-age=0',
    'CDN-Cache-Control': 'private, no-store, max-age=0',
    'Vercel-CDN-Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-AmyFX-Market-Source': SOURCE
  };
}

function sendJson(res, status, body) {
  Object.entries(corsHeaders()).forEach(([name, value]) => res.setHeader(name, value));
  return res.status(status).json(body);
}

function bearer(req) {
  const value = String(req.headers?.authorization || '');
  return value.startsWith('Bearer ') ? value : '';
}

async function resolveUser(authorization) {
  if (!authorization || !SUPABASE_CLIENT_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_CLIENT_KEY,
      Authorization: authorization,
      Accept: 'application/json'
    }
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return typeof user?.id === 'string' ? user : null;
}

function serviceHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    Accept: 'application/json',
    ...extra
  };
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

async function readSnapshot() {
  if (!SUPABASE_SERVICE_KEY) return null;
  const query = new URLSearchParams({
    select: 'symbol,price,provider_timestamp,captured_at,source',
    symbol: `eq.${SYMBOL}`,
    limit: '1'
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/amyfx_live_quotes?${query}`, {
    headers: serviceHeaders()
  });
  if (!response.ok) return null;
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function persistQuote(price, providerTimestamp) {
  if (!SUPABASE_SERVICE_KEY) return false;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/amyfx_live_quotes?on_conflict=symbol`, {
    method: 'POST',
    headers: serviceHeaders({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    }),
    body: JSON.stringify({
      symbol: SYMBOL,
      price,
      provider_timestamp: providerTimestamp,
      captured_at: new Date(providerTimestamp * 1000).toISOString(),
      source: SOURCE,
      updated_at: new Date().toISOString()
    })
  });
  if (!response.ok) throw new Error(`quote_persist_${response.status}`);
  return true;
}

function sse(res, event, payload) {
  if (res.writableEnded || res.destroyed) return false;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    return true;
  } catch (_) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders()).forEach(([name, value]) => res.setHeader(name, value));
    return res.status(204).end();
  }
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  if (!TWELVEDATA_API_KEY || !SUPABASE_CLIENT_KEY) {
    return sendJson(res, 503, { ok: false, error: 'live_price_backend_not_configured' });
  }

  const authorization = bearer(req);
  const user = await resolveUser(authorization);
  if (!user) return sendJson(res, 401, { ok: false, error: 'unauthorized' });

  Object.entries({
    ...corsHeaders(),
    'Content-Type': 'text/event-stream; charset=utf-8',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  }).forEach(([name, value]) => res.setHeader(name, value));
  res.statusCode = 200;
  res.flushHeaders?.();

  const marketOpen = isMarketOpen();
  const snapshot = await readSnapshot().catch(() => null);
  if (snapshot) {
    const capturedAt = Date.parse(String(snapshot.captured_at || ''));
    const ageMs = Number.isFinite(capturedAt)
      ? Math.max(0, Date.now() - capturedAt)
      : Number.POSITIVE_INFINITY;
    sse(res, 'price', {
      price: Number(snapshot.price),
      timestamp: Number(snapshot.provider_timestamp),
      capturedAt: Number(snapshot.provider_timestamp) * 1000,
      symbol: SYMBOL,
      source: snapshot.source || SOURCE,
      snapshot: true,
      stale: marketOpen && ageMs > SNAPSHOT_FRESH_MS,
      marketOpen
    });
  } else {
    sse(res, 'status', {
      status: marketOpen ? 'WAITING_FOR_FIRST_TICK' : 'MARKET_CLOSED_NO_WEBSOCKET_SNAPSHOT',
      source: SOURCE,
      message: marketOpen
        ? 'Menunggu tick WebSocket pertama XAU/USD.'
        : 'Market tutup dan belum ada snapshot WebSocket tersimpan.',
      marketOpen
    });
  }

  await new Promise(resolve => {
    let socket = null;
    let closed = false;
    let lastPersistAt = 0;
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
    heartbeatTimer = setInterval(() => {
      if (closed || res.writableEnded) return cleanup();
      try { res.write(`: heartbeat ${Date.now()}\n\n`); } catch (_) { cleanup(); }
    }, HEARTBEAT_MS);
    lifetimeTimer = setTimeout(() => {
      sse(res, 'status', { status: 'RECONNECT', source: SOURCE, marketOpen: isMarketOpen() });
      cleanup();
    }, STREAM_MAX_MS);

    sse(res, 'status', { status: 'CONNECTING', source: SOURCE, marketOpen });
    socket = new WebSocket(
      `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(TWELVEDATA_API_KEY)}`,
      { handshakeTimeout: 15_000 }
    );

    socket.on('open', () => {
      socket.send(JSON.stringify({ action: 'subscribe', params: { symbols: SYMBOL } }));
      sse(res, 'status', { status: 'CONNECTED', source: SOURCE, marketOpen: isMarketOpen() });
    });

    socket.on('message', raw => {
      if (closed) return;
      let payload;
      try { payload = JSON.parse(raw.toString()); } catch (_) { return; }

      const event = String(payload?.event || '').toLowerCase();
      if (event === 'subscribe-status') {
        const status = String(payload?.status || '').toLowerCase();
        sse(res, 'status', {
          status: status === 'error' ? 'ERROR' : 'SUBSCRIBED',
          source: SOURCE,
          message: status === 'error'
            ? 'Langganan harga XAU/USD ditolak.'
            : 'Harga live XAU/USD aktif.',
          marketOpen: isMarketOpen()
        });
        return;
      }
      if (event && event !== 'price') return;

      const price = Number(payload?.price);
      const symbol = String(payload?.symbol || SYMBOL).replace('/', '').toUpperCase();
      if (!Number.isFinite(price) || price <= 0 || symbol !== 'XAUUSD') return;
      const providerTimestamp = Number(payload?.timestamp) > 0
        ? Math.floor(Number(payload.timestamp))
        : Math.floor(Date.now() / 1000);

      sse(res, 'price', {
        price,
        timestamp: providerTimestamp,
        capturedAt: providerTimestamp * 1000,
        symbol: SYMBOL,
        source: SOURCE,
        snapshot: false,
        stale: false,
        marketOpen: isMarketOpen()
      });

      if (Date.now() - lastPersistAt >= PERSIST_THROTTLE_MS) {
        lastPersistAt = Date.now();
        persistQuote(price, providerTimestamp).catch(error => {
          console.error('pwa-live-price persist', error?.message || error);
        });
      }
    });

    socket.on('error', error => {
      sse(res, 'status', {
        status: 'ERROR',
        source: SOURCE,
        message: error?.message || 'WebSocket harga gagal tersambung.',
        marketOpen: isMarketOpen()
      });
    });

    socket.on('close', () => {
      if (closed) return;
      sse(res, 'status', {
        status: 'RECONNECT',
        source: SOURCE,
        message: 'Stream harga terputus dan akan disambungkan ulang.',
        marketOpen: isMarketOpen()
      });
      cleanup();
    });
  });
}
