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

let pollInFlight = false;
let lastErrorLogAt = 0;
let regimeRouterState = null;

const PROXY_URL = 'https://amy-fx.vercel.app/api/twelvedata';
const LIVE_POLL_MS = 20_000;
export let candleFetchedAt = {};

function normalizeTfKey(tf) {
  const norm = String(tf || '').toUpperCase();
  if (norm === '1MIN') return 'M1';
  if (norm === '5MIN') return 'M5';
  if (norm === '15MIN') return 'M15';
  if (norm === '30MIN') return 'M30';
  if (norm === '1H') return 'H1';
  if (norm === '4H') return 'H4';
  if (norm === '1DAY') return 'D1';
  return norm;
}

export function setCandleFetchedAt(tf, timestamp = Date.now()) {
  const key = normalizeTfKey(tf);
  candleFetchedAt[tf] = timestamp;
  candleFetchedAt[key] = timestamp;
}

export function getCandleFetchedAt(tf) {
  const key = normalizeTfKey(tf);
  return candleFetchedAt[key] || candleFetchedAt[tf] || 0;
}

export function isCandleStale(tf) {
  const norm = normalizeTfKey(tf);
  const fetched = getCandleFetchedAt(tf);
  const ageMinutes = (Date.now() - fetched) / (1000 * 60);

  if (norm === 'M1') return ageMinutes >= 2;
  if (norm === 'M5') return ageMinutes >= 5;
  if (norm === 'M15') return ageMinutes >= 5;
  if (norm === 'M30') return ageMinutes >= 10;
  if (norm === 'H1') return ageMinutes >= 15;
  if (norm === 'H4') return ageMinutes >= 60;
  if (norm === 'D1') return ageMinutes >= 240; // 4 jam = 240 menit
  return ageMinutes >= 240;
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

export function buildDirectionDecision(result) {
  if (!result) {
    return {
      bias: 'WAIT',
      signal: 'WAIT',
      source: 'NO_CLEAR_DIRECTION',
      status: 'WAIT — DATA ANALISIS BELUM TERSEDIA',
      invalidated: false,
      invalidationReason: ''
    };
  }

  if (result.dataStale) {
    return {
      bias: 'DATA USANG',
      signal: 'WAIT',
      source: 'DATA_STALE',
      status: 'DATA USANG — CACHE KEDALUWARSA & API GAGAL',
      invalidated: true,
      invalidationReason: 'Cache kedaluwarsa & API gagal diperbarui.'
    };
  }

  const validated = result.validatedMarketContext;
  const forecast = validated?.directionForecast;
  const marketState = validated?.marketState;

  if (forecast && (forecast.invalidated || forecast.expired) && !forecast.active) {
    const reason = forecast.invalidationReason
      || (forecast.invalidated ? 'Direction Forecast dihentikan oleh structural break berlawanan.' : 'Direction Forecast telah melewati batas horizon.');
    return {
      bias: 'WAIT',
      signal: 'WAIT',
      source: 'VALIDATED_DIRECTION_FORECAST',
      status: `WAIT — ${reason}`,
      invalidated: true,
      invalidationReason: reason
    };
  }

  if (forecast?.active) {
    const forecastDir = forecast.direction;
    const bias = forecastDir === 'BULLISH' ? 'BUY' : forecastDir === 'BEARISH' ? 'SELL' : 'WAIT';
    const rawSetup = result.experimentalBestSetup || result.bestSetup || result.entryMap?.setup;
    const setupVal = setupDirection(rawSetup);
    const forecastVal = forecast.directionValue > 0 ? 1 : forecast.directionValue < 0 ? -1 : 0;
    const conflict = Boolean(rawSetup && setupVal !== 0 && setupVal !== forecastVal);

    if (conflict) {
      const reason = `Setup Entry Map (${rawSetup?.dir || 'Entry Map'}) bertentangan dengan Validated Direction Forecast (${forecastDir}).`;
      return {
        bias,
        signal: 'WAIT',
        source: 'VALIDATED_DIRECTION_FORECAST',
        status: `WAIT — ${reason}`,
        invalidated: true,
        invalidationReason: reason
      };
    }

    return {
      bias,
      signal: bias,
      source: 'VALIDATED_DIRECTION_FORECAST',
      status: `${forecastDir} · VALIDATED FORECAST (${forecast.confidence || 60}%)`,
      invalidated: false,
      invalidationReason: ''
    };
  }

  if (marketState?.state && marketState.state !== 'DATA BELUM CUKUP') {
    return {
      bias: 'WAIT',
      signal: 'WAIT',
      source: 'VALIDATED_MARKET_STATE',
      status: `WAIT — Market State: ${marketState.state} (Konteks saja, sinyal WAIT)`,
      invalidated: false,
      invalidationReason: ''
    };
  }

  return {
    bias: 'WAIT',
    signal: 'WAIT',
    source: 'NO_CLEAR_DIRECTION',
    status: 'WAIT — NO CLEAR DIRECTION',
    invalidated: false,
    invalidationReason: ''
  };
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

  const decision = result?.directionDecision || buildDirectionDecision(result);
  const validated = result?.validatedMarketContext;

  intel.write('mapping', {
    price,
    bsl,
    ssl,
    levels,
    timeframe: result?.tf || previous.timeframe || state.tf,
    bias: decision.bias,
    direction: decision.signal,
    status: decision.status,
    directionDecision: decision,
    marketState: result?.dataStale ? 'DATA USANG' : (validated?.marketState?.state || 'RANGE / TRANSITION'),
    directionForecast: decision.source === 'VALIDATED_DIRECTION_FORECAST' ? (validated?.directionForecast?.direction || 'NO CLEAR DIRECTION') : 'NO CLEAR DIRECTION',
    regime: result?.dataStale ? 'TRANSITION' : (result?.strategyRouter?.activeRegime || result?.marketRegime?.regime || 'TRANSITION'),
    strategy: result?.dataStale ? 'NO_TRADE' : (result?.strategyRouter?.activeStrategy || 'NO_TRADE'),
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
  setCandleFetchedAt(tf, Date.now());
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

function annotateExperimentalSetup(setup) {
  if (!setup) return null;
  const terminal = /INVALID|BROKEN|SL HIT|TP HIT|EXPIRED/.test(String(setup.status || '').toUpperCase());
  if (terminal) return { ...setup };
  return {
    ...setup,
    status: 'EXPERIMENTAL CLAIM',
    validationStatus: 'ENTRY_MAP_REACTION_ACCURACY_48_24_2022_2025',
    claimAccuracy: 48.24,
    claimDefinition: 'Reaksi minimal 0,5 ATR searah mapping dalam 16 candle M15 dengan favorable excursion tidak lebih kecil dari adverse excursion.',
    reason: `${setup.reason || 'Setup Entry Map terdeteksi.'} Entry Map tetap tersedia untuk audit di Analyze, tetapi tidak boleh ditampilkan sebagai setup utama karena akurasi klaim reaksinya 48,24% pada 2022-2025.`
  };
}

function applyRegimeRouter(result, htfBiases) {
  result = attachValidatedMarketContext(result);
  if (!result) return result;

  const forecast = result.validatedMarketContext?.directionForecast;
  const forecastActive = Boolean(forecast?.active);
  const forecastDirection = forecastActive ? Number(forecast.directionValue || 0) : 0;

  const originalSetups = Array.isArray(result.setups) ? [...result.setups] : [];
  const originalBestSetup = result.bestSetup || null;
  const setupVal = setupDirection(originalBestSetup);
  const setupConflict = Boolean(originalBestSetup && forecastDirection && setupVal !== forecastDirection);

  let router = result.strategyRouter || {};
  if (result.tf === 'M15') {
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
    router = routeRegimeStrategy({
      candles,
      result,
      regime,
      currentPrice: state.price || result.price,
      previousState: regimeRouterState
    });
    regimeRouterState = router.state;
    result.marketRegime = regime;
  }

  result.strategyRouter = {
    ...router,
    role: 'CONTEXT_AND_STRATEGY_SUPPORT',
    mayOverrideValidatedMarketState: false,
    mayOverrideValidatedDirectionForecast: false,
    mayReplaceEntryMap: false,
    marketShiftHardGate: false
  };

  const experimentalSetups = setupConflict || !forecastActive ? [] : originalSetups.map(annotateExperimentalSetup).filter(Boolean);
  const experimentalBestSetup = setupConflict || !forecastActive ? null : annotateExperimentalSetup(originalBestSetup);

  result.unroutedSetups = originalSetups;
  result.unroutedBestSetup = originalBestSetup;
  result.validatedSetupConflict = setupConflict;
  result.experimentalSetups = experimentalSetups;
  result.experimentalBestSetup = experimentalBestSetup;

  if (!forecastActive || setupConflict) {
    result.setups = [];
    result.bestSetup = null;
  } else {
    result.bestSetup = experimentalBestSetup;
    result.setups = experimentalSetups;
  }

  const decision = buildDirectionDecision(result);
  result.directionDecision = decision;
  result.bias = decision.bias;
  result.signal = decision.signal;
  result.statusText = decision.status;
  result.final = decision.bias;
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
    let staleFetchFailed = false;

    await Promise.all(scanGroup.map(async currentTf => {
      const isStale = isCandleStale(currentTf);
      if (!state.candles[currentTf]?.length || isStale) {
        try {
          await fetchTf(currentTf);
        } catch (_) {
          log(`Candle ${currentTf} belum diperbarui, memakai cache.`);
          if (isStale || !state.candles[currentTf]?.length) {
            staleFetchFailed = true;
          }
        }
      }
      return state.candles[currentTf] || [];
    }));

    if (staleFetchFailed) {
      log(`DATA USANG: Cache ${tf} kedaluwarsa & API gagal diperbarui.`);
      const result = {
        tf,
        price: state.price || 0,
        dataStale: true,
        statusText: 'DATA USANG',
        final: 'DATA USANG',
        signal: 'WAIT',
        bestSetup: null,
        entryMap: null,
        setups: [],
        experimentalSetups: [],
        experimentalBestSetup: null,
        routerDecision: 'DATA USANG — CACHE KEDALUWARSA & API GAGAL',
        marketState: { state: 'DATA USANG', detail: 'Cache kedaluwarsa & API gagal diperbarui.' },
        strategyRouter: {
          decision: 'DATA USANG — CACHE KEDALUWARSA & API GAGAL',
          activeRegime: 'TRANSITION',
          activeStrategy: 'NO_TRADE'
        }
      };
      result.directionDecision = buildDirectionDecision(result);
      state.result = result;
      save();
      publishMappingSnapshot(result);
      render();
      return;
    }

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
