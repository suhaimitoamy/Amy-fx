import "./bridge/sync-fix.js";
import "./bridge/notify-guard.js";
import {
  runAnalysis,
  connect,
  isLivePriceRunning,
  lastWsTickAt
} from './api/market-data.js';
import { fmtDir } from './ui/ui-render.js';
import {
  render,
  applyAmyFxRoute,
  analyzeActiveSetups
} from './ui/ui-render.js';
import {
  saveConnect,
  toggleBg,
  testNotif,
  downloadLogs
} from './bridge/android-bridge.js';

export const TF = {
  M1: '1min',
  M5: '5min',
  M15: '15min',
  M30: '30min',
  H1: '1h',
  H4: '4h',
  D1: '1day',
  W1: '1week'
};

export const state = {
  tab: 'Dashboard',
  tf: 'M15',
  key: '',
  price: Number(localStorage.getItem('last_price') || 0),
  conn: 'Offline',
  logs: JSON.parse(localStorage.getItem('amy_mapping_logs') || '[]'),
  analyses: JSON.parse(localStorage.getItem('amy_mapping_analyses') || '[]'),
  setups: JSON.parse(localStorage.getItem('amy_mapping_setups') || '[]'),
  candles: {},
  result: null,
  bg: true,
  notified: JSON.parse(localStorage.getItem('amy_mapping_notified') || '{}')
};

const DISPLAY_TIME_ZONE = 'Asia/Makassar';
const PREVIEW_UPDATE_ID = 'amyfx-preview-update';

export const p2 = value =>
  Number.isFinite(+value) ? Number(value).toFixed(2) : '-';

export function nowTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());
}

export function timeRange(zone, sh, sm, eh, em) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = type => +parts.find(item => item.type === type).value;
  const guess = Date.UTC(get('year'), get('month') - 1, get('day'), sh, sm);
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(guess));
  const [hh, mm] = text.split(':').map(Number);
  const start = guess + ((sh * 60 + sm) - (hh * 60 + mm)) * 60000;
  const end = start + (
    (eh * 60 + em) - (sh * 60 + sm) +
    (eh * 60 + em <= sh * 60 + sm ? 1440 : 0)
  ) * 60000;
  return { start, end };
}

