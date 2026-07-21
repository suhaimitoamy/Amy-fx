import { detectMarketRegimeV2 } from './engine/market-regime-engine.js';
import { deriveMarketIntent } from './engine/market-intent-engine.js';

const CARD_ID = 'amy-market-intent-v3';
const VIEW_MODE_KEY = 'amy_mapping_v3_view_mode';
let lastSignature = '';
let refreshTimer = 0;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const numberText = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-';
const labelText = value => String(value || '-').replaceAll('_', ' ');
const mode = () => localStorage.getItem(VIEW_MODE_KEY) === 'DETAIL' ? 'DETAIL' : 'FOCUS';

function activeM15Setup(result) {
  const setup = result?.bestSetup;
  if (!setup || String(setup.tf || '').toUpperCase() !== 'M15') return null;
  const status = String(setup.lifecycle?.status || setup.status || '').toUpperCase();
  const live = setup.lifecycle?.live !== false && setup.live !== false;
  return live && !/(INVALID|BROKEN|EXPIRED|SL HIT|TP2 HIT|TP1 \/ BE)/.test(status) ? setup : null;
}

function calculateContext(result, state) {
  const candles = state?.candles?.M15 || [];
  if (!result || candles.length < 30) return { regime: null, intent: deriveMarketIntent({ candles }) };
  const intel = window.AmyFXIntel?.read?.() || {};
  const regime = detectMarketRegimeV2({
    candles,
    tf: 'M15',
    htfBiases: result.htfBiases || {},
    marketConcepts: result.marketConcepts || null,
    entryMap: result.entryMap || null,
    currentPrice: state.price || result.price,
    newsRisk: window.AmyFXIntel?.newsRisk?.(intel) || 'UNKNOWN',
    freshness: window.AmyMappingIntegrity?.qualityByInterval || {}
  });
  const intent = deriveMarketIntent({ result, regime, candles });
  result.mappingV2 = regime;
  result.marketIntentV3 = intent;
  return { regime, intent };
}

function directionVisual(intent) {
  if (intent?.direction === 'BULLISH') return { arrow: '↑', className: 'bullish', text: 'ARAH UTAMA NAIK' };
  if (intent?.direction === 'BEARISH') return { arrow: '↓', className: 'bearish', text: 'ARAH UTAMA TURUN' };
  return { arrow: '↔', className: 'wait', text: 'ARAH BELUM BERSIH' };
}

function targetCard(title, target, emptyText) {
  if (!target) return `<div class="intent-target empty"><small>${escapeHtml(title)}</small><strong>${escapeHtml(emptyText)}</strong><span>Belum tersedia</span></div>`;
  return `<div class="intent-target ${String(target.type || '').toLowerCase()}"><small>${escapeHtml(title)}</small><strong>${escapeHtml(target.label || target.type)}</strong><span>${numberText(target.level)} · ${numberText(target.distanceAtr, 2)} ATR</span></div>`;
}

function pathMarkup(path = []) {
  return path.map((step, index) => `<div class="intent-path-step"><i>${index + 1}</i><div><small>${index === 0 ? 'KONDISI SEKARANG' : index === path.length - 1 ? 'TUJUAN' : 'TAHAP BERIKUTNYA'}</small><strong>${escapeHtml(step)}</strong></div></div>`).join('');
}

function setupMarkup(result, intent) {
  const setup = activeM15Setup(result);
  if (!setup) return `<div class="intent-execution wait"><small>KEPUTUSAN EKSEKUSI</small><strong>${escapeHtml(intent?.decision || 'TUNGGU ANALISIS')}</strong><p>Market Intent menunjukkan jalur konteks. Entry tetap menunggu setup M15 Sweep → MSS yang aktif.</p></div>`;
  const direction = String(setup.dir || '').toUpperCase();
  return `<div class="intent-execution ${direction === 'BUY' ? 'buy' : 'sell'}"><small>KEPUTUSAN EKSEKUSI</small><strong>${escapeHtml(intent?.decision || `${direction} M15`)}</strong><div class="intent-level-row"><span><b>Entry</b>${numberText(setup.entry ?? setup.entryLow)}</span><span><b>SL</b>${numberText(setup.sl)}</span><span><b>TP1</b>${numberText(setup.tp1)}</span><span><b>TP2</b>${numberText(setup.tp2)}</span></div></div>`;
}

function waitingMarkup(intent) {
  return `<section class="card market-intent-card waiting" id="${CARD_ID}"><div class="intent-preview-ribbon">AMY FX PREVIEW</div><div class="intent-header"><div><div class="kicker">MARKET INTENT V3</div><h2>Market mau ke mana?</h2></div><span class="intent-experimental">EXPERIMENTAL</span></div><div class="intent-loading-orbit"><i></i><b>MEMINDAI</b></div><h3>${escapeHtml(intent?.headline || 'MEMINDAI MARKET')}</h3><p class="intent-wait-copy">Membaca candle M15, struktur, HTF, liquidity aktif, dan Market Regime.</p><div class="intent-path">${pathMarkup(intent?.path || [])}</div><button class="intent-primary-button" type="button" data-intent-action="scan">Muat Analisis M15</button></section>`;
}

