import { state, p2 } from './main.js';
import { buildTradeScenarios } from './outlook/trade-scenario-core.js';

const OPEN_KEY = 'amy_mapping_outlook_open';
let lastSignature = '';
let lastResult = null;
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

function scenarioCopyText(scenario, result) {
  const title = scenario.side === 'BUY' ? 'Skenario Buy' : 'Skenario Sell';
  const entry = scenario.side === 'BUY'
    ? `Entry di atas ${priceText(scenario.entry)} setelah candle M15 close`
    : `Entry di bawah ${priceText(scenario.entry)} setelah candle M15 close`;
  return [
    title,
    entry,
    `Stop Loss ${priceText(scenario.stopLoss)}`,
    `Take Profit 1 ${priceText(scenario.takeProfit1)}`,
    `Take Profit 2 ${priceText(scenario.takeProfit2)}`,
    `Risk : Reward TP1 1:${scenario.riskReward1.toFixed(1)}`,
    `Risk : Reward TP2 1:${scenario.riskReward2.toFixed(1)}`,
    `Berlaku sampai ${expiryText(result)} WITA`,
    `Alasan: ${scenario.reason}`
  ].join('\n');
}

function scenarioCard(scenario, result) {
  const buy = scenario.side === 'BUY';
  const title = buy ? 'Skenario Buy' : 'Skenario Sell';
  const entry = buy
    ? `di atas ${priceText(scenario.entry)} setelah close M15`
    : `di bawah ${priceText(scenario.entry)} setelah close M15`;
  return `<article class="amy-level-card ${buy ? 'buy' : 'sell'}">
    <h3>${buy ? '↗' : '↘'} ${title}</h3>
    <div class="amy-level-grid">
      <span>Entry</span><strong>${safeText(entry)}</strong>
      <span>Stop Loss</span><strong class="loss">${priceText(scenario.stopLoss)}</strong>
      <span>Take Profit 1</span><strong class="profit">${priceText(scenario.takeProfit1)}</strong>
      <span>Take Profit 2</span><strong class="profit">${priceText(scenario.takeProfit2)}</strong>
      <span>Risk : Reward</span><strong>TP1 1:${scenario.riskReward1.toFixed(1)} · TP2 1:${scenario.riskReward2.toFixed(1)}</strong>
    </div>
    <p><b>Alasan:</b> ${safeText(scenario.reason)}</p>
    <button type="button" class="amy-copy-level" data-copy-levels="${safeText(scenarioCopyText(scenario, result))}">▣ Salin level</button>
  </article>`;
}

function waitingMarkup({ stale, result }) {
  const message = stale
    ? 'Data M15 sedang usang. Saran level ditahan sampai candle live kembali tersedia.'
    : `Candle M15 belum cukup untuk menghitung level (${result.availableBars || 0}/${result.requiredBars || 32}).`;
  return `<section class="amy-level-panel waiting">
    <div class="amy-level-heading"><div><small>SARAN LEVEL</small><h2>Menunggu Data Valid</h2></div><span>WAIT</span></div>
    <p>${safeText(message)}</p>
  </section>`;
}

function panelMarkup(result) {
  return `<section class="amy-level-panel">
    <div class="amy-level-heading">
      <div><small>SARAN LEVEL</small><h2>Dua Skenario Kondisional</h2></div>
      <span>M15 LIVE</span>
    </div>
    <p class="amy-level-intro">Harga entry, stop, dan target di-anchor ke struktur M15 saat analisis dibuat. Skenario pertama yang memperoleh close M15 valid akan aktif dan sisi lainnya dibatalkan.</p>
    <div class="amy-level-reference">
      <div><small>Harga acuan</small><strong>${priceText(result.referencePrice)}</strong></div>
      <div><small>Resistance</small><strong>${priceText(result.resistance)}</strong></div>
      <div><small>Support</small><strong>${priceText(result.support)}</strong></div>
      <div><small>Berlaku sampai</small><strong>${safeText(expiryText(result))} WITA</strong></div>
    </div>
    <div class="amy-level-cards">${result.scenarios.map(item => scenarioCard(item, result)).join('')}</div>
    <p class="amy-level-disclaimer">${safeText(result.disclaimer)} TP awal dihitung dari level rencana. Setelah trigger, harga fill aktual menjadi dasar penghitungan target.</p>
  </section>`;
}

function ensureDisclosure() {
  const app = document.getElementById('app');
  if (!app || currentTab() !== 'Analyze' || !state.result) return null;
  let details = app.querySelector('.outlook-disclosure');
  if (!details) {
    details = document.createElement('details');
    details.className = 'card disclosure outlook-disclosure';
    details.open = localStorage.getItem(OPEN_KEY) !== 'false';
    details.innerHTML = '<summary>Amy Market Outlook · Saran Level</summary><div class="amy-trade-scenario-panel" data-amy-level-panel="true"></div>';
    details.addEventListener('toggle', () => localStorage.setItem(OPEN_KEY, String(details.open)));
    const validBreak = [...app.querySelectorAll('details.disclosure')]
      .find(item => item.querySelector(':scope > summary')?.textContent.trim().startsWith('Valid Break'));
    if (validBreak) app.insertBefore(details, validBreak);
    else app.appendChild(details);
  }
  const summary = details.querySelector(':scope > summary');
  if (summary && summary.textContent !== 'Amy Market Outlook · Saran Level') summary.textContent = 'Amy Market Outlook · Saran Level';
  let panel = details.querySelector('.amy-trade-scenario-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'amy-trade-scenario-panel';
    details.appendChild(panel);
  }
  panel.dataset.amyLevelPanel = 'true';
  return { details, panel };
}

function signature(result, stale) {
  return JSON.stringify({
    tab: currentTab(),
    stale,
    status: result.status,
    sourceTime: result.sourceTime,
    referencePrice: Number(result.referencePrice || 0).toFixed(2),
    resistance: Number(result.resistance || 0).toFixed(2),
    support: Number(result.support || 0).toFixed(2)
  });
}

function publish(result, stale) {
  if (state.result) {
    state.result.marketOutlook = {
      mode: 'DUAL_CONDITIONAL_LEVELS',
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
    window.AmyFXIntel.write('outlook', {
      mode: 'DUAL_CONDITIONAL_LEVELS',
      generatedAt: result.generatedAt,
      price: result.referencePrice,
      status: stale ? 'DATA_STALE' : result.status,
      direction: 'WAIT_CONDITIONAL',
      buy,
      sell
    });
  }
}

function refresh(force = false) {
  const target = ensureDisclosure();
  if (!target || currentTab() !== 'Analyze') return;
  const candles = state.candles?.M15 || [];
  const stale = isM15Stale();
  const result = buildTradeScenarios({ candles, price: state.price, now: Date.now() });
  const nextSignature = signature(result, stale);
  if (!force && nextSignature === lastSignature) return;
  lastSignature = nextSignature;
  lastResult = result;
  target.panel.innerHTML = stale || result.status !== 'READY'
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
      const original = button.textContent;
      button.textContent = '✓ Tersalin';
      setTimeout(() => { button.textContent = original; }, 1200);
    } catch (_) {}
  }, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
  window.addEventListener('amyfx:candles-updated', () => refresh(true));
}

window.AmyMarketOutlook = {
  refresh: () => refresh(true),
  history: () => [],
  stats: () => ({ mode: 'DUAL_CONDITIONAL_LEVELS', current: lastResult })
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
