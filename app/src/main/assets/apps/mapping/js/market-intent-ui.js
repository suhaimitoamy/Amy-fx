import { deriveLiquidityContext } from './engine/market-intent-engine.js';
import { detectMarketRegimeV2 } from './engine/market-regime-engine.js';
import { routeRegimeStrategy } from './engine/strategy-router-engine.js';
import { evaluateValidatedMarketContext } from './engine/validated-market-context.js';

const CARD_ID = 'amy-regime-router-v3';
const STATE_KEY = 'amy_regime_router_state_v3';
let lastSignature = '';
let refreshTimer = 0;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const numberText = (value, digits = 0) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-';
const labelText = value => String(value || '-').replaceAll('_', ' ');

function readRouterState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); } catch (_) { return null; }
}

function writeRouterState(state) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (_) {}
}

function calculateContext(result, state) {
  const candles = state?.candles?.M15 || [];
  if (!result || candles.length < 30) {
    return { validated: null, regime: null, router: null, liquidity: deriveLiquidityContext({ candles }) };
  }
  const validated = result.validatedMarketContext || evaluateValidatedMarketContext({
    candles,
    tf: 'M15',
    htfCandles: { H4: state?.candles?.H4 || [] }
  });
  const intel = window.AmyFXIntel?.read?.() || {};
  const regime = result.marketRegime || detectMarketRegimeV2({
    candles,
    tf: 'M15',
    htfBiases: result.htfBiases || {},
    marketConcepts: result.marketConcepts || null,
    entryMap: result.entryMap || null,
    currentPrice: state.price || result.price,
    newsRisk: window.AmyFXIntel?.newsRisk?.(intel) || 'UNKNOWN',
    freshness: window.AmyMappingIntegrity?.qualityByInterval || {}
  });
  const router = result.strategyRouter || routeRegimeStrategy({
    candles,
    result,
    regime,
    currentPrice: state.price || result.price,
    previousState: readRouterState()
  });
  writeRouterState(router.state);
  const liquidity = deriveLiquidityContext({ result, regime, candles });
  result.validatedMarketContext = validated;
  result.marketRegime = regime;
  result.strategyRouter = router;
  result.liquidityContextV4 = liquidity;
  return { validated, regime, router, liquidity };
}