function renderCard(result, regime, intent) {
  if (!intent || intent.status !== 'READY') return waitingMarkup(intent);
  const visual = directionVisual(intent);
  const shiftRisk = Number(regime?.shift?.risk || intent.shiftRisk || 0);
  const contextStatus = shiftRisk >= 55 ? 'danger' : shiftRisk >= 30 ? 'warning' : 'stable';
  const reasons = (intent.reasons || []).slice(0, 4);
  return `<section class="card market-intent-card ${visual.className}" id="${CARD_ID}"><div class="intent-preview-ribbon">AMY FX PREVIEW · MARKET INTENT V3</div><div class="intent-header"><div><div class="kicker">LIVE MARKET DECISION</div><h2>Market mau ke mana?</h2></div><span class="intent-experimental">CONTEXT ONLY</span></div><div class="intent-direction-block ${visual.className}"><div class="intent-arrow">${visual.arrow}</div><div class="intent-direction-copy"><small>${escapeHtml(visual.text)}</small><strong>${escapeHtml(intent.headline)}</strong><p>${escapeHtml(intent.condition)}</p></div><div class="intent-confidence" style="--intent-confidence:${numberText(intent.confidence, 0)}%"><b>${numberText(intent.confidence, 0)}%</b><span>${escapeHtml(intent.confidenceLabel || 'Kejelasan konteks')}</span></div></div><div class="intent-target-grid">${targetCard('PRIMARY LIQUIDITY OBJECTIVE', intent.primary, 'Target utama belum terbaca')}${targetCard('SECONDARY OBJECTIVE', intent.secondary, 'Target cadangan belum terbaca')}${targetCard('INVALIDATION / SISI LAWAN', intent.invalidation, 'Gunakan batas salah setup')}</div><div class="intent-context-strip"><div><small>Market Regime</small><strong>${escapeHtml(labelText(regime?.regime || intent.regime))}</strong></div><div class="${contextStatus}"><small>Market Shift</small><strong>${escapeHtml(labelText(regime?.shift?.status || 'STABLE'))}</strong><span>${numberText(shiftRisk, 0)}% risk</span></div><div><small>Strategy Router</small><strong>${escapeHtml(labelText(regime?.strategy || 'NO TRADE'))}</strong></div><div><small>Harga Sekarang</small><strong>${numberText(intent.price)}</strong></div></div><div class="intent-section-title"><span>EXPECTED PRICE PATH</span><small>Urutan skenario, bukan jaminan harga</small></div><div class="intent-path">${pathMarkup(intent.path)}</div>${setupMarkup(result, intent)}<div class="intent-reason-box"><b>Mengapa Amy FX memilih jalur ini?</b><ul>${reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul></div><div class="intent-actions"><button type="button" data-intent-action="scan">Analisis Ulang M15</button><button type="button" data-intent-mode="FOCUS" class="${mode() === 'FOCUS' ? 'active' : ''}">Fokus</button><button type="button" data-intent-mode="DETAIL" class="${mode() === 'DETAIL' ? 'active' : ''}">Detail Teknis</button></div><p class="intent-disclaimer">Market Intent adalah pembacaan kondisi dan liquidity objective. Ia belum menjadi filter entry otomatis dan tidak mengubah setup produksi.</p></section>`;
}

function applyViewMode() {
  const supported = ['Dashboard', 'Analyze'].includes(window.state?.tab);
  document.body.classList.toggle('market-intent-focus-mode', supported && mode() === 'FOCUS');
  document.body.classList.toggle('market-intent-detail-mode', supported && mode() !== 'FOCUS');
}

function bindCard() {
  const card = document.getElementById(CARD_ID);
  if (!card || card.dataset.bound === 'true') return;
  card.dataset.bound = 'true';
  card.addEventListener('click', event => {
    const scan = event.target.closest('[data-intent-action="scan"]');
    if (scan) {
      scan.disabled = true;
      scan.textContent = 'Memindai M15...';
      if (typeof window.runAnalysis === 'function') window.runAnalysis('M15');
      return;
    }
    const modeButton = event.target.closest('[data-intent-mode]');
    if (!modeButton) return;
    localStorage.setItem(VIEW_MODE_KEY, modeButton.dataset.intentMode);
    lastSignature = '';
    syncMarketIntentV3();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

export function syncMarketIntentV3() {
  const app = document.getElementById('app');
  const state = window.state || {};
  if (!app || !['Dashboard', 'Analyze'].includes(state.tab)) {
    document.getElementById(CARD_ID)?.remove();
    document.body.classList.remove('market-intent-focus-mode', 'market-intent-detail-mode');
    lastSignature = '';
    return;
  }
  const result = state.result || null;
  const { regime, intent } = calculateContext(result, state);
  const signature = JSON.stringify({ tab: state.tab, candle: state.candles?.M15?.at(-1)?.time || 0, price: Number(state.price || result?.price || 0).toFixed(2), intent: intent?.headline, decision: intent?.decision, primary: intent?.primary?.level, confidence: intent?.confidence, regime: regime?.regime, shift: regime?.shift?.risk, setup: result?.bestSetup?.id || result?.bestSetup?.status || '', mode: mode() });
  applyViewMode();
  const current = document.getElementById(CARD_ID);
  if (current && signature === lastSignature) return;
  const markup = renderCard(result, regime, intent);
  if (current) current.outerHTML = markup;
  else app.insertAdjacentHTML('afterbegin', markup);
  lastSignature = signature;
  bindCard();
}

function schedule(delay = 0) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => requestAnimationFrame(syncMarketIntentV3), delay);
}

function start() {
  schedule();
  document.addEventListener('click', () => schedule(100), { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  window.addEventListener('storage', event => { if (event.key === VIEW_MODE_KEY) schedule(); });
  setInterval(() => { if (!document.hidden) schedule(); }, 1500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
