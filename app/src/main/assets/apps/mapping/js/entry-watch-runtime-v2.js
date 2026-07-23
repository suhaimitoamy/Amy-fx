import { detectMarketConcepts } from './engine/concept-engine.js';
import { evaluateValidatedMarketContext } from './engine/validated-market-context-balanced.js';
import {
  calculateMultiTimeframeEntryWatch,
  normalizeEntryDirection,
  ENTRY_WATCH_CONFIG
} from './engine/entry-watch-engine.js';
import {
  hardenEntryWatch,
  setupFromHardenedWatch
} from './engine/entry-watch-hardening.js';

const STORAGE_KEY = 'amy_entry_watch_state_v3';
const LEGACY_KEYS = ['amy_entry_watch_state_v1', 'amy_entry_watch_state_v2'];
const NOTIFY_KEY = 'amy_entry_watch_notified_v3';
const CARD_ID = 'amy-entry-watch-card';
const WATCH_TFS = ['M5', 'M15', 'H1', 'H4'];
const FORECAST_TFS = ['M15', 'H1', 'M5'];
const SYNC_MS = 3000;

let previous = readJson(STORAGE_KEY, null);
let lastSignature = '';
let lastScannerKey = '';
let lastAnalysisKey = '';
let cachedConcepts = {};
let cachedForecast = null;
let syncRunning = false;