export function sessions() {
  const zones = [
    ['Asian Kill Zone', 'Asia/Tokyo', 9, 0, 12, 0],
    ['London Judas Swing', 'Europe/London', 7, 0, 8, 30],
    ['London Open Kill Zone', 'Europe/London', 8, 0, 12, 0],
    ['New York Judas Swing', 'America/New_York', 8, 0, 9, 30],
    ['New York Open Kill Zone', 'America/New_York', 8, 30, 11, 30],
    ['Silver Bullet', 'America/New_York', 10, 0, 11, 0],
    ['Swing Session', 'America/New_York', 13, 30, 16, 0]
  ];
  const now = Date.now();
  return zones.map(item => {
    const range = timeRange(...item.slice(1));
    const format = timestamp => new Intl.DateTimeFormat('en-GB', {
      timeZone: DISPLAY_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(timestamp));
    const displayRange = `${format(range.start)} - ${format(range.end)}`;
    return {
      name: item[0],
      active: now >= range.start && now < range.end,
      wita: displayRange,
      wib: displayRange
    };
  });
}

export function curSession() {
  return sessions().find(item => item.active) ||
    { name: 'Off-Session', active: false, wita: '-', wib: '-' };
}

export function log(message) {
  state.logs = [`[${nowTime()}] ${message}`, ...state.logs].slice(0, 200);
  save();
  try { render(); } catch (_) {}
}

export function save() {
  localStorage.setItem('amy_mapping_logs', JSON.stringify(state.logs.slice(0, 200)));
  localStorage.setItem('amy_mapping_analyses', JSON.stringify(state.analyses.slice(0, 80)));
  localStorage.setItem('amy_mapping_setups', JSON.stringify(state.setups.slice(0, 50)));
  localStorage.setItem('bg_scanner', 'true');
}

export function setupText(execution, result = state.result) {
  if (!execution) return 'Belum ada setup tervalidasi.';

  const explanation = result?.mappingExplanation;
  if (!execution.active) {
    return `Status: ${execution.status || 'TUNGGU'}\n${execution.invalidationReason || explanation?.reason || 'Belum ada setup aktif.'}`;
  }

  const targetText = execution.singleTarget
    ? `Target: ${p2(execution.target1)}`
    : `TP1: ${p2(execution.target1)}\nTP2: ${p2(execution.target2)}`;

  return `${fmtDir(execution.direction)} • ${result?.tf || state.tf}
Status: ${execution.status}
Area rencana: ${p2(execution.entryLow)} - ${p2(execution.entryHigh)}
Batas salah: ${p2(execution.stopLoss)}
${targetText}
${explanation?.action || 'Ikuti lifecycle setup; jangan mengejar harga.'}`;
}

function setTab(tab) {
  state.tab = tab;
  localStorage.setItem('amy_mapping_tab', tab);
  render();
  syncAutomaticScannerUi();
}

window.setTab = setTab;
window.runAnalysis = runAnalysis;
window.render = render;
window.analyzeActiveSetups = analyzeActiveSetups;
window.saveConnect = saveConnect;
window.toggleBg = toggleBg;
window.testNotif = testNotif;
window.downloadLogs = downloadLogs;
window.state = state;
window.TF = TF;

function autoConnectLivePrice() {
  if (!isLivePriceRunning()) connect();
}

function livePriceWatchdog() {
  const stale = !lastWsTickAt || Date.now() - lastWsTickAt > 45000;
  if (!isLivePriceRunning() || state.conn === 'Offline' || stale) connect();
}

function mountPreviewUpdateBadge() {
  if (document.getElementById(PREVIEW_UPDATE_ID)) return;
  const badge = document.createElement('div');
  badge.id = PREVIEW_UPDATE_ID;
  badge.textContent = 'UPDATE · AMY FX v1.5 PREVIEW';
  badge.setAttribute('aria-label', 'Amy FX preview sudah memakai update terbaru');
  Object.assign(badge.style, {
    position: 'fixed',
    top: '10px',
    right: '10px',
    zIndex: '99999',
    padding: '7px 10px',
    borderRadius: '999px',
    border: '1px solid rgba(255, 196, 0, .55)',
    background: 'rgba(20, 16, 4, .94)',
    color: '#ffd45a',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: '.08em',
    boxShadow: '0 8px 24px rgba(0, 0, 0, .35)',
    pointerEvents: 'none'
  });
  document.body.appendChild(badge);
}

function syncAutomaticScannerUi() {
  const button = document.querySelector('[data-scanner-status]');
  const buttonText = '📡 Scanner mengikuti setup tervalidasi';
  if (button) {
    if (button.textContent !== buttonText) button.textContent = buttonText;
    if (!button.classList.contains('action')) button.className = 'action';
  }

  const settings = document.querySelector('.settings');
  if (!settings) return;

  const helpText =
    'Harga live, snapshot Mapping, scanner, dan notifikasi memakai kontrak setupExecution yang sama.';
  const help = settings.querySelector('p.muted');
  if (help && help.textContent !== helpText) help.textContent = helpText;

  const warningHtml =
    '<b>Monitor Tervalidasi</b><br>Scanner hanya aktif ketika setupExecution M15 masih aktif, searah forecast, dan belum terminal.';
  const warning = settings.querySelector('.warn');
  if (warning && warning.innerHTML !== warningHtml) warning.innerHTML = warningHtml;
}

export function pruneStorage() {
  try {
    state.logs = state.logs.slice(0, 100);
    state.analyses = state.analyses.slice(0, 30);
    state.setups = state.setups.slice(0, 30);
    save();

    const keysToClean = ['amy_mapping_tmp', 'amy_test_cache', 'amy_debug_log'];
    keysToClean.forEach(key => localStorage.removeItem(key));
  } catch (_) {}
}

function initApp() {
  try { localStorage.removeItem('twelve_api_key'); } catch (_) {}
  pruneStorage();

  document.querySelectorAll('.nav button')
    .forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));

  window.AmyFXIntel?.mountStrip(document.getElementById('mapping-command-strip'));
  window.AmyFXIntel?.mountBriefing(document.getElementById('intel-briefing'));
  applyAmyFxRoute();
  render();
  syncAutomaticScannerUi();
  mountPreviewUpdateBadge();

  setTimeout(autoConnectLivePrice, 600);
  setInterval(livePriceWatchdog, 30000);
  document.addEventListener(
    'visibilitychange',
    () => document.body.classList.toggle('webview-idle', document.hidden)
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
