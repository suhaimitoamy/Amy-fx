import { state, TF, log, save } from '../main.js';
import { analyze, tfGroup } from '../engine/ict-core.js';
import { detectMarketRegimeV2 } from '../engine/market-regime-engine.js';
import { routeRegimeStrategy } from '../engine/strategy-router-engine.js';
import { evaluateValidatedMarketContext } from '../engine/validated-market-context.js';
import { render, renderSoft, renderAnalyzeLive } from '../ui/ui-render.js';
import { sendTargetsToNative } from '../bridge/android-bridge.js';

export let liveTimer = null;
export let scanTimer = null;
export let lastWsTickAt = Number(localStorage.getItem('last_ws_tick_at') || 0);

const PROXY_URL = 'https://amy-fx.vercel.app/api/twelvedata';
const LIVE_POLL_MS = 20_000;
let candleFetchedAt = {};
let pollInFlight = false;
let lastErrorLogAt = 0;
let regimeRouterState = null;

export function isCandleStale(tf) {
  const age = (Date.now() - (candleFetchedAt[tf] || 0)) / 1000 / 60;
  if (tf === 'M1') return age >= 1;
  if (tf === 'M5') return age >= 3;
  if (tf === 'M15') return age >= 5;
  if (tf === 'M30') return age >= 10;
  if (tf === 'H1') return age >= 15;
  if (tf === 'H4') return age >= 30;
  return age >= 120;
}

function analysisRefreshDelay(tf) {
  if (tf === 'M1') return 60_000;
  if (tf === 'M5') return 120_000;
  if (tf === 'M15') return 300_000;
  if (tf === 'M30') return 600_000;
  if (tf === 'H1') return 900_000;
  if (tf === 'H4') return 1_800_000;
  return 3_600_000;
}

function validatedDirection(result) {
  const forecast = result?.validatedMarketContext?.directionForecast;
  if (!forecast?.active) return null;
  return forecast.directionValue > 0 ? 'BUY' : forecast.directionValue < 0 ? 'SELL' : null;
}

function publishMappingSnapshot(result = state.result) {
  const intel = window.AmyFXIntel;
  if (!intel?.write) return;

  const previous = intel.read?.()?.mapping || {};
  const price = Number(state.price || result?.price || previous.price || 0);
  const bsl = Number(result?.bsl || previous.bsl || 0);
  const ssl = Number(result?.ssl || previous.ssl || 0);
  const activeTargets = Array.isArray(result?.activeLiquidityTargets) ? result.activeLiquidityTargets : [];
  const levels = activeTargets.map(item => {
    const levelPrice = Number(item.level);
    return {
      type: item.type,
      price: levelPrice,
      distance: Number.isFinite(levelPrice) && price > 0 ? levelPrice - price : 0,
      status: item.status || 'ACTIVE',
      strength: item.strength || 'MEDIUM',
      source: item.source || 'MAPPING',
      timeframe: result?.tf || state.tf
    };
  }).filter(item => (item.type === 'BSL' || item.type === 'SSL') && Number.isFinite(item.price) && item.price > 0);

  if (!levels.some(item => item.type === 'BSL') && bsl > 0) levels.push({ type: 'BSL', price: bsl, distance: price > 0 ? bsl - price : 0, status: 'ACTIVE', source: 'MAPPING', timeframe: result?.tf || state.tf });
  if (!levels.some(item => item.type === 'SSL') && ssl > 0) levels.push({ type: 'SSL', price: ssl, distance: price > 0 ? ssl - price : 0, status: 'ACTIVE', source: 'MAPPING', timeframe: result?.tf || state.tf });

  const validated = result?.validatedMarketContext;
  intel.write('mapping', {
    price,
    bsl,
    ssl,
    levels,
    timeframe: result?.tf || previous.timeframe || state.tf,
    bias: validated?.directionForecast?.active
      ? validated.directionForecast.direction
      : validated?.marketState?.direction || result?.final || previous.bias || 'WAIT',
    direction: result?.bestSetup?.dir || 'WAIT',
    status: validated?.directionForecast?.active
      ? `${validated.directionForecast.direction} · VALIDATED FORECAST`
      : result?.bestSetup?.status || result?.strategyRouter?.decision || 'NO CLEAR DIRECTION',
    marketState: validated?.marketState?.state || 'RANGE / TRANSITION',
    directionForecast: validated?.directionForecast?.direction || 'NO CLEAR DIRECTION',
    regime: result?.strategyRouter?.activeRegime || result?.marketRegime?.regime || 'TRANSITION',
    strategy: result?.strategyRouter?.activeStrategy || 'NO_TRADE',
    shiftRisk: Number(result?.marketRegime?.shift?.risk || 0),
    analyzedAt: result ? Date.now() : Number(previous.analyzedAt || 0)
  });
}

