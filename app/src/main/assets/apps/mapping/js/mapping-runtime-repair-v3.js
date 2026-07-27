import { state, TF, save } from './main.js';
import { runAnalysis, setCandleFetchedAt } from './api/market-data.js';

const PROXY_URL = 'https://amy-fx.vercel.app/api/twelvedata';
const REQUIRED_TFS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const CLOSE_GRACE_MS = 10 * 1000;
const ACTIONABLE_WATCH_STAGES = new Set([
  'WATCHING_LEVEL',
  'LEVEL_TESTING',
  'ENTRY_TRIGGERED'
]);

let refreshInFlight = null;
let lastRefreshAt = 0;
let watchRepairQueued = false;

function durationMs(tf) {
  return ({
    M1: 60_000,
    M5: 5 * 60_000,
    M15: 15 * 60_000,
    M30: 30 * 60_000,
    H1: 60 * 60_000,
    H4: 4 * 60 * 60_000,
    D1: 24 * 60 * 60_000,
    W1: 7 * 24 * 60 * 60_000
  })[String(tf || '').toUpperCase()] || 15 * 60_000;
}

function finite(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseTime(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 10_000_000_000 ? numeric : numeric / 1000;
  }
  const milliseconds = Date.parse(String(value || ''));
  return Number.isFinite(milliseconds) ? milliseconds / 1000 : 0;
}

function candleClosed(tf, openSeconds) {
  if (!Number.isFinite(openSeconds) || openSeconds <= 0) return false;
  return openSeconds * 1000 + durationMs(tf) <= Date.now() - CLOSE_GRACE_MS;
}

function normalizeCandles(tf, payload) {
  const values = Array.isArray(payload?.values) ? payload.values : [];
  return values
    .slice()
    .reverse()
    .map(value => ({
      time: parseTime(value?.datetime ?? value?.time),
      timeframe: tf,
      open: finite(value?.open),
      high: finite(value?.high),
      low: finite(value?.low),
      close: finite(value?.close),
      tickCount: Math.max(1, Math.trunc(finite(value?.volume, 1))),
      explicitLive: Boolean(value?.amyfxLiveQuote || value?.amyfxSyntheticCurrent)
    }))
    .filter(candle =>
      !candle.explicitLive
      && candleClosed(tf, candle.time)
      && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
      && candle.high >= Math.max(candle.open, candle.close, candle.low)
      && candle.low <= Math.min(candle.open, candle.close, candle.high)
    )
    .map(candle => ({ ...candle, isClosed: true }));
}

async function fetchFreshTimeframe(tf) {
  const interval = TF[tf];
  if (!interval) return null;
  const params = new URLSearchParams({
    symbol: 'XAU/USD',
    interval,
    outputsize: '300',
    amyfx_refresh: String(Math.floor(Date.now() / REFRESH_INTERVAL_MS))
  });
  const response = await fetch(`${PROXY_URL}?${params.toString()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`${tf} HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.status === 'error') throw new Error(payload.message || `${tf} provider error`);
  const candles = normalizeCandles(tf, payload);
  if (!candles.length) throw new Error(`${tf} tidak memiliki candle closed yang valid`);
  state.candles[tf] = candles;
  setCandleFetchedAt(tf, Date.now());

  if (tf === 'M1') {
    const livePrice = finite(payload?.values?.[0]?.close);
    if (Number.isFinite(livePrice) && livePrice > 0) {
      state.price = livePrice;
      state.conn = 'Connected';
      localStorage.setItem('last_price', String(livePrice));
      localStorage.setItem('last_ws_tick_at', String(Date.now()));
    }
  }

  return { tf, candles, payload };
}

function latestClosedCandleClose(tf = state.tf) {
  const latest = state.candles?.[tf]?.at(-1);
  const openMs = finite(latest?.time) * 1000;
  if (!Number.isFinite(openMs) || openMs <= 0) return null;
  return new Date(openMs + durationMs(tf)).toISOString();
}

