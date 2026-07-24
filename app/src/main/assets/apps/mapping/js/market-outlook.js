import { state, p2 } from './main.js';
import { buildTradeScenarios } from './outlook/trade-scenario-core.js';

const OPEN_KEY = 'amy_mapping_outlook_open';
const SUMMARY_TITLE = 'Saran Level';
let lastSignature = '';
let lastResult = null;
let lastPublishSignature = '';
let timer = 0;

function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function priceText(value) {
  return Number.isFinite(Number(value)) ? p2(value) : '—';
}

function currentTab() {
  return state?.tab || localStorage.getItem('amy_mapping_tab') || '';
}

function qualityState(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value.state || value.status || value.label || '');
}

function isM5Stale() {
  if (state?.result?.dataStale) return true;
  const connection = String(document.getElementById('conn')?.textContent || '').toUpperCase();
  if (connection.includes('STALE') || connection.includes('DATA USANG')) return true;
  const quality = window.AmyMappingIntegrity?.qualityByInterval || {};
  const item = quality['5min'] || quality.M5 || quality.m5;
  const status = qualityState(item).toUpperCase();
  return status.includes('STALE') || status.includes('USANG');
}

function expiryText(result) {
  const source = Number(result?.sourceTime || result?.generatedAt || Date.now());
  const expiresAt = source + Number(result?.validityBars || 0) * 5 * 60 * 1000;
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Makassar',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(expiresAt));
}

function statusText(scenario) {
  return ({
    READY_ENTRY: 'SIAP ENTRY',
    ENTRY_TOUCHED: 'ENTRY TERSENTUH',
    WAIT_ZONE_TOUCH: 'MENUNGGU FIRST TOUCH',
    WAIT_CONFIRMATION: 'MENUNGGU REJECTION M5',
    OCO_CANCELLED: 'DIBATALKAN OCO'
  })[scenario?.status] || 'PANTAU';
}

function entryText(scenario) {
  if (scenario.status === 'WAIT_ZONE_TOUCH') {
    return `zona ${priceText(scenario.zoneLow)}–${priceText(scenario.zoneHigh)}`;
  }
  if (scenario.status === 'WAIT_CONFIRMATION') {
    return `50% FVG ${priceText(scenario.entry)} · belum aktif`;
  }
  if (scenario.status === 'OCO_CANCELLED') return 'dibatalkan karena sisi lain aktif';
  return `${priceText(scenario.entry)} · 50% fresh FVG M5`;
}

function scenarioCopyText(scenario, result) {
  const title = scenario.side === 'BUY' ? 'Skenario Buy' : 'Skenario Sell';
  const rows = [
    title,
    `Status ${statusText(scenario)}`,
    `Zona FVG ${priceText(scenario.zoneLow)} - ${priceText(scenario.zoneHigh)}`,
    `Entry ${entryText(scenario)}`
  ];
  if (Number.isFinite(Number(scenario.stopLoss))) rows.push(`Stop Loss ${priceText(scenario.stopLoss)}`);
  if (Number.isFinite(Number(scenario.takeProfit1))) rows.push(`Take Profit 1 ${priceText(scenario.takeProfit1)} (1:${scenario.riskReward1.toFixed(1)})`);
  if (Number.isFinite(Number(scenario.takeProfit2))) rows.push(`Take Profit 2 ${priceText(scenario.takeProfit2)} (1:${scenario.riskReward2.toFixed(1)})`);
  if (Number.isFinite(Number(scenario.liquidityTarget))) rows.push(`Liquidity tujuan ${priceText(scenario.liquidityTarget)}`);
  rows.push(`Berlaku sampai ${expiryText(result)} WITA`);
  rows.push(`Alasan: ${scenario.reason}`);
  return rows.join('\n');
}