function bar(name, value, active) {
  const amount = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="regime-probability ${active ? 'active' : ''}"><div><span>${escapeHtml(labelText(name))}</span><b>${numberText(amount)} / 100</b></div><i style="--regime-value:${numberText(amount)}%"></i></div>`;
}

function healthMetric(label, value, kind = '') {
  return `<div class="health-metric ${kind}"><small>${escapeHtml(label)}</small><strong>${numberText(value)} / 100</strong><i style="--health-value:${numberText(value)}%"></i></div>`;
}

function engineCard(engine, activeName) {
  const isActive = engine?.engine === activeName;
  return `<div class="strategy-engine ${isActive ? 'active' : 'disabled'}"><small>${isActive ? 'AKTIF' : 'NONAKTIF'}</small><strong>${escapeHtml(labelText(engine?.engine))}</strong><span>${escapeHtml(labelText(engine?.status || 'DISABLED'))}${engine?.quality ? ` · kualitas ${numberText(engine.quality)}/100` : ''}</span></div>`;
}

function setupMarkup(router) {
  const setup = router?.setup;
  if (!setup) {
    const conflictText = router?.validatedConflict
      ? 'Setup dibatalkan karena berlawanan dengan Direction Forecast tervalidasi.'
      : 'Router hanya mengizinkan satu strategy engine. Entry tidak dibuat sampai rule strategy aktif lengkap.';
    return `<div class="router-execution wait"><small>KEPUTUSAN STRATEGI</small><strong>${escapeHtml(router?.decision || 'MENUNGGU ANALISIS')}</strong><p>${escapeHtml(conflictText)}</p></div>`;
  }
  return `<div class="router-execution ${String(setup.dir || '').toLowerCase()}"><small>KEPUTUSAN STRATEGI</small><strong>${escapeHtml(router.decision)}</strong><div class="router-level-row"><span><b>Entry</b>${numberText(setup.entry ?? setup.entryLow, 2)}</span><span><b>SL</b>${numberText(setup.sl, 2)}</span><span><b>TP1</b>${numberText(setup.tp1, 2)}</span><span><b>TP2</b>${numberText(setup.tp2, 2)}</span></div><p>Kualitas setup ${numberText(setup.score)}/100 — bukan probabilitas menang.</p></div>`;
}

function targetMarkup(title, target, emptyText) {
  if (!target) return `<div class="liquidity-context-target empty"><small>${escapeHtml(title)}</small><strong>${escapeHtml(emptyText)}</strong><span>Belum tersedia</span></div>`;
  return `<div class="liquidity-context-target"><small>${escapeHtml(title)}</small><strong>${escapeHtml(target.label || target.type)}</strong><span>${numberText(target.level, 2)} · ${escapeHtml(target.type)}</span></div>`;
}

function contextKinds(validated, regime) {
  const marketState = validated?.marketState || {};
  const forecast = validated?.directionForecast || {};
  return {
    marketState,
    forecast,
    stateKind: marketState.directionValue > 0 ? 'stable' : marketState.directionValue < 0 ? 'danger' : 'warning',
    forecastKind: forecast.directionValue > 0 ? 'stable' : forecast.directionValue < 0 ? 'danger' : 'warning',
    shiftKind: regime?.shift?.risk >= 55 ? 'danger' : regime?.shift?.risk >= 30 ? 'warning' : 'stable'
  };
}

function validatedContextMarkup(validated) {
  const { marketState, forecast, stateKind, forecastKind } = contextKinds(validated);
  const forecastDetail = forecast.active
    ? `${numberText(forecast.confidence)}% display confidence · horizon ${escapeHtml(forecast.horizonText || '-')}`
    : 'Tidak ada pola forecast tervalidasi yang aktif';
  return `<div class="market-health-title"><span>VALIDATED MARKET CONTEXT</span><small>Rule Pine yang sudah dibacktest menjadi sumber utama</small></div>
    <div class="router-status-strip validated-context-strip">
      <div class="${stateKind}"><small>Market State</small><strong>${escapeHtml(marketState.state || 'RANGE / TRANSITION')}</strong><span>Kondisi saat ini · fast 4/4 + slow 6/6</span></div>
      <div class="${forecastKind}"><small>Direction Forecast</small><strong>${escapeHtml(forecast.direction || 'NO CLEAR DIRECTION')}</strong><span>${forecastDetail}</span></div>
      <div><small>Regime Authority</small><strong>CONTEXT ONLY</strong><span>Tidak boleh mengganti Market State/Forecast</span></div>
    </div>`;
}

function waitingMarkup(tab) {
  const dashboard = tab === 'Dashboard';
  return `<section class="card regime-router-card waiting ${dashboard ? 'dashboard-context-card' : 'analyze-context-card'}" id="${CARD_ID}">
    <div class="regime-preview-ribbon">${dashboard ? 'DASHBOARD · MARKET CONTEXT RINGKAS' : 'ANALYZE · VALIDATED MARKET CONTEXT'}</div>
    <div class="regime-header"><div><div class="kicker">PINE PARITY ENGINE</div><h2>${dashboard ? 'Memuat ringkasan kondisi market' : 'Memuat Market State dan Direction Forecast'}</h2></div><span class="regime-badge">MEMINDAI</span></div>
    <p class="muted">${dashboard ? 'Dashboard hanya menampilkan kesimpulan. Detail struktur, regime, dan router tersedia di Analyze.' : 'Analyze menampilkan seluruh rule tervalidasi, regime, shift, router, dan liquidity context.'}</p>
    <button class="router-primary-button" type="button" data-router-action="scan">Muat Analisis M15</button>
  </section>`;
}

function renderDashboardCard(validated, regime, router, liquidity) {
  const { marketState, forecast, stateKind, forecastKind, shiftKind } = contextKinds(validated, regime);
  const mainTarget = liquidity?.destinationTarget || liquidity?.htfAlignedLiquidity || liquidity?.nearestLiquidity;
  const strategyStatus = router?.blocked || router?.validatedConflict
    ? 'WAIT / DIBLOKIR'
    : router?.setup
      ? 'SETUP TERSEDIA'
      : 'MENUNGGU SETUP';
  return `<section class="card regime-router-card dashboard-context-card" id="${CARD_ID}">
    <div class="regime-preview-ribbon">DASHBOARD · MARKET CONTEXT RINGKAS</div>
    <div class="regime-header"><div><div class="kicker">KESIMPULAN CEPAT</div><h2>Kondisi market saat ini</h2></div><span class="regime-badge">RINGKAS</span></div>

    <div class="router-status-strip validated-context-strip">
      <div class="${stateKind}"><small>Market State</small><strong>${escapeHtml(marketState.state || 'RANGE / TRANSITION')}</strong><span>Kondisi struktur saat ini</span></div>
      <div class="${forecastKind}"><small>Direction Forecast</small><strong>${escapeHtml(forecast.direction || 'NO CLEAR DIRECTION')}</strong><span>${forecast.active ? `${numberText(forecast.confidence)}% · ${escapeHtml(forecast.horizonText || '-')}` : 'Belum ada forecast aktif'}</span></div>
      <div><small>Liquidity Tujuan</small><strong>${escapeHtml(mainTarget?.label || mainTarget?.type || 'BELUM JELAS')}</strong><span>${mainTarget ? `${numberText(mainTarget.level, 2)} · konteks, bukan entry` : 'Tunggu target tervalidasi'}</span></div>
    </div>

    <div class="router-status-strip dashboard-context-secondary">
      <div><small>Regime</small><strong>${escapeHtml(labelText(router?.activeRegime || regime?.regime || 'TRANSITION'))}</strong><span>Konteks karakter market</span></div>
      <div class="${shiftKind}"><small>Market Shift</small><strong>${escapeHtml(labelText(regime?.shift?.status || 'STABLE'))}</strong><span>Risiko ${numberText(regime?.shift?.risk)}/100</span></div>
      <div><small>Status Strategi</small><strong>${escapeHtml(strategyStatus)}</strong><span>${escapeHtml(labelText(router?.activeStrategy || 'NO TRADE'))}</span></div>
    </div>

    <div class="router-actions dashboard-context-actions">
      <button type="button" data-router-open-analyze>Buka Analisis Teknis</button>
      <button type="button" data-router-action="scan">Perbarui M15</button>
    </div>
    <p class="router-disclaimer">Dashboard hanya menunjukkan keputusan penting. Probability regime, Market Health, strategy engine, alasan, dan detail liquidity hanya tampil di Analyze.</p>
  </section>`;
}

function renderAnalyzeCard(validated, regime, router, liquidity) {
  const probabilities = regime.probabilities || {};
  const health = regime.health || {};
  const shiftClass = regime.shift?.risk >= 55 ? 'danger' : regime.shift?.risk >= 30 ? 'warning' : 'stable';
  const engines = Object.values(router.engines || {});
  const reasons = (router.reasons || []).slice(0, 6);
  return `<section class="card regime-router-card analyze-context-card" id="${CARD_ID}">
    <div class="regime-preview-ribbon">ANALYZE · VALIDATED CONTEXT + TECHNICAL SUPPORT</div>
    <div class="regime-header"><div><div class="kicker">DETAIL TEKNIS</div><h2>Mengapa market dibaca seperti ini?</h2></div><span class="regime-badge">NO AUTO TRADE</span></div>

    ${validatedContextMarkup(validated)}

    <div class="market-health-title"><span>REGIME CONTEXT</span><small>Penjelas karakter market, bukan pengganti hasil tervalidasi</small></div>
    <div class="regime-hero ${String(router.activeRegime).toLowerCase()}">
      <div><small>MARKET PERSONALITY TAMBAHAN</small><strong>${escapeHtml(labelText(router.activeRegime))}</strong><p>Regime mentah: ${escapeHtml(labelText(router.rawRegime))} · kejelasan ${numberText(regime.confidence)}/100</p></div>
      <div class="regime-strategy"><small>STRATEGI YANG DIIZINKAN</small><strong>${escapeHtml(labelText(router.activeStrategy))}</strong><span>${router.blocked ? 'Semua entry diblokir sampai market stabil' : 'Strategy lain dinonaktifkan'}</span></div>
    </div>

    <div class="regime-probability-list">${Object.entries(probabilities).map(([name, value]) => bar(name, value, name === router.activeRegime)).join('')}</div>
    <p class="score-disclaimer">Distribusi regime adalah skor karakter market, bukan peluang arah dan tidak boleh mengganti Direction Forecast.</p>

    <div class="market-health-title"><span>MARKET HEALTH</span><small>Deteksi perubahan karakter sebagai peringatan tambahan</small></div>
    <div class="market-health-grid">
      ${healthMetric('Trend Strength', health.trendStrength)}
      ${healthMetric('Trend Stability', health.trendStability)}
      ${healthMetric('Transition Risk', health.transitionRisk, shiftClass)}
      ${healthMetric('Manipulation Risk', health.manipulationRisk, health.manipulationRisk >= 60 ? 'warning' : '')}
      ${healthMetric('Range Score', health.rangeProbability)}
      ${healthMetric('Expansion Score', health.expansionProbability)}
    </div>

    <div class="router-status-strip">
      <div class="${shiftClass}"><small>Market Shift</small><strong>${escapeHtml(labelText(regime.shift?.status))}</strong><span>${numberText(regime.shift?.risk)}/100</span></div>
      <div><small>Regime State</small><strong>${router.state?.stable ? 'STABIL' : 'MENUNGGU PERSISTENCE'}</strong><span>${router.state?.candidateBars || 0} candle kandidat</span></div>
      <div><small>Automatic Trade</small><strong>OFF</strong><span>Keputusan tetap untuk pengguna</span></div>
    </div>

    <div class="market-health-title"><span>STRATEGY ROUTER</span><small>Setup yang bertentangan dengan forecast tervalidasi ditahan</small></div>
    <div class="strategy-engine-grid">${engines.map(engine => engineCard(engine, router.activeStrategy)).join('')}</div>
    ${setupMarkup(router)}

    <div class="market-health-title"><span>LIQUIDITY CONTEXT</span><small>Destination bukan sinyal entry</small></div>
    <div class="liquidity-context-grid">
      ${targetMarkup('NEAREST LIQUIDITY', liquidity?.nearestLiquidity, 'Tidak ada target terdekat')}
      ${targetMarkup('HTF-ALIGNED LIQUIDITY', liquidity?.htfAlignedLiquidity, 'HTF masih mixed')}
      ${targetMarkup('AUDITED DESTINATION', liquidity?.destinationTarget, 'Liquidity Draw belum lolos')}
    </div>
    <div class="liquidity-warning"><b>${escapeHtml(liquidity?.destination || 'LIQUIDITY CONTEXT')}</b><span>${escapeHtml(liquidity?.warning || 'BSL/SSL bukan BUY/SELL.')}</span></div>

    <div class="router-reasons"><b>Mengapa konteks tambahan memilih ini?</b><ul>${reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul></div>
    <div class="router-actions"><button type="button" data-router-action="scan">Analisis Ulang M15</button></div>
    <p class="router-disclaimer">Market State dan Direction Forecast berasal dari rule Pine tervalidasi. Regime dan quality score hanya konteks tambahan, bukan win rate.</p>
  </section>`;
}

function renderCard(tab, validated, regime, router, liquidity) {
  if (!validated || validated.status !== 'READY' || !regime || regime.status !== 'READY' || !router) return waitingMarkup(tab);
  return tab === 'Dashboard'
    ? renderDashboardCard(validated, regime, router, liquidity)
    : renderAnalyzeCard(validated, regime, router, liquidity);
}

function applyViewMode() {
  document.body.classList.remove('regime-router-focus-mode', 'regime-router-detail-mode');
}

function bindCard() {
  const card = document.getElementById(CARD_ID);
  if (!card || card.dataset.bound === 'true') return;
  card.dataset.bound = 'true';
  card.addEventListener('click', event => {
    const scan = event.target.closest('[data-router-action="scan"]');
    if (scan) {
      scan.disabled = true;
      scan.textContent = 'Memindai M15...';
      if (typeof window.runAnalysis === 'function') window.runAnalysis('M15');
      return;
    }
    const openAnalyze = event.target.closest('[data-router-open-analyze]');
    if (openAnalyze && typeof window.setTab === 'function') {
      window.setTab('Analyze');
    }
  });
}

export function syncMarketIntentV3() {
  const app = document.getElementById('app');
  const state = window.state || {};
  if (!app || !['Dashboard', 'Analyze'].includes(state.tab)) {
    document.getElementById(CARD_ID)?.remove();
    document.body.classList.remove('regime-router-focus-mode', 'regime-router-detail-mode');
    lastSignature = '';
    return;
  }
  const result = state.result || null;
  const { validated, regime, router, liquidity } = calculateContext(result, state);
  const signature = JSON.stringify({
    tab: state.tab,
    candle: state.candles?.M15?.at(-1)?.time || 0,
    price: Number(state.price || result?.price || 0).toFixed(2),
    marketState: validated?.marketState?.state,
    forecast: validated?.directionForecast?.direction,
    forecastStart: validated?.directionForecast?.startTime,
    regime: router?.activeRegime,
    raw: regime?.regime,
    shift: regime?.shift?.risk,
    strategy: router?.activeStrategy,
    decision: router?.decision,
    setup: router?.setup?.id || '',
    liquidity: liquidity?.destinationTarget?.level
  });
  applyViewMode();
  const current = document.getElementById(CARD_ID);
  if (current && signature === lastSignature) return;
  const markup = renderCard(state.tab, validated, regime, router, liquidity);
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
  window.addEventListener('storage', event => { if (event.key === STATE_KEY) schedule(); });
  setInterval(() => { if (!document.hidden) schedule(); }, 1500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
