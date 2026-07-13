import { state, p2 } from './main.js';
import {
  detectIndicatorZones,
  zoneLiveStatus
} from './zones/indicator-zones.js';

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4'];
const cache = new Map();
let patching = false;
let timer = 0;
let observer = null;

function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function candleSignature(candles) {
  const list = Array.isArray(candles) ? candles : [];
  const last = list.at(-1);
  return `${list.length}:${last?.time || 0}:${last?.close || 0}`;
}

function zonesFor(tf) {
  const candles = state.candles?.[tf] || [];
  const signature = candleSignature(candles);
  const cached = cache.get(tf);
  if (cached?.signature === signature && cached.price === Number(state.price || 0)) {
    return cached.zones;
  }
  const zones = detectIndicatorZones(candles, Number(state.price || 0), {
    orderBlocks: {
      swingLength: 10,
      useBody: true,
      visiblePerDirection: 1,
      lookback: 1000
    },
    fairValueGaps: {
      bodyLength: 5,
      wickBodyRatio: 0.36,
      visiblePerDirection: 2,
      lookback: 500
    }
  });
  cache.set(tf, { signature, price: Number(state.price || 0), zones });
  return zones;
}

function distanceText(zone) {
  if (!Number.isFinite(zone?.distance)) return '';
  if (zone.distance === 0) return 'Harga berada di dalam zona';
  return `Jarak ${p2(zone.distance)}`;
}

function zoneItem(zone) {
  const status = zoneLiveStatus(zone, state.price);
  const kind = zone.kind === 'ORDER_BLOCK' ? 'OB' : 'FVG';
  const statusClass = status.includes('INVALID') ? 'invalid'
    : status.includes('DIUJI') ? 'testing'
      : status.includes('BREAKER') ? 'breaker' : 'waiting';
  return `<div class="indicator-zone-item ${String(zone.type).toLowerCase()} ${statusClass}">
    <div class="indicator-zone-main">
      <b>${safeText(zone.type)} ${kind} · ${p2(zone.bottom)}–${p2(zone.top)}</b>
      <span>${safeText(zone.status || 'ACTIVE')} · ${safeText(status)}</span>
    </div>
    <small>${safeText(distanceText(zone))}</small>
  </div>`;
}

function zoneListMarkup(kind, zones) {
  const title = kind === 'ORDER_BLOCK' ? 'Order Block' : 'Fair Value Gap';
  if (!zones.length) {
    return `<div class="indicator-zone-group empty"><small>${title}</small><p>Belum ada zona valid menurut aturan indikator pada candle yang tersedia.</p></div>`;
  }
  return `<div class="indicator-zone-group"><small>${title} terdekat</small>${zones.map(zoneItem).join('')}</div>`;
}

function patchIntegrityRow(row) {
  const tf = row.querySelector('.integrity-row-head .tf, :scope > .tf')?.textContent?.trim();
  if (!TIMEFRAMES.includes(tf)) return;
  const target = row.querySelector('.integrity-zone-grid');
  if (!target) return;
  const zones = zonesFor(tf);
  const signature = JSON.stringify({
    price: Number(state.price || 0).toFixed(2),
    ob: zones.nearestOrderBlocks.map(item => [item.type, item.bottom, item.top, item.status]),
    fvg: zones.nearestFairValueGaps.map(item => [item.type, item.bottom, item.top, item.status])
  });
  if (target.dataset.indicatorZoneSignature === signature) return;
  target.dataset.indicatorZoneSignature = signature;
  target.classList.add('indicator-zone-grid');
  target.innerHTML = `${zoneListMarkup('ORDER_BLOCK', zones.nearestOrderBlocks)}${zoneListMarkup('FVG', zones.nearestFairValueGaps)}`;
}

function compactZone(zone) {
  if (!zone) return 'Belum ada zona valid';
  return `${zone.type} ${p2(zone.bottom)}–${p2(zone.top)} · ${zoneLiveStatus(zone, state.price)}`;
}

function patchLegacyTable() {
  document.querySelectorAll('.map-table tbody tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    const tf = cells[0]?.textContent?.trim();
    if (!TIMEFRAMES.includes(tf) || cells.length < 6) return;
    const zones = zonesFor(tf);
    const obText = zones.nearestOrderBlocks.map(compactZone).join('<br>') || 'Belum ada zona valid';
    const fvgText = zones.nearestFairValueGaps.map(compactZone).join('<br>') || 'Belum ada zona valid';
    if (cells[4].dataset.indicatorZoneText !== obText) {
      cells[4].dataset.indicatorZoneText = obText;
      cells[4].innerHTML = obText;
    }
    if (cells[5].dataset.indicatorZoneText !== fvgText) {
      cells[5].dataset.indicatorZoneText = fvgText;
      cells[5].innerHTML = fvgText;
    }
  });
}

function patchExplanation() {
  const result = state.result;
  if (!result) return;
  const zones = zonesFor(result.tf || state.tf || 'M15');
  result.mappingZones = zones;

  const target = [...document.querySelectorAll('.integrity-explanation-body p')]
    .find(item => item.textContent.trim().startsWith('4. Likuiditas dan zona'));
  if (!target) return;

  const draw = result.liquidityHierarchy?.drawTarget;
  const liquidity = draw
    ? `${draw.type} ${p2(draw.level)} masih menjadi target liquidity aktif.`
    : 'Belum ada target BSL/SSL aktif yang jelas.';
  const ob = zones.nearestOrderBlocks.map(compactZone).join('<br>') || 'Belum ada OB valid pada candle yang tersedia.';
  const fvg = zones.nearestFairValueGaps.map(compactZone).join('<br>') || 'Belum ada FVG valid pada candle yang tersedia.';
  const html = `<b>4. Likuiditas dan zona</b><br>${safeText(liquidity)}<br><b>OB terdekat:</b><br>${ob}<br><b>FVG terdekat:</b><br>${fvg}`;
  if (target.dataset.indicatorZoneExplanation === html) return;
  target.dataset.indicatorZoneExplanation = html;
  target.innerHTML = html;
}

function patchAll() {
  if (patching || state.tab !== 'Analyze') return;
  patching = true;
  try {
    document.querySelectorAll('.integrity-map-row').forEach(patchIntegrityRow);
    patchLegacyTable();
    patchExplanation();
  } finally {
    patching = false;
  }
}

function boot() {
  patchAll();
  clearInterval(timer);
  timer = setInterval(patchAll, 900);
  const app = document.getElementById('app');
  if (app) {
    observer?.disconnect();
    observer = new MutationObserver(() => queueMicrotask(patchAll));
    observer.observe(app, { childList: true, subtree: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) patchAll();
  });
}

window.AmyIndicatorZones = {
  detect: tf => zonesFor(tf || state.tf),
  refresh: patchAll,
  source: 'ICT Concepts [amygmgo]'
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