function scenarioCard(scenario, result) {
  const buy = scenario.side === 'BUY';
  const title = buy ? 'Skenario Buy' : 'Skenario Sell';
  const concrete = Number.isFinite(Number(scenario.stopLoss));
  const grade = safeText(scenario.quality || 'WATCH');
  return `<article class="amy-level-card ${buy ? 'buy' : 'sell'}">
    <h3><span>${buy ? '↗' : '↘'}</span>${title}</h3>
    <div class="amy-level-grid">
      <span>Status</span><strong>${safeText(statusText(scenario))}</strong>
      <span>Kualitas</span><strong>Grade ${grade}</strong>
      <span>Zona FVG M5</span><strong>${priceText(scenario.zoneLow)}–${priceText(scenario.zoneHigh)}</strong>
      <span>Entry</span><strong>${safeText(entryText(scenario))}</strong>
      ${concrete ? `<span>Stop Loss</span><strong class="loss">${priceText(scenario.stopLoss)}</strong>
      <span>Take Profit 1</span><strong class="profit">${priceText(scenario.takeProfit1)}</strong>
      <span>Take Profit 2</span><strong class="profit">${priceText(scenario.takeProfit2)}</strong>
      <span>Liquidity tujuan</span><strong>${priceText(scenario.liquidityTarget)}</strong>
      <span>Risk : Reward</span><strong>TP1 1:${scenario.riskReward1.toFixed(1)} · TP2 1:${scenario.riskReward2.toFixed(1)}</strong>` : ''}
    </div>
    <p><b>Alasan:</b> ${safeText(scenario.reason)}</p>
    <button type="button" class="amy-copy-level" data-copy-levels="${safeText(scenarioCopyText(scenario, result))}"><span>▣</span> Salin level</button>
  </article>`;
}

function waitingMarkup({ stale, result }) {
  const message = stale
    ? 'Data M5 sedang usang. Seluruh saran level ditahan sampai candle live kembali tersedia.'
    : result.message || `Candle M5 belum cukup untuk menghitung setup (${result.availableBars || 0}/${result.requiredBars || 64}).`;
  return `<section class="amy-level-panel waiting">
    <p class="amy-level-intro">M5 Reaction First: fresh FVG → first touch → rejection M5 → entry 50% zona.</p>
    <div class="amy-level-waiting">${safeText(message)}</div>
  </section>`;
}

function panelMarkup(result) {
  return `<section class="amy-level-panel">
    <p class="amy-level-intro">M5 Reaction First: fresh FVG → first touch → rejection M5 → entry 50% zona. Skenario dengan sweep liquidity diberi Grade A.</p>
    <div class="amy-level-cards">${result.scenarios.map(item => scenarioCard(item, result)).join('')}</div>
    <p class="amy-level-disclaimer">Entry belum aktif hanya karena harga menyentuh zona. Amy menunggu rejection M5, risiko 0,60–4,00 poin, dan ruang menuju liquidity kuat minimal 2R. TP1 1:1,5 · TP2 1:2.</p>
  </section>`;
}

function summaryMarkup() {
  return `<span class="amy-level-summary-title"><i>◎</i><b>${SUMMARY_TITLE}</b></span><span class="amy-level-summary-status">PANTAU</span>`;
}

function ensureDisclosure() {
  const app = document.getElementById('app');
  if (!app || currentTab() !== 'Analyze' || !state.result) return null;
  let details = app.querySelector('.outlook-disclosure');
  if (!details) {
    details = document.createElement('details');
    details.className = 'card disclosure outlook-disclosure';
    details.dataset.stabilityKey = 'market-outlook';
    details.open = localStorage.getItem(OPEN_KEY) !== 'false';
    details.innerHTML = `<summary class="amy-level-summary">${summaryMarkup()}</summary><div class="amy-trade-scenario-panel" data-amy-level-panel="true"></div>`;
    details.addEventListener('toggle', () => localStorage.setItem(OPEN_KEY, String(details.open)));
    const validBreak = [...app.querySelectorAll('details.disclosure')]
      .find(item => item.querySelector(':scope > summary')?.textContent.trim().startsWith('Valid Break'));
    if (validBreak) app.insertBefore(details, validBreak);
    else app.appendChild(details);
  }
  details.dataset.stabilityKey = 'market-outlook';
  let summary = details.querySelector(':scope > summary');
  if (!summary) {
    summary = document.createElement('summary');
    details.prepend(summary);
  }
  summary.className = 'amy-level-summary';
  if (!summary.querySelector('.amy-level-summary-title')) summary.innerHTML = summaryMarkup();
  let panel = details.querySelector('.amy-trade-scenario-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'amy-trade-scenario-panel';
    details.appendChild(panel);
  }
  panel.dataset.amyLevelPanel = 'true';
  return { details, summary, panel };
}

