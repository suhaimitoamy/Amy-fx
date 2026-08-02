export const config = { maxDuration: 60 };

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
const TWELVEDATA_API_KEY = String(process.env.TWELVEDATA_API_KEY || '').trim();
const SYMBOL = 'XAU/USD';
const SOURCE = 'TWELVE_DATA_WEBSOCKET_EDGE';
const STREAM_MAX_MS = 50_000;
const HEARTBEAT_MS = 10_000;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Accept, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Type, Cache-Control, X-AmyFX-Market-Source',
    'Cache-Control': 'private, no-store, no-transform, max-age=0',
    'CDN-Cache-Control': 'private, no-store, max-age=0',
    'Vercel-CDN-Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-AmyFX-Market-Source': SOURCE
  };
}

function applyHeaders(res, extra = {}) {
  for (const [name, value] of Object.entries({ ...corsHeaders(), ...extra })) {
    res.setHeader(name, value);
  }
}

function sendJson(res, status, body) {
  applyHeaders(res, { 'Content-Type': 'application/json; charset=utf-8' });
  return res.status(status).json(body);
}

function bearer(req) {
  const value = String(req.headers?.authorization || '');
  return value.startsWith('Bearer ') ? value : '';
}

async function resolveUser(authorization) {
  if (!authorization || !SUPABASE_PUBLISHABLE_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization,
      Accept: 'application/json'
    }
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return typeof user?.id === 'string' ? user : null;
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

function openProviderSocket() {
  if (typeof WebSocket !== 'function') throw new Error('websocket_runtime_unavailable');
  return new WebSocket(
    `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(TWELVEDATA_API_KEY)}`
  );
}

async function healthcheck() {
  if (!TWELVEDATA_API_KEY) return { ok: false, stage: 'configuration' };
  return await new Promise(resolve => {
    let settled = false;
    const socket = openProviderSocket();
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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyHeaders(res);
    return res.status(204).end();
  }
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  if (!TWELVEDATA_API_KEY) return sendJson(res, 503, { ok: false, error: 'live_price_backend_not_configured' });

  if (String(req.query?.health || '') === '1') {
    const result = await healthcheck().catch(error => ({
      ok: false,
      stage: 'exception',
      message: error?.message || String(error)
    }));
    return sendJson(res, result.ok ? 200 : 502, result);
  }

  const authorization = bearer(req);
  const user = await resolveUser(authorization);
  if (!user) return sendJson(res, 401, { ok: false, error: 'unauthorized' });

  applyHeaders(res, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.statusCode = 200;
  res.flushHeaders?.();

  const marketOpen = isMarketOpen();
  writeSse(res, 'status', {
    status: 'CONNECTING',
    source: SOURCE,
    message: 'Menghubungkan Twelve Data WebSocket.',
    marketOpen
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
      socket = openProviderSocket();
    } catch (error) {
      writeSse(res, 'status', {
        status: 'ERROR',
        source: SOURCE,
        message: error?.message || 'Runtime WebSocket tidak tersedia.',
        marketOpen
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
        source: SOURCE,
        message: 'Menyegarkan koneksi harga live.',
        marketOpen: isMarketOpen()
      });
      cleanup();
    }, STREAM_MAX_MS);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ action: 'subscribe', params: { symbols: SYMBOL } }));
      writeSse(res, 'status', {
        status: 'CONNECTED',
        source: SOURCE,
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
          source: SOURCE,
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
        source: SOURCE,
        snapshot: false,
        stale: false,
        marketOpen: isMarketOpen()
      });
    });

    socket.addEventListener('error', () => {
      writeSse(res, 'status', {
        status: 'ERROR',
        source: SOURCE,
        message: 'WebSocket harga gagal tersambung.',
        marketOpen: isMarketOpen()
      });
    });

    socket.addEventListener('close', () => {
      if (closed) return;
      writeSse(res, 'status', {
        status: 'RECONNECT',
        source: SOURCE,
        message: 'Stream harga terputus dan akan disambungkan ulang.',
        marketOpen: isMarketOpen()
      });
      cleanup();
    });
  });
}