if (!previous) LEGACY_KEYS.forEach(key => {
  try { localStorage.removeItem(key); } catch (_) {}
});

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; } catch (_) { return fallback; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

function finite(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function price(value) {
  const number = finite(value);
  return Number.isFinite(number) ? number.toFixed(2) : '-';
}

function lastCandle(tf, state) {
  return state?.candles?.[tf]?.at(-1) || null;
}

function candleAnalysisKey(state) {
  const parts = [...new Set([...WATCH_TFS, ...FORECAST_TFS, 'D1', 'W1'])].map(tf => {
    const candle = lastCandle(tf, state);
    return `${tf}:${state?.candles?.[tf]?.length || 0}:${candle?.time || 0}:${candle?.close || 0}`;
  });
  return `${Boolean(state?.result?.dataStale)}|${parts.join('|')}`;
}

function activeForecastFor(tf, state) {
  const candles = state?.candles?.[tf] || [];
  if (candles.length < 100) return null;
  const context = evaluateValidatedMarketContext({
    candles,
    tf,
    htfCandles: { H4: state?.candles?.H4 || [] }
  });
  const forecast = context?.directionForecast;
  if (!forecast?.active || forecast.invalidated || forecast.expired) return null;
  const direction = normalizeEntryDirection(forecast.direction);
  return direction === 'WAIT' ? null : { tf, direction, context, forecast };
}

function resolveForecast(state) {
  if (!state?.result || state.result.dataStale) return null;
  const currentTf = FORECAST_TFS.includes(state.tf) ? state.tf : null;
  if (currentTf) {
    const current = activeForecastFor(currentTf, state);
    if (current) return current;
  }
  const active = FORECAST_TFS.map(tf => activeForecastFor(tf, state)).filter(Boolean);
  const directions = [...new Set(active.map(item => item.direction))];
  if (directions.length !== 1) return null;
  return active.find(item => item.tf === 'M15')
    || active.find(item => item.tf === 'H1')
    || active[0]
    || null;
}

function conceptsForTimeframes(state) {
  const htfCandles = {
    H4: state?.candles?.H4 || [],
    D1: state?.candles?.D1 || [],
    W1: state?.candles?.W1 || []
  };
  const currentPrice = finite(state?.price, finite(state?.result?.price));
  const output = {};
  for (const tf of WATCH_TFS) {
    const candles = state?.candles?.[tf] || [];
    if (candles.length < 30) continue;
    try {
      output[tf] = detectMarketConcepts(candles, {
        tf,
        currentPrice,
        htfCandles,
        htfBias: 'NEUTRAL'
      });
    } catch (_) {}
  }
  return output;
}

function updateAnalysisCache(state) {
  const key = candleAnalysisKey(state);
  if (key === lastAnalysisKey) return;
  lastAnalysisKey = key;
  cachedConcepts = conceptsForTimeframes(state);
  cachedForecast = resolveForecast(state);
}

function attachToResult(state, watch, forecast) {
  const result = state?.result;
  if (!result) return;
  if (result.entryMap && !result.legacyEntryMap) result.legacyEntryMap = result.entryMap;
  if (result.entryMap) {
    result.entryMap = {
      ...result.entryMap,
      setup: null,
      activeSetup: null,
      status: 'REPLACED_BY_MULTI_TF_LEVEL_WATCH_V2'
    };
  }
  result.experimentalBestSetup = null;
  result.experimentalSetups = [];
  if (forecast?.context) {
    result.validatedMarketContext = forecast.context;
    result.validatedMarketState = forecast.context.marketState;
    result.validatedDirectionForecast = forecast.context.directionForecast;
  }
  result.entryWatch = {
    ...watch,
    forecastTf: forecast?.tf || null,
    forecastConfidence: forecast?.forecast?.confidence || 0
  };
  const setup = setupFromHardenedWatch(watch);
  result.bestSetup = setup;
  result.setups = setup ? [setup] : [];
  result.directionDecision = null;
  result.setupExecution = null;
  result.mappingExplanation = null;
  if (setup) {
    const exists = Array.isArray(state.setups)
      && state.setups.some(item => item?.watchId === setup.watchId && item?.timestamp === setup.timestamp);
    if (!exists) state.setups = [setup, ...(state.setups || [])].slice(0, 50);
  }
}

function dataStaleWatch() {
  return {
    ...(previous || {}),
    version: '1.2.0',
    model: 'AMY_MULTI_TF_LEVEL_WATCH_HARDENED',
    direction: previous?.direction || 'WAIT',
    status: 'DATA USANG — ENTRY WATCH DINONAKTIFKAN',
    lifecycleStage: 'DATA_STALE',
    active: false,
    terminal: true,
    entryAllowed: false,
    reason: 'Cache kedaluwarsa dan API gagal diperbarui. Tidak ada entry atau scanner aktif.',
    updatedAt: Date.now()
  };
}

function notificationData(watch) {
  if (watch.lifecycleStage === 'ENTRY_TRIGGERED') return {
    title: `AMY FX — ENTRY ${watch.direction}`,
    body: `${watch.triggerTf} sweep ${price(watch.level)} disahkan saat candle ditutup. Level berasal dari ${watch.sourceTf} ${watch.sourceLabel}.`
  };
  if (watch.lifecycleStage === 'VALID_BREAK') return {
    title: `AMY FX — ${watch.direction} BATAL`,
    body: `${watch.sourceTf} close menembus ${price(watch.level)}. ${watch.transitionText || 'Level berubah fungsi'}.`
  };
  if (watch.lifecycleStage === 'FORECAST_PAUSED') return {
    title: 'AMY FX — ENTRY WATCH DI-PAUSE',
    body: 'Forecast tidak aktif. BUY/SELL lama sudah dinonaktifkan.'
  };
  if (watch.lifecycleStage === 'ENTRY_SPENT') return {
    title: 'AMY FX — LEVEL SUDAH DIPAKAI',
    body: `${watch.sourceTf} ${watch.sourceLabel} sudah menghasilkan satu entry.`
  };
  if (['LEVEL_EXPIRED', 'LEVEL_RETIRED', 'FORECAST_CHANGED'].includes(watch.lifecycleStage)) return {
    title: 'AMY FX — LEVEL DITUTUP',
    body: watch.reason || 'Level lama tidak lagi sah untuk entry.'
  };
  return {
    title: `AMY FX — PANTAU ${watch.direction}`,
    body: `${watch.sourceTf} ${watch.sourceLabel} di ${price(watch.level)}. Trigger: sweep ${watch.triggerTf} lalu close kembali.`
  };
}

function sendNotification(watch) {
  const allowed = new Set([
    'WATCHING_LEVEL',
    'ENTRY_TRIGGERED',
    'VALID_BREAK',
    'FORECAST_PAUSED',
    'ENTRY_SPENT',
    'LEVEL_EXPIRED',
    'LEVEL_RETIRED',
    'FORECAST_CHANGED'
  ]);
  if (!allowed.has(watch?.lifecycleStage)) return;
  const store = readJson(NOTIFY_KEY, {});
  const key = `${watch.id || 'WAIT'}:${watch.lifecycleStage}:${watch.sourceCandleTime || 0}:${watch.triggerCandleTime || 0}`;
  if (store[key]) return;
  store[key] = Date.now();
  writeJson(
    NOTIFY_KEY,
    Object.fromEntries(Object.entries(store).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 80))
  );
  const data = notificationData(watch);
  const route = `${location.href.split('#')[0]}#Analyze`;
  if (window.Android?.showNotificationWithUrl) {
    window.Android.showNotificationWithUrl(data.title, data.body, route);
  } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const notification = new Notification(data.title, {
      body: data.body,
      tag: `amy-entry-watch-${watch.id || watch.lifecycleStage}`
    });
    notification.onclick = () => {
      window.focus();
      window.setTab?.('Analyze');
    };
  }
}