function setSummaryState(summary, { stale, result }) {
  if (!summary) return;
  const badge = summary.querySelector('.amy-level-summary-status');
  if (!badge) return;
  const active = result.scenarios?.some(item => item.status === 'ENTRY_TOUCHED');
  const ready = result.scenarios?.some(item => item.status === 'READY_ENTRY');
  const text = stale ? 'DATA USANG' : active ? 'AKTIF' : ready ? 'SIAP' : result.scenarios?.length ? 'PANTAU' : 'WAIT';
  if (badge.textContent !== text) badge.textContent = text;
  badge.classList.toggle('stale', stale);
  badge.classList.toggle('ready', (active || ready) && !stale);
  badge.classList.toggle('waiting', !active && !ready && !stale);
}

function signature(result, stale) {
  return JSON.stringify({
    tab: currentTab(),
    stale,
    status: result.status,
    sourceTime: result.sourceTime,
    scenarios: (result.scenarios || []).map(item => ({
      side: item.side,
      status: item.status,
      entry: Number(item.entry || 0).toFixed(2),
      stop: Number(item.stopLoss || 0).toFixed(2),
      zoneLow: Number(item.zoneLow || 0).toFixed(2),
      zoneHigh: Number(item.zoneHigh || 0).toFixed(2)
    }))
  });
}

function publish(result, stale) {
  if (state.result) {
    state.result.marketOutlook = {
      mode: 'M5_REACTION_FIRST_LEVELS',
      status: stale ? 'DATA_STALE' : result.status,
      generatedAt: result.generatedAt,
      price: result.referencePrice,
      scenarios: result.scenarios || []
    };
    state.result.tradeScenarios = result;
  }
  if (window.AmyFXIntel?.write) {
    const buy = result.scenarios?.find(item => item.side === 'BUY') || null;
    const sell = result.scenarios?.find(item => item.side === 'SELL') || null;
    const payload = {
      mode: 'M5_REACTION_FIRST_LEVELS',
      generatedAt: result.generatedAt,
      price: result.referencePrice,
      status: stale ? 'DATA_STALE' : result.status,
      direction: 'WAIT_REACTION',
      buy,
      sell
    };
    const nextPublishSignature = JSON.stringify(payload);
    if (nextPublishSignature !== lastPublishSignature) {
      lastPublishSignature = nextPublishSignature;
      window.AmyFXIntel.write('outlook', payload);
    }
  }
}

function refresh(force = false) {
  const target = ensureDisclosure();
  if (!target || currentTab() !== 'Analyze') return;
  const candles = state.candles?.M5 || [];
  const stale = isM5Stale();
  const result = buildTradeScenarios({ candles, price: state.price, now: Date.now() });
  setSummaryState(target.summary, { stale, result });
  const nextSignature = signature(result, stale);
  if (!force && nextSignature === lastSignature) return;
  lastSignature = nextSignature;
  lastResult = result;
  target.panel.innerHTML = stale || !result.scenarios?.length
    ? waitingMarkup({ stale, result })
    : panelMarkup(result);
  publish(result, stale);
}

function boot() {
  refresh(true);
  clearInterval(timer);
  timer = setInterval(() => refresh(), 2500);
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy-levels]');
    if (!button) {
      setTimeout(() => refresh(true), 30);
      return;
    }
    try {
      await navigator.clipboard.writeText(button.dataset.copyLevels || '');
      const original = button.innerHTML;
      button.innerHTML = '<span>✓</span> Tersalin';
      setTimeout(() => { button.innerHTML = original; }, 1200);
    } catch (_) {}
  }, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
  window.addEventListener('amyfx:candles-updated', () => refresh(true));
}

window.AmyMarketOutlook = {
  refresh: () => refresh(true),
  history: () => [],
  stats: () => ({ mode: 'M5_REACTION_FIRST_LEVELS', current: lastResult })
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