export async function fetchTf(tf) {
  const params = new URLSearchParams({ symbol: 'XAU/USD', interval: TF[tf], outputsize: '300' });
  const response = await fetch(`${PROXY_URL}?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Market HTTP ${response.status}`);
  const data = await response.json();
  if (data.status === 'error') throw new Error(data.message || 'Fetch gagal');

  const raw = (data.values || []).reverse();
  const candles = raw.map((c, index) => ({
    time: new Date(c.datetime).getTime() / 1000,
    timeframe: tf,
    open: +c.open,
    high: +c.high,
    low: +c.low,
    close: +c.close,
    tickCount: 1,
    isClosed: index < raw.length - 1
  })).filter(c => c.isClosed && Number.isFinite(c.close));

  if (!candles.length) throw new Error(`Candle ${tf} kosong`);
  state.candles[tf] = candles;
  candleFetchedAt[tf] = Date.now();
  return candles;
}

function attachValidatedMarketContext(result) {
  if (!result || !['M5', 'M15', 'H1'].includes(result.tf)) return result;
  const candles = state.candles[result.tf] || [];
  const validated = evaluateValidatedMarketContext({
    candles,
    tf: result.tf,
    htfCandles: { H4: state.candles.H4 || [] }
  });
  result.validatedMarketContext = validated;
  result.validatedMarketState = validated.marketState;
  result.validatedDirectionForecast = validated.directionForecast;
  return result;
}

function setupDirection(setup) {
  const value = String(setup?.dir || setup?.direction || '').toUpperCase();
  if (value.includes('BUY') || value.includes('BULL')) return 1;
  if (value.includes('SELL') || value.includes('BEAR')) return -1;
  return 0;
}

function applyRegimeRouter(result, htfBiases) {
  result = attachValidatedMarketContext(result);
  if (!result || result.tf !== 'M15') return result;
  const candles = state.candles.M15 || [];
  const intel = window.AmyFXIntel?.read?.() || {};
  const regime = detectMarketRegimeV2({
    candles,
    tf: 'M15',
    htfBiases: result.htfBiases || htfBiases || {},
    marketConcepts: result.marketConcepts || null,
    entryMap: result.entryMap || null,
    currentPrice: state.price || result.price,
    newsRisk: window.AmyFXIntel?.newsRisk?.(intel) || 'UNKNOWN',
    freshness: window.AmyMappingIntegrity?.qualityByInterval || {}
  });
  let router = routeRegimeStrategy({
    candles,
    result,
    regime,
    currentPrice: state.price || result.price,
    previousState: regimeRouterState
  });
  regimeRouterState = router.state;

  const forecast = result.validatedMarketContext?.directionForecast;
  const forecastDirection = forecast?.active ? Number(forecast.directionValue || 0) : 0;
  const conflict = Boolean(router.setup && forecastDirection && setupDirection(router.setup) !== forecastDirection);
  if (conflict) {
    router = {
      ...router,
      setup: null,
      validatedConflict: true,
      decision: 'WAIT — SETUP BERTENTANGAN DENGAN DIRECTION FORECAST TERVALIDASI',
      reasons: [
        `Direction Forecast tervalidasi ${forecast.direction}; setup ${router.setup?.dir || 'berlawanan'} tidak diteruskan.`,
        ...(router.reasons || [])
      ].slice(0, 6)
    };
  }

  result.marketRegime = regime;
  result.strategyRouter = {
    ...router,
    role: 'CONTEXT_AND_STRATEGY_SUPPORT',
    mayOverrideValidatedMarketState: false,
    mayOverrideValidatedDirectionForecast: false
  };
  result.unroutedSetups = Array.isArray(result.setups) ? [...result.setups] : [];
  result.unroutedBestSetup = result.bestSetup || null;
  result.setups = router.setup ? [router.setup] : [];
  result.bestSetup = router.setup || null;
  result.signal = router.setup?.dir || 'WAIT';
  if (forecast?.active) result.final = forecast.direction;
  result.routerDecision = router.decision;
  return result;
}

