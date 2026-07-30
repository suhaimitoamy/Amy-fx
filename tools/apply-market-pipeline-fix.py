from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"Expected source block not found in {path}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count == 0:
        if replacement.strip() in text:
            return
        raise RuntimeError(f"Expected regex block not found in {path}: {pattern}")
    write(path, updated)


def replace_existing(path: str, old: str, new: str) -> None:
    target = ROOT / path
    if not target.exists():
        return
    text = target.read_text(encoding="utf-8")
    if old in text:
        target.write_text(text.replace(old, new), encoding="utf-8")


LIVE_MODULE = r'''const WS_ENDPOINT = 'wss://ws.twelvedata.com/v1/quotes/price';
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
'''


TEST_MODULE = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('Supabase candle writes deduplicate conflict keys before upsert', () => {
  const store = read('lib/market-candle-store.mjs');
  assert.match(store, /function dedupeCandleRows\(/);
  assert.match(store, /JSON\.stringify\(dedupedRows\)/);
});

test('live display uses Twelve Data WebSocket without writing Mapping candles', () => {
  const websocket = read('app/src/main/assets/apps/mapping/js/api/live-price-websocket.js');
  assert.match(websocket, /wss:\/\/ws\.twelvedata\.com\/v1\/quotes\/price/);
  assert.match(websocket, /action: 'subscribe'/);
  assert.match(websocket, /action: 'heartbeat'/);
  assert.match(websocket, /source: 'TWELVEDATA_WEBSOCKET'/);
  assert.doesNotMatch(websocket, /\/rest\/v1\/candles|upsert|ScannerService/);
});

test('REST Mapping quote and WebSocket display quote remain separate', () => {
  const main = read('app/src/main/assets/apps/mapping/js/main.js');
  const market = read('app/src/main/assets/apps/mapping/js/api/market-data.js');
  const contract = read('app/src/main/assets/apps/shared/amyfx-market-state-contract-v1.js');
  assert.match(main, /last_mapping_price/);
  assert.doesNotMatch(main, /removeItem\('twelve_api_key'\)/);
  assert.match(market, /last_mapping_quote_at/);
  assert.doesNotMatch(market, /setItem\('last_ws_tick_at'/);
  assert.match(contract, /TWELVEDATA_WEBSOCKET/);
  assert.match(contract, /MAPPING_REST_FALLBACK/);
});
'''


def patch_market_store() -> None:
    path = 'lib/market-candle-store.mjs'
    helper = '''function candleIdentity(row) {
  return `${String(row?.symbol || '')}|${String(row?.timeframe || '')}|${Number(row?.open_time || 0)}`;
}

export function dedupeCandleRows(rows = []) {
  const unique = new Map();
  for (const row of rows) {
    const openTime = Number(row?.open_time || 0);
    if (!row || !row.symbol || !row.timeframe || !Number.isFinite(openTime) || openTime <= 0) continue;
    unique.set(candleIdentity(row), row);
  }
  return [...unique.values()].sort((a, b) => Number(b.open_time) - Number(a.open_time));
}

'''
    replace_once(path, 'function rowToProviderValue(row) {', helper + 'function rowToProviderValue(row) {')
    replace_once(
        path,
        "async function upsertSupabaseCandles(rows) {\n  if (!directSupabaseConfigured() || !rows.length) return false;",
        "async function upsertSupabaseCandles(rows) {\n  const dedupedRows = dedupeCandleRows(rows);\n  if (!directSupabaseConfigured() || !dedupedRows.length) return false;"
    )
    replace_once(path, 'body: JSON.stringify(rows)', 'body: JSON.stringify(dedupedRows)')
    replace_once(
        path,
        '''    const normalizedProviderRows = data.values
      .map(value => providerValueToRow(value, symbol, interval))
      .filter(Boolean);
    const providerRows = normalizedProviderRows
      .filter(row => row.open_time <= expectedOpenTime);''',
        '''    const normalizedProviderRows = dedupeCandleRows(data.values
      .map(value => providerValueToRow(value, symbol, interval))
      .filter(Boolean));
    const providerRows = dedupeCandleRows(normalizedProviderRows
      .filter(row => row.open_time <= expectedOpenTime));'''
    )


def patch_market_data() -> None:
    path = 'app/src/main/assets/apps/mapping/js/api/market-data.js'
    replace_once(
        path,
        "export let lastWsTickAt = Number(localStorage.getItem('last_ws_tick_at') || 0);",
        "export let lastMappingQuoteAt = Number(localStorage.getItem('last_mapping_quote_at') || 0);"
    )
    replace_once(
        path,
        '''    price,
    bsl,''',
        '''    price,
    quoteCapturedAt: lastMappingQuoteAt || Number(localStorage.getItem('last_mapping_quote_at') || 0),
    bsl,'''
    )
    new_tail = r'''async function pollLivePrice() {
  if (document.hidden || pollInFlight) return;
  pollInFlight = true;
  try {
    const response = await fetch(`${PROXY_URL}?symbol=XAU/USD&interval=1min&outputsize=1&_=${Math.floor(Date.now() / LIVE_POLL_MS)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const latest = data.values?.[0] || {};
    const price = +(latest.close || 0);
    if (data.status !== 'ok' || !Number.isFinite(price) || price <= 0) throw new Error(data.message || 'Harga Mapping tidak valid');

    const explicitCapturedAt = Date.parse(String(data.quoteCapturedAt || ''));
    const candleCapturedAt = Date.parse(String(latest.datetime || ''));
    lastMappingQuoteAt = Number.isFinite(explicitCapturedAt)
      ? explicitCapturedAt
      : Number.isFinite(candleCapturedAt) ? candleCapturedAt : 0;
    if (lastMappingQuoteAt > 0) localStorage.setItem('last_mapping_quote_at', String(lastMappingQuoteAt));
    localStorage.setItem('last_mapping_price', String(price));
    state.price = price;

    if (state.result) {
      state.result.quoteCapturedAt = lastMappingQuoteAt || null;
      state.result.setupExecution = buildSetupExecution(state.result);
      state.result.mappingExplanation = buildMappingExplanation(state.result);
      state.result.mappingSnapshot = buildMappingSnapshot(state.result, {
        candles: state.candles[state.result.tf] || [],
        livePrice: state.price,
        capturedAt: lastMappingQuoteAt || Date.now()
      });
    }
    publishMappingSnapshot();
    sendTargetsToNative();
    notifyImportant(state.result);
    renderAnalyzeLive();
    renderSoft();
    scheduleAnalysisRefresh();
  } catch (error) {
    if (Date.now() - lastErrorLogAt > 60000) {
      lastErrorLogAt = Date.now();
      log(`Harga internal Mapping mencoba tersambung kembali: ${error.message}`);
    }
  } finally {
    pollInFlight = false;
  }
}

export function connect() {
  if (liveTimer) clearInterval(liveTimer);
  pollLivePrice();
  liveTimer = setInterval(pollLivePrice, LIVE_POLL_MS);
  if (!state.candles[state.tf]?.length) runAnalysis(state.tf);
}

export function isLivePriceRunning() { return liveTimer !== null; }

export function stopLivePrice() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
}
'''
    regex_once(path, r'async function pollLivePrice\(\) \{.*\Z', new_tail)


def patch_main() -> None:
    path = 'app/src/main/assets/apps/mapping/js/main.js'
    replace_once(
        path,
        '''import {
  runAnalysis,
  connect,
  isLivePriceRunning,
  lastWsTickAt
} from './api/market-data.js';''',
        '''import {
  runAnalysis,
  connect as connectMappingQuote,
  isLivePriceRunning as isMappingQuoteRunning
} from './api/market-data.js';
import {
  connectLivePrice,
  getLastLiveQuoteAt,
  isLivePriceRunning
} from './api/live-price-websocket.js';'''
    )
    replace_once(path, "  key: '',", "  key: String(localStorage.getItem('twelve_api_key') || '').trim(),")
    replace_once(path, "  price: Number(localStorage.getItem('last_price') || 0),", "  price: Number(localStorage.getItem('last_mapping_price') || 0),")
    regex_once(
        path,
        r'''function autoConnectLivePrice\(\) \{.*?\n\}\n\nfunction livePriceWatchdog\(\) \{.*?\n\}''',
        '''function autoConnectMarketData() {
  if (!isMappingQuoteRunning()) connectMappingQuote();
  connectLivePrice();
}

function livePriceWatchdog() {
  const lastTickAt = getLastLiveQuoteAt();
  const stale = !lastTickAt || Date.now() - lastTickAt > 45_000;
  if (!isLivePriceRunning() || state.conn === 'Offline' || stale) connectLivePrice();
}'''
    )
    replace_once(
        path,
        "  try { localStorage.removeItem('twelve_api_key'); } catch (_) {}",
        "  try { state.key = String(localStorage.getItem('twelve_api_key') || '').trim(); } catch (_) {}"
    )
    replace_once(path, 'setTimeout(autoConnectLivePrice, 600);', 'setTimeout(autoConnectMarketData, 600);')
    replace_existing(
        path,
        "Harga live, snapshot Mapping, scanner, dan notifikasi memakai kontrak setupExecution yang sama.",
        "Harga live berasal dari WebSocket. Candle, snapshot, dan keputusan Mapping tetap berasal dari REST → Supabase."
    )


def patch_android_bridge() -> None:
    path = 'app/src/main/assets/apps/mapping/js/bridge/android-bridge.js'
    replace_once(
        path,
        "import { connect } from '../api/market-data.js';",
        "import { connect as connectMappingQuote } from '../api/market-data.js';\nimport { connectLivePrice } from '../api/live-price-websocket.js';"
    )
    replacement = r'''export function saveConnect() {
  const input = document.getElementById('apiKey');
  const key = String(input?.value || '').trim();
  state.key = key;
  try {
    if (key) localStorage.setItem('twelve_api_key', key);
    else localStorage.removeItem('twelve_api_key');
  } catch (_) {}

  state.bg = false;
  try { localStorage.setItem('bg_scanner', 'false'); } catch (_) {}
  connectMappingQuote();
  connectLivePrice({ force: true });
  sendTargetsToNative();
  render();
}
'''
    regex_once(path, r'export function saveConnect\(\) \{.*?\n\}\n\n(?=export function toggleBg)', replacement)


def patch_ui() -> None:
    path = 'app/src/main/assets/apps/mapping/js/ui/ui-render.js'
    helper = r'''const LIVE_QUOTE_HARD_TTL_MS = 120_000;

function liveDisplayPrice() {
  let quote = window.AmyFXLiveQuote || null;
  if (!quote) {
    try { quote = JSON.parse(localStorage.getItem('amyfx_live_quote') || 'null'); } catch (_) {}
  }
  const price = Number(quote?.price);
  const rawTime = Number(quote?.capturedAt || 0);
  const capturedAt = rawTime > 0
    ? (rawTime > 10_000_000_000 ? rawTime : rawTime * 1000)
    : Date.parse(String(quote?.providerCapturedAt || ''));
  if (Number.isFinite(price) && price > 0 && Number.isFinite(capturedAt) && Date.now() - capturedAt <= LIVE_QUOTE_HARD_TTL_MS) {
    return price;
  }
  return Number(state.price || localStorage.getItem('last_mapping_price') || 0);
}

'''
    replace_once(path, 'function statusDot() {', helper + 'function statusDot() {')
    text = read(path).replace('p2(state.price)', 'p2(liveDisplayPrice())')
    text = text.replace('<strong>$${p2(liveDisplayPrice())}</strong>', '<strong data-live-price>$${p2(liveDisplayPrice())}</strong>')
    text = text.replace('<div class="price">$${p2(liveDisplayPrice())}</div>', '<div class="price" data-live-price>$${p2(liveDisplayPrice())}</div>')
    text = text.replace(
        'Twelve Data API Key <span class="muted">(opsional untuk candle)</span>',
        'Twelve Data API Key <span class="muted">(khusus harga live WebSocket)</span>'
    )
    text = text.replace(
        'Harga live, snapshot Mapping, scanner, dan notifikasi memakai kontrak setupExecution yang sama.',
        'API key ini hanya membuka harga live WebSocket. Candle dan analisis Mapping tetap berasal dari backend Supabase.'
    )
    write(path, text)
    replace_once(
        path,
        "export function renderSoft(){statusDot();let p=document.querySelector('.price');if(p)p.textContent='$'+p2(liveDisplayPrice());",
        "export function renderSoft(){statusDot();const liveText='$'+p2(liveDisplayPrice());document.querySelectorAll('[data-live-price]').forEach(el=>{el.textContent=liveText});let p=document.querySelector('.price');if(p)p.textContent=liveText;"
    )
    replace_once(
        path,
        "if(typeof window!=='undefined')window.addEventListener('scroll',syncStickyBar,{passive:true});",
        "if(typeof window!=='undefined')window.addEventListener('amyfx:live-quote',()=>renderSoft());\nif(typeof window!=='undefined')window.addEventListener('scroll',syncStickyBar,{passive:true});"
    )


def patch_contract() -> None:
    path = 'app/src/main/assets/apps/shared/amyfx-market-state-contract-v1.js'
    replacement = r'''function quoteFromMapping(payload, previousQuote) {
    const previousFreshness = previousQuote ? assess("quote", previousQuote) : null;
    if (previousQuote?.source === "TWELVEDATA_WEBSOCKET" && previousFreshness?.state === "LIVE") {
      return previousQuote;
    }
    const price = Number(payload?.price || payload?.currentPrice || 0);
    if (!Number.isFinite(price) || price <= 0) return previousQuote || null;
    const tickAt = timestamp(payload?.quoteCapturedAt)
      || timestamp(payload?.providerCapturedAt)
      || timestamp(localStorage.getItem("last_mapping_quote_at"));
    if (!tickAt) return previousQuote || null;
    return {
      ...(previousQuote || {}),
      pair: "XAU/USD",
      price,
      capturedAt: new Date(tickAt).toISOString(),
      receivedAt: new Date().toISOString(),
      storedAt: Date.now(),
      connection: payload?.connection || "Mapping REST",
      source: "MAPPING_REST_FALLBACK",
      schemaVersion: SCHEMA_VERSION
    };
  }

  function normalizeWrite'''
    regex_once(path, r'function quoteFromMapping\(payload, previousQuote\) \{.*?\n  \}\n\n  function normalizeWrite', replacement)


def bump_identity() -> None:
    gradle = read('app/build.gradle.kts')
    preview = 'com.amyelitesuite.learningpreview' in gradle
    if preview:
        replace_existing('app/build.gradle.kts', '940292', '940293')
        replace_existing('app/build.gradle.kts', '2.0.0-preview.292', '2.0.0-preview.293')
        replace_existing('app/src/main/assets/app-version.js', '940292', '940293')
        replace_existing('app/src/main/assets/app-version.js', '2.0.0-preview.292', '2.0.0-preview.293')
        replace_existing('.github/workflows/amyfx-blueprint-preview-release.yml', '940292', '940293')
        replace_existing('.github/workflows/amyfx-blueprint-preview-release.yml', '2.0.0-preview.292', '2.0.0-preview.293')
        for test_path in (ROOT / 'tests').glob('*.test.mjs'):
            text = test_path.read_text(encoding='utf-8')
            text = text.replace('2.0.0-preview.292', '2.0.0-preview.293').replace('940292', '940293')
            test_path.write_text(text, encoding='utf-8')
    else:
        replace_existing('app/build.gradle.kts', '?: 52)', '?: 53)')
        replace_existing('app/build.gradle.kts', '?: "2.0.1"', '?: "2.0.2"')
        replace_existing('app/src/main/assets/app-version.js', "name: '2.0.1', code: 52", "name: '2.0.2', code: 53")
        workflow = '.github/workflows/build-apk.yml'
        replace_existing(workflow, 'AMYFX_VERSION_NAME: "2.0.1"', 'AMYFX_VERSION_NAME: "2.0.2"')
        replace_existing(workflow, 'AMYFX_VERSION_CODE: "52"', 'AMYFX_VERSION_CODE: "53"')
        replace_existing(workflow, 'Amy FX 2.0.1', 'Amy FX 2.0.2')
        replace_existing(workflow, "name: '2.0.1', code: 52", "name: '2.0.2', code: 53")
        replace_existing(workflow, '?: 52)', '?: 53)')
        replace_existing(workflow, '?: "2.0.1"', '?: "2.0.2"')
        replace_existing(workflow, 'Amy-FX-v2.0.1-signed-apk', 'Amy-FX-v2.0.2-signed-apk')
        replace_existing(workflow, 'latest_version_code=52', 'latest_version_code=53')
        replace_existing(workflow, "latest_version_name='2.0.1'", "latest_version_name='2.0.2'")
        replace_existing(workflow, 'versionCode=52', 'versionCode=53')
        replace_existing(workflow, "version='2.0.1'", "version='2.0.2'")
        replace_existing(workflow, "activate Amy FX 2.0.1", "activate Amy FX 2.0.2")
        replace_existing(workflow, '"latest_version_code": 52', '"latest_version_code": 53')
        replace_existing(workflow, '"latest_version_name": "2.0.1"', '"latest_version_name": "2.0.2"')
        for test_path in (ROOT / 'tests').glob('*.test.mjs'):
            text = test_path.read_text(encoding='utf-8')
            text = text.replace('2.0.1', '2.0.2')
            text = text.replace("code: 52", "code: 53")
            text = text.replace('?: 52)', '?: 53)')
            text = text.replace('versionCode=52', 'versionCode=53')
            text = text.replace('latest_version_code=52', 'latest_version_code=53')
            test_path.write_text(text, encoding='utf-8')


def main() -> None:
    patch_market_store()
    write('app/src/main/assets/apps/mapping/js/api/live-price-websocket.js', LIVE_MODULE)
    patch_market_data()
    patch_main()
    patch_android_bridge()
    patch_ui()
    patch_contract()
    write('tests/market-pipeline-separation.test.mjs', TEST_MODULE)
    bump_identity()
    print('Amy FX market pipeline fix applied.')


if __name__ == '__main__':
    main()