function publishFreshMappingClock() {
  const intel = window.AmyFXIntel;
  if (!intel?.write || !intel?.read) return;
  const sourceCandleTime = latestClosedCandleClose(state.tf);
  if (!sourceCandleTime) return;
  const previous = intel.read()?.mapping || {};
  intel.write('mapping', {
    ...previous,
    timeframe: state.tf,
    sourceCandleTime,
    sourceCandleAt: sourceCandleTime,
    capturedAt: sourceCandleTime,
    analyzedAt: new Date().toISOString(),
    dataStale: false,
    source: 'LATEST_CLOSED_CANDLE'
  });
  window.AmyFXMappingConsistency?.sync?.();
  window.AmyFXBlueprintHotfix?.repairFreshnessUi?.();
}

function readWatch() {
  const fromResult = state?.result?.entryWatch;
  if (fromResult) return fromResult;
  try {
    return JSON.parse(localStorage.getItem('amy_entry_watch_state_v3') || 'null');
  } catch (_) {
    return null;
  }
}

function repairEntryWatchVisibility() {
  watchRepairQueued = false;
  const watch = readWatch();
  const actionable = Boolean(
    watch?.active
    && String(watch?.direction || 'WAIT').toUpperCase() !== 'WAIT'
    && ACTIONABLE_WATCH_STAGES.has(String(watch?.lifecycleStage || '').toUpperCase())
  );

  if (actionable) return;

  document.getElementById('amy-entry-watch-card')?.remove();
  const setupFocus = document.querySelector('.setup-focus');
  if (setupFocus) setupFocus.style.display = '';

  if (state?.result) {
    state.result.bestSetup = null;
    state.result.setups = [];
    state.result.experimentalBestSetup = null;
    state.result.experimentalSetups = [];
  }
}

function scheduleWatchRepair() {
  if (watchRepairQueued) return;
  watchRepairQueued = true;
  requestAnimationFrame(repairEntryWatchVisibility);
}

async function refreshMapping(reason = 'manual', force = false) {
  if (document.hidden) return false;
  if (refreshInFlight) return refreshInFlight;
  if (!force && Date.now() - lastRefreshAt < REFRESH_INTERVAL_MS) {
    publishFreshMappingClock();
    scheduleWatchRepair();
    return true;
  }

  refreshInFlight = (async () => {
    const results = await Promise.allSettled(REQUIRED_TFS.map(fetchFreshTimeframe));
    const currentOk = results[REQUIRED_TFS.indexOf(state.tf)]?.status === 'fulfilled';
    const m1Ok = results[0]?.status === 'fulfilled';

    if (!currentOk) {
      const error = results[REQUIRED_TFS.indexOf(state.tf)]?.reason;
      throw error instanceof Error ? error : new Error(`Gagal memperbarui ${state.tf}`);
    }

    if (m1Ok) state.conn = 'Connected';
    save();
    window.dispatchEvent(new CustomEvent('amyfx:candles-updated', {
      detail: { reason, timeframes: REQUIRED_TFS, updatedAt: Date.now() }
    }));

    await runAnalysis(state.tf);
    publishFreshMappingClock();
    scheduleWatchRepair();
    lastRefreshAt = Date.now();
    return true;
  })().catch(error => {
    console.error('Amy FX mapping freshness repair failed', error);
    scheduleWatchRepair();
    return false;
  }).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function boot() {
  const app = document.getElementById('app');
  if (app && typeof MutationObserver === 'function') {
    new MutationObserver(scheduleWatchRepair).observe(app, { childList: true, subtree: true });
  }
  window.addEventListener('amyfx:entry-watch-updated', scheduleWatchRepair);
  window.addEventListener('amyfx:market-update', scheduleWatchRepair);
  window.addEventListener('focus', () => refreshMapping('focus', true));
  window.addEventListener('online', () => refreshMapping('online', true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshMapping('visible', true);
  });
  setInterval(() => refreshMapping('periodic'), REFRESH_INTERVAL_MS);
  scheduleWatchRepair();
  setTimeout(() => refreshMapping('startup', true), 250);
}

window.AmyFXMappingRuntimeRepair = Object.freeze({
  version: '3.0.0',
  refresh: refreshMapping,
  publishFreshMappingClock,
  repairEntryWatchVisibility,
  latestClosedCandleClose
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
