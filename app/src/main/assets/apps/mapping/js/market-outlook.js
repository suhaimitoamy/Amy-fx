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

function isM15Stale() {
  if (state?.result?.dataStale) return true;
  const connection = String(document.getElementById('conn')?.textContent || '').toUpperCase();
  if (connection.includes('STALE') || connection.includes('DATA USANG')) return true;
  const quality = window.AmyMappingIntegrity?.qualityByInterval || {};
  const item = quality['15min'] || quality.M15 || quality.m15;
  const status = qualityState(item).toUpperCase();
  return status.includes('STALE') || status.includes('USANG');
}

function expiryText(result) {
  const source = Number(result?.sourceTime || result?.generatedAt || Date.now());
  const expiresAt = source + Number(result?.validityBars || 0) * 15 * 60 * 1000;
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Makassar',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(expiresAt));
}

function entryText(scenario) {
  const price = priceText(scenario.entry);
  return scenario.side === 'BUY'
    ? `area ${price} setelah breakout dan retest`
    : `area ${price} setelah breakdown dan retest`;
}

function displayReason(scenario) {
  const level = priceText(scenario.triggerLevel);
  const retestBars = Number(scenario.retestBars || 8);
  return scenario.side === 'BUY'
    ? `Tunggu close M15 di atas resistance ${level}, lalu retest level entry maksimal ${retestBars} candle.`
    : `Tunggu close M15 di bawah support ${level}, lalu retest level entry maksimal ${retestBars} candle.`;
}

function scenarioCopyText(scenario, result) {
  const title = scenario.side === 'BUY' ? 'Skenario Buy' : 'Skenario Sell';
  return [
    title,
    `Entry ${entryText(scenario)}`,
    `Stop Loss ${priceText(scenario.stopLoss)}`,
    `Take Profit 1 ${priceText(scenario.takeProfit1)} (1:${scenario.riskReward1.toFixed(1)})`,
    `Take Profit 2 ${priceText(scenario.takeProfit2)} (1:${scenario.riskReward2.toFixed(1)})`,
    `Berlaku sampai ${expiryText(result)} WITA`,
    `Alasan: ${displayReason(scenario)}`
  ].join('\n');
}

function scenarioCard(scenario, result) {
  const buy = scenario.side === 'BUY';
  const title = buy ? 'Skenario Buy' : 'Skenario Sell';
  return `<article class="amy-level-card ${buy ? 'buy' : 'sell'}">
    <h3><span>${buy ? '↗' : '↘'}</span>${title}</h3>
    <div class="amy-level-grid">
      <span>Entry</span><strong>${safeText(entryText(scenario))}</strong>
      <span>Stop Loss</span><strong class="loss">${priceText(scenario.stopLoss)}</strong>
      <span>Take Profit 1</span><strong class="profit">${priceText(scenario.takeProfit1)}</strong>
      <span>Take Profit 2</span><strong class="profit">${priceText(scenario.takeProfit2)}</strong>
      <span>Risk : Reward</span><strong>TP1 1:${scenario.riskReward1.toFixed(1)} · TP2 1:${scenario.riskReward2.toFixed(1)}</strong>
    </div>
    <p><b>Alasan:</b> ${safeText(displayReason(scenario))}</p>
    <button type="button" class="amy-copy-level" data-copy-levels="${safeText(scenarioCopyText(scenario, result))}"><span>▣</span> Salin level</button>
  </article>`;
}

function waitingMarkup({ stale, result }) {
  const message = stale
    ? 'Data M15 sedang usang. Saran level ditahan sampai candle live kembali tersedia.'
    : `Candle M15 belum cukup untuk menghitung level (${result.availableBars || 0}/${result.requiredBars || 32}).`;
  return `<section class="amy-level-panel waiting">
    <p class="amy-level-intro">Harga entry / stop / target konkret untuk skenario buy dan sell — aktif hanya setelah breakout atau breakdown mendapatkan retest valid.</p>
    <div class="amy-level-waiting">${safeText(message)}</div>
  </section>`;
}

function panelMarkup(result) {
  return `<section class="amy-level-panel">
    <p class="amy-level-intro">Harga entry / stop / target konkret untuk skenario buy dan sell — aktif hanya setelah breakout atau breakdown mendapatkan retest valid.</p>
    <div class="amy-level-cards">${result.scenarios.map(item => scenarioCard(item, result)).join('')}</div>
    <p class="amy-level-disclaimer">Hanya sisi pertama yang mendapat close M15 dan retest valid yang aktif; sisi berlawanan dibatalkan. TP1 memakai RR 1:1,5 dan TP2 memakai RR 1:2. Keputusan trading tetap sepenuhnya di tangan kamu.</p>
  </section>`;
}

function summaryMarkup() {
  return `<span class="amy-level-summary-title"><i>◎</i><b>${SUMMARY_TITLE}</b></span><span class="amy-level-summary-status">SIAP</span>`;
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

function setSummaryState(summary, { stale, ready }) {
  if (!summary) return;
  const badge = summary.querySelector('.amy-level-summary-status');
  if (!badge) return;
  const text = stale ? 'DATA USANG' : ready ? 'SIAP' : 'WAIT';
  if (badge.textContent !== text) badge.textContent = text;
  badge.classList.toggle('stale', stale);
  badge.classList.toggle('ready', ready && !stale);
  badge.classList.toggle('waiting', !ready && !stale);
}

function signature(result, stale) {
  return JSON.stringify({
    tab: currentTab(),
    stale,
    status: result.status,
    sourceTime: result.sourceTime,
    referencePrice: Number(result.referencePrice || 0).toFixed(2),
    resistance: Number(result.resistance || 0).toFixed(2),
    support: Number(result.support || 0).toFixed(2),
    tp1R: Number(result.config?.tp1R || 0),
    tp2R: Number(result.config?.tp2R || 0)
  });
}

function publish(result, stale) {
  if (state.result) {
    state.result.marketOutlook = {
      mode: 'DUAL_CONDITIONAL_RETEST_LEVELS',
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
      mode: 'DUAL_CONDITIONAL_RETEST_LEVELS',
      generatedAt: result.generatedAt,
      price: result.referencePrice,
      status: stale ? 'DATA_STALE' : result.status,
      direction: 'WAIT_CONDITIONAL',
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
  const candles = state.candles?.M15 || [];
  const stale = isM15Stale();
  const result = buildTradeScenarios({ candles, price: state.price, now: Date.now() });
  const ready = !stale && result.status === 'READY';
  setSummaryState(target.summary, { stale, ready });
  const nextSignature = signature(result, stale);
  if (!force && nextSignature === lastSignature) return;
  lastSignature = nextSignature;
  lastResult = result;
  target.panel.innerHTML = ready
    ? panelMarkup(result)
    : waitingMarkup({ stale, result });
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
  stats: () => ({ mode: 'DUAL_CONDITIONAL_RETEST_LEVELS', current: lastResult })
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