function syncScanner(watch) {
  if (!window.Android?.startBackgroundScanner) return;
  const shouldScan = Boolean(
    watch?.active
    && !watch.entryAllowed
    && ['WATCHING_LEVEL', 'LEVEL_TESTING'].includes(watch.lifecycleStage)
  );
  if (!shouldScan) {
    if (lastScannerKey !== 'NONE') {
      lastScannerKey = 'NONE';
      window.Android?.stopBackgroundScanner?.();
    }
    return;
  }
  const upper = watch.direction === 'SELL' ? watch.level : 0;
  const lower = watch.direction === 'BUY' ? watch.level : 0;
  const key = `${watch.id}:${watch.direction}:${price(watch.level)}`;
  if (key === lastScannerKey) return;
  lastScannerKey = key;
  window.Android.startBackgroundScanner('amyfx-proxy', String(upper), String(lower));
}

function statusClass(watch) {
  if (watch.lifecycleStage === 'ENTRY_TRIGGERED') return 'entry';
  if (watch.lifecycleStage === 'LEVEL_TESTING') return 'testing';
  if ([
    'VALID_BREAK',
    'ENTRY_SPENT',
    'LEVEL_EXPIRED',
    'LEVEL_RETIRED',
    'FORECAST_CHANGED',
    'DATA_STALE'
  ].includes(watch.lifecycleStage)) return 'break';
  return 'watch';
}

function actionText(watch) {
  if (watch.lifecycleStage === 'ENTRY_TRIGGERED') return `ENTRY ${watch.direction}`;
  if (watch.lifecycleStage === 'VALID_BREAK') return `BATAL ${watch.direction}`;
  if (watch.lifecycleStage === 'FORECAST_PAUSED') return 'PAUSE';
  if (watch.lifecycleStage === 'ENTRY_SPENT') return 'ENTRY SPENT';
  if ([
    'LEVEL_EXPIRED',
    'LEVEL_RETIRED',
    'FORECAST_CHANGED',
    'DATA_STALE'
  ].includes(watch.lifecycleStage)) return 'DITUTUP';
  return `PANTAU ${watch.direction}`;
}

function lifecycleHtml(watch) {
  const stage = watch.lifecycleStage;
  const watched = !['WAIT_LEVEL', 'WAIT_DIRECTION'].includes(stage);
  const entry = stage === 'ENTRY_TRIGGERED' || stage === 'ENTRY_SPENT';
  const broken = stage === 'VALID_BREAK' || stage === 'LEVEL_RETIRED';
  const steps = [
    ['LEVEL', true, false],
    ['PANTAU', watched, false],
    ['SWEEP / ENTRY', entry, broken],
    ['SPENT', stage === 'ENTRY_SPENT', false],
    ['VALID BREAK', stage === 'VALID_BREAK', false]
  ];
  return `<div class="entry-watch-lifecycle">${steps.map(([label, active, invalid]) =>
    `<div class="${invalid ? 'invalid' : active ? 'active' : 'locked'}"><span>${invalid ? '×' : active ? '●' : '○'}</span><small>${label}</small></div>`
  ).join('')}</div>`;
}

function watchCardHtml(watch) {
  const zone = watch.bottom !== watch.top
    ? `${price(watch.bottom)}–${price(watch.top)}`
    : price(watch.level);
  const plan = watch.executionPlan?.locked
    ? `<div class="entry-watch-transition"><b>Setup dikunci saat close</b><span>Entry ${price(watch.executionPlan.entryLow)}–${price(watch.executionPlan.entryHigh)}</span><small>SL ${price(watch.executionPlan.sl)} · TP1 ${price(watch.executionPlan.tp1)} · TP2 ${price(watch.executionPlan.tp2)}</small></div>`
    : '';
  const candidates = (watch.candidates || []).slice(0, 4).map(candidate =>
    `<span>${safe(candidate.sourceTf)} ${safe(candidate.sourceKind)} · ${price(candidate.level)}</span>`
  ).join('');
  return `<section class="card entry-watch-card ${statusClass(watch)}" id="${CARD_ID}">
    <div class="entry-watch-head">
      <div><div class="kicker">MULTI-TIMEFRAME ENTRY WATCH</div><h2>${safe(watch.status)}</h2></div>
      <span class="entry-watch-badge">${safe(actionText(watch))}</span>
    </div>
    ${lifecycleHtml(watch)}
    <div class="entry-watch-grid">
      <div><small>Arah</small><strong>${safe(watch.direction)}</strong></div>
      <div><small>Level Asal</small><strong>${safe(watch.sourceTf)} · ${safe(watch.sourceLabel)}</strong></div>
      <div><small>Area / Level</small><strong>${zone}</strong></div>
      <div><small>Trigger Sweep</small><strong>${safe(watch.triggerTf)}</strong></div>
      <div><small>Entry</small><strong>Valid saat candle trigger sudah close</strong></div>
      <div><small>Batal</small><strong>Close ${safe(watch.sourceTf)} menembus ${price(watch.level)}</strong></div>
    </div>
    <p class="entry-watch-reason">${safe(watch.reason)}</p>
    ${plan}
    ${candidates ? `<details class="entry-watch-candidates"><summary>Level berikutnya</summary>${candidates}</details>` : ''}
    <div class="entry-watch-footnote">${safe(ENTRY_WATCH_CONFIG.entryRule)} · DATA DARI MAPPING</div>
  </section>`;
}

