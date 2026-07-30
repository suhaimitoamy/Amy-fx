const WS_ENDPOINT = 'wss://ws.twelvedata.com/v1/quotes/price';
const SYMBOL = 'XAU/USD';
const HEARTBEAT_MS = 10_000;
const MAX_RECONNECT_MS = 30_000;
const LIVE_QUOTE_HARD_TTL_MS = 120_000;

let socket = null;
let heartbeatTimer = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let manualStop = false;
let lastErrorLogAt = 0;

function apiKey() {
  return String(window.state?.key || localStorage.getItem('twelve_api_key') || '').trim();
}

function providerTimestamp(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function cachedQuote() {
  try {
    const parsed = JSON.parse(localStorage.getItem('amyfx_live_quote') || 'null');
    const price = Number(parsed?.price);
    const capturedAt = providerTimestamp(parsed?.capturedAt);
    if (Number.isFinite(price) && price > 0 && capturedAt > 0) return { ...parsed, price, capturedAt };
  } catch (_) {}
  return null;
}

export function getLiveQuote() {
  const quote = window.AmyFXLiveQuote || cachedQuote();
  if (!quote) return null;
  const capturedAt = providerTimestamp(quote.capturedAt || quote.providerCapturedAt);
  const price = Number(quote.price);
  if (!Number.isFinite(price) || price <= 0 || !capturedAt) return null;
  return { ...quote, price, capturedAt };
}

export function getLastLiveQuoteAt() {
  return Number(getLiveQuote()?.capturedAt || 0);
}

export function isLivePriceRunning() {
  return Boolean(socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING));
}

function dispatchQuote(detail = {}) {
  window.dispatchEvent(new CustomEvent('amyfx:live-quote', { detail }));
}

function setConnection(connection, message = '') {
  if (window.state) window.state.conn = connection;
  const current = getLiveQuote();
  if (current) window.AmyFXLiveQuote = { ...current, connection, message };
  dispatchQuote({ connection, message, quote: current });
}

function logError(message) {
  if (Date.now() - lastErrorLogAt < 60_000) return;
  lastErrorLogAt = Date.now();
  window.console?.warn?.(`[Amy FX WebSocket] ${message}`);
}

function send(payload) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(payload));
  return true;
}

function startHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => send({ action: 'heartbeat' }), HEARTBEAT_MS);
}

function stopHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function publishPrice(data) {
  const price = Number(data?.price ?? data?.close);
  if (!Number.isFinite(price) || price <= 0) return false;
  const eventSymbol = String(data?.symbol || SYMBOL).toUpperCase();
  if (eventSymbol !== SYMBOL) return false;
  const capturedAt = providerTimestamp(data?.timestamp || data?.datetime) || Date.now();
  const quote = {
    pair: SYMBOL,
    symbol: SYMBOL,
    price,
    capturedAt,
    providerCapturedAt: new Date(capturedAt).toISOString(),
    receivedAt: new Date().toISOString(),
    connection: 'Connected',
    source: 'TWELVEDATA_WEBSOCKET'
  };
  window.AmyFXLiveQuote = quote;
  localStorage.setItem('last_ws_tick_at', String(capturedAt));
  localStorage.setItem('last_price', String(price));
  localStorage.setItem('amyfx_live_quote', JSON.stringify(quote));
  if (window.state) window.state.conn = 'Connected';
  window.AmyFXIntel?.write?.('quote', quote);
  dispatchQuote({ connection: 'Connected', quote });
  return true;
}

function handleMessage(event) {
  let data;
  try { data = JSON.parse(event.data); } catch (_) { return; }
  if (data?.event === 'price' || Number.isFinite(Number(data?.price))) {
    publishPrice(data);
    return;
  }
  if (data?.status === 'error' || data?.event === 'error') {
    logError(data?.message || 'Twelve Data WebSocket menolak permintaan.');
  }
}

function scheduleReconnect() {
  if (manualStop || document.hidden || !apiKey() || reconnectTimer) return;
  const delay = Math.min(MAX_RECONNECT_MS, 2_000 * Math.max(1, 2 ** reconnectAttempt));
  reconnectAttempt = Math.min(reconnectAttempt + 1, 4);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectLivePrice();
  }, delay);
}

export function stopLivePrice({ manual = true } = {}) {
  manualStop = manual;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  stopHeartbeat();
  const current = socket;
  socket = null;
  if (current && current.readyState < WebSocket.CLOSING) {
    try { current.close(1000, 'Amy FX live quote stopped'); } catch (_) {}
  }
  if (manual) setConnection('Offline');
}

export function connectLivePrice({ force = false } = {}) {
  const key = apiKey();
  if (!key) {
    stopLivePrice({ manual: false });
    setConnection('MissingKey', 'Masukkan API key Twelve Data untuk harga live WebSocket.');
    return false;
  }
  if (!force && isLivePriceRunning()) return true;

  manualStop = false;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  stopHeartbeat();
  if (socket && socket.readyState < WebSocket.CLOSING) {
    try { socket.close(1000, 'Reconnect'); } catch (_) {}
  }

  setConnection('Connecting');
  const nextSocket = new WebSocket(`${WS_ENDPOINT}?apikey=${encodeURIComponent(key)}`);
  socket = nextSocket;

  nextSocket.addEventListener('open', () => {
    if (socket !== nextSocket) return;
    reconnectAttempt = 0;
    send({ action: 'subscribe', params: { symbols: SYMBOL } });
    startHeartbeat();
  });
  nextSocket.addEventListener('message', handleMessage);
  nextSocket.addEventListener('error', () => {
    if (socket !== nextSocket) return;
    logError('Koneksi harga live gagal dan akan dicoba kembali.');
  });
  nextSocket.addEventListener('close', () => {
    if (socket === nextSocket) socket = null;
    stopHeartbeat();
    const lastAt = getLastLiveQuoteAt();
    const stillFresh = lastAt > 0 && Date.now() - lastAt <= LIVE_QUOTE_HARD_TTL_MS;
    setConnection(stillFresh ? 'Reconnecting' : 'Offline');
    scheduleReconnect();
  });
  return true;
}

const restored = cachedQuote();
if (restored) window.AmyFXLiveQuote = restored;

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopLivePrice({ manual: false });
    } else {
      connectLivePrice();
    }
  });
}