export async function runAnalysis(tf = state.tf) {
  if (document.hidden) return;
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
  state.tf = tf;
  render();

  try {
    log(`Memindai ${tf}...`);
    const group = tfGroup(tf);
    const scanGroup = [...new Set([...group, 'M1', 'M5', 'M15', 'M30', 'H1', 'H4'])];
    await Promise.all(scanGroup.map(async currentTf => {
      if (!state.candles[currentTf]?.length || isCandleStale(currentTf)) {
        try { await fetchTf(currentTf); } catch (_) { log(`Candle ${currentTf} belum diperbarui, memakai cache.`); }
      }
      return state.candles[currentTf] || [];
    }));

    const htfBiases = {};
    for (const currentTf of group.filter(item => item !== tf)) {
      const candles = state.candles[currentTf];
      if (candles?.length > 30) {
        const contextResult = analyze(candles, currentTf, {}, state.price);
        htfBiases[currentTf] = contextResult?.st?.trend || 'NEUTRAL';
      }
    }

    const htfContext = { H4: state.candles.H4, D1: state.candles.D1, W1: state.candles.W1 };
    let result = analyze(state.candles[tf], tf, htfBiases, state.price, htfContext);
    if (!result?.st) throw new Error('Hasil analisis tidak valid');
    result = applyRegimeRouter(result, htfBiases);

    state.result = result;
    state.setups = [...(result.setups || []), ...state.setups].slice(0, 50);
    state.analyses = [{ id: Date.now(), ...result }, ...state.analyses].slice(0, 80);
    save();
    publishMappingSnapshot(result);
    const validatedText = result.validatedDirectionForecast?.active
      ? `${result.validatedDirectionForecast.direction} · validated ${result.validatedDirectionForecast.confidence}%`
      : result.validatedMarketState?.state;
    log(`${tf} selesai: ${validatedText || result.strategyRouter?.decision || `${result.signal} score ${result.score}/100`}`);
    sendTargetsToNative();
  } catch (error) {
    log(`Error ${tf}: ${error.message}`);
  }
  render();
}

function scheduleAnalysisRefresh() {
  if (scanTimer) return;
  scanTimer = setTimeout(() => {
    scanTimer = null;
    if (!document.hidden) runAnalysis(state.tf);
  }, analysisRefreshDelay(state.tf));
}

async function pollLivePrice() {
  if (document.hidden || pollInFlight) return;
  pollInFlight = true;
  try {
    const response = await fetch(`${PROXY_URL}?symbol=XAU/USD&interval=1min&outputsize=1&_=${Math.floor(Date.now() / LIVE_POLL_MS)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const price = +(data.values?.[0]?.close || 0);
    if (data.status !== 'ok' || !Number.isFinite(price) || price <= 0) throw new Error(data.message || 'Harga live tidak valid');
    lastWsTickAt = Date.now();
    localStorage.setItem('last_ws_tick_at', String(lastWsTickAt));
    localStorage.setItem('last_price', String(price));
    state.price = price;
    state.conn = 'Connected';
    publishMappingSnapshot();
    renderAnalyzeLive();
    renderSoft();
    scheduleAnalysisRefresh();
  } catch (error) {
    state.conn = 'Offline';
    renderSoft();
    if (Date.now() - lastErrorLogAt > 60000) {
      lastErrorLogAt = Date.now();
      log(`Live price mencoba tersambung kembali: ${error.message}`);
    }
  } finally {
    pollInFlight = false;
  }
}

export function connect() {
  if (liveTimer) clearInterval(liveTimer);
  state.conn = 'Connecting';
  renderSoft();
  pollLivePrice();
  liveTimer = setInterval(pollLivePrice, LIVE_POLL_MS);
  if (!state.candles[state.tf]?.length) runAnalysis(state.tf);
}

export function isLivePriceRunning() { return liveTimer !== null; }

export function stopLivePrice() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
  state.conn = 'Offline';
  renderSoft();
}