function hideLegacyCards(show) {
  const setupFocus = document.querySelector('.setup-focus');
  if (setupFocus) setupFocus.style.display = show ? 'none' : '';
  document.querySelectorAll('#app > section.card').forEach(section => {
    if (section.id === CARD_ID) return;
    if (section.querySelector('.kicker')?.textContent?.trim() === 'AMY FX DECISION') {
      section.style.display = show ? 'none' : '';
    }
  });
}

function syncCard(watch) {
  const existing = document.getElementById(CARD_ID);
  const visible = watch
    && watch.direction !== 'WAIT'
    && !['WAIT_DIRECTION', 'WAIT_LEVEL'].includes(watch.lifecycleStage);
  hideLegacyCards(Boolean(visible));
  if (!visible) {
    existing?.remove();
    return;
  }
  const app = document.getElementById('app');
  if (!app) return;
  const anchor = window.state?.tab === 'Dashboard'
    ? app.querySelector('.tf-card')
    : app.querySelector(':scope > .card');
  if (!anchor) return;
  const html = watchCardHtml(watch);
  if (existing) {
    if (existing.outerHTML !== html) existing.outerHTML = html;
  } else {
    anchor.insertAdjacentHTML('afterend', html);
  }
}

function signatureOf(watch, forecast) {
  return JSON.stringify({
    id: watch?.id,
    stage: watch?.lifecycleStage,
    status: watch?.status,
    level: watch?.level,
    sourceCandleTime: watch?.sourceCandleTime,
    triggerCandleTime: watch?.triggerCandleTime,
    entryConfirmedAt: watch?.entryConfirmedAt,
    direction: watch?.direction,
    transformed: watch?.transformed?.id,
    forecastTf: forecast?.tf
  });
}

function persistAndRender(state, watch, forecast) {
  if (!watch) return;
  const signature = signatureOf(watch, forecast);
  attachToResult(state, watch, forecast);
  previous = watch;
  if (signature !== lastSignature) {
    lastSignature = signature;
    writeJson(STORAGE_KEY, watch);
    syncScanner(watch);
    sendNotification(watch);
    window.dispatchEvent(new CustomEvent('amyfx:entry-watch-updated', {
      detail: { watch, forecastTf: forecast?.tf || null }
    }));
  }
  syncCard(watch);
}

function sync() {
  if (syncRunning) return;
  syncRunning = true;
  try {
    const state = window.state;
    if (!state?.result) {
      syncCard(null);
      return;
    }
    if (state.result.dataStale) {
      persistAndRender(state, dataStaleWatch(), null);
      return;
    }
    updateAnalysisCache(state);
    const direction = cachedForecast?.direction || 'WAIT';
    const rawWatch = calculateMultiTimeframeEntryWatch({
      conceptsByTf: cachedConcepts,
      candlesByTf: state.candles,
      direction,
      currentPrice: finite(state.price, state.result.price),
      previous
    });
    const watch = hardenEntryWatch({
      watch: rawWatch,
      conceptsByTf: cachedConcepts,
      direction
    });
    persistAndRender(state, watch, cachedForecast);
  } finally {
    syncRunning = false;
  }
}

function start() {
  sync();
  setInterval(sync, SYNC_MS);
  window.addEventListener('amyfx:candles-updated', () => {
    lastAnalysisKey = '';
    sync();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      lastAnalysisKey = '';
      sync();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
