import { state, TF, log, save, p2 } from '../main.js';
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

function numStr(val) {
  const n = Number(val);
  return Number.isFinite(n) ? String(n) : '';
}

export function buildSetupId(setup, forecast, tf) {
  if (!setup) return '';
  const dir = String(setup.dir || setup.direction || '').toUpperCase();
  const type = String(setup.type || 'ENTRY_MAP').toUpperCase();
  const lo = numStr(setup.entryLow);
  const hi = numStr(setup.entryHigh);
  const sl = numStr(setup.sl);
  const tp1 = numStr(setup.tp1);
  const tp2 = numStr(setup.tp2);
  const ts = setup.timestamp || 0;
  const fcStartTime = forecast?.startTime != null ? forecast.startTime : 0;
  const fcStartIndex = forecast?.startIndex != null ? forecast.startIndex : 0;
  return `${tf}:${dir}:${type}:${lo}:${hi}:${sl}:${tp1}:${tp2}:${ts}:${fcStartTime}:${fcStartIndex}`;
}

export function validateSetupGeometry(setup, dirSignal) {
  if (!setup) return { valid: false, reason: 'Setup kosong' };

  const isBuy = dirSignal === 'BUY' || String(setup.dir).toUpperCase().includes('BUY');
  const isSell = dirSignal === 'SELL' || String(setup.dir).toUpperCase().includes('SELL');

  const lo = Number(setup.entryLow);
  const hi = Number(setup.entryHigh);
  const sl = Number(setup.sl);
  const tp1 = Number(setup.tp1);
  const tp2 = Number(setup.tp2);
  const singleTarget = Boolean(setup.singleTarget);

  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(sl) || !Number.isFinite(tp1)) {
    return { valid: false, reason: 'Angka entry, SL, atau TP1 tidak valid (NaN).' };
  }

  if (lo > hi) {
    return { valid: false, reason: `entryLow (${lo}) lebih tinggi dari entryHigh (${hi}).` };
  }

  if (!singleTarget) {
    if (!Number.isFinite(tp2)) {
      return { valid: false, reason: 'Target 2 wajib tersedia untuk setup multi-target.' };
    }
  }

  if (isBuy) {
    if (sl >= lo) {
      return { valid: false, reason: `SL BUY (${sl}) harus di bawah entryLow (${lo}).` };
    }
    if (tp1 <= hi) {
      return { valid: false, reason: `Target 1 BUY (${tp1}) harus di atas entryHigh (${hi}).` };
    }
    if (!singleTarget && tp2 < tp1) {
      return { valid: false, reason: `Target 2 BUY (${tp2}) harus lebih tinggi dari Target 1 (${tp1}).` };
    }
  } else if (isSell) {
    if (sl <= hi) {
      return { valid: false, reason: `SL SELL (${sl}) harus di atas entryHigh (${hi}).` };
    }
    if (tp1 >= lo) {
      return { valid: false, reason: `Target 1 SELL (${tp1}) harus di bawah entryLow (${lo}).` };
    }
    if (!singleTarget && tp2 > tp1) {
      return { valid: false, reason: `Target 2 SELL (${tp2}) harus lebih rendah dari Target 1 (${tp1}).` };
    }
  } else {
    return { valid: false, reason: 'Arah setup tidak BUY maupun SELL.' };
  }

  return { valid: true, reason: '' };
}

export function persistTerminalSetup({ setupId, lifecycleStage, status, invalidationReason, entryTouched = false, target1Secured = false, entryAt = null, target1At = null }) {
  if (!setupId) return;
  let lcStorage = {};
  try {
    lcStorage = JSON.parse(localStorage.getItem('amy_mapping_lifecycle_v3') || '{}');
  } catch (_) {}

  const existing = lcStorage[setupId] || {};
  lcStorage[setupId] = {
    setupId,
    entryTouched: Boolean(entryTouched || existing.entryTouched),
    target1Secured: Boolean(target1Secured || existing.target1Secured),
    lifecycleStage,
    status,
    terminal: true,
    invalidationReason,
    entryAt: entryAt || existing.entryAt || null,
    target1At: target1At || existing.target1At || existing.tp1At || null,
    terminalAt: existing.terminalAt || Date.now()
  };

  const keys = Object.keys(lcStorage);
  if (keys.length > 50) {
    keys.slice(0, keys.length - 30).forEach(k => delete lcStorage[k]);
  }
  try {
    localStorage.setItem('amy_mapping_lifecycle_v3', JSON.stringify(lcStorage));
  } catch (_) {}
}

function getActivePointers() {
  try {
    return JSON.parse(localStorage.getItem('amy_mapping_active_pointer_v3') || '{}');
  } catch (_) {
    return {};
  }
}

function saveActivePointers(pointers) {
  const keys = Object.keys(pointers);
  if (keys.length > 50) {
    const sorted = keys.map(k => ({ k, t: pointers[k]?.updatedAt || 0 })).sort((a, b) => a.t - b.t);
    sorted.slice(0, keys.length - 30).forEach(item => delete pointers[item.k]);
  }
  try {
    localStorage.setItem('amy_mapping_active_pointer_v3', JSON.stringify(pointers));
  } catch (_) {}
}

export function buildSetupExecution(result) {
  const defaultExecution = {
    active: false,
    setupId: '',
    direction: 'WAIT',
    status: 'NO_ACTIVE_SETUP',
    lifecycleStage: 'WAITING_ENTRY',
    entryLow: null,
    entryHigh: null,
    stopLoss: null,
    target1: null,
    target2: null,
    singleTarget: true,
    entryTouched: false,
    target1Secured: false,
    terminal: true,
    alignedWithForecast: false,
    geometryValid: false,
    invalidated: false,
    invalidationReason: '',
    liquidityTarget: null
  };

  if (!result) return defaultExecution;

  const dd = result.directionDecision || buildDirectionDecision(result);
  const validated = result.validatedMarketContext;
  const forecast = validated?.directionForecast;
  const forecastActive = Boolean(forecast?.active && !forecast?.invalidated && !forecast?.expired);
  const bestSetup = result.bestSetup;
  const tf = result.tf || 'M15';
  const price = Number(state.price || result.price || localStorage.getItem('last_price') || 0);

  if (result.dataStale || dd.source === 'DATA_STALE') {
    const pointers = getActivePointers();
    const prev = pointers[tf];
    if (prev?.setupId) {
      persistTerminalSetup({
        setupId: prev.setupId,
        lifecycleStage: 'DATA_STALE',
        status: 'DATA USANG',
        invalidationReason: 'Data market usang.'
      });
    }
    return {
      ...defaultExecution,
      status: 'DATA USANG',
      lifecycleStage: 'DATA_STALE',
      invalidated: true,
      invalidationReason: 'Data market usang.'
    };
  }

  if (!forecastActive || dd.invalidated || dd.source !== 'VALIDATED_DIRECTION_FORECAST' || (dd.signal !== 'BUY' && dd.signal !== 'SELL')) {
    const reason = dd.invalidationReason || 'Direction Forecast tidak aktif atau ter-invalidasi.';
    const pointers = getActivePointers();
    const prev = pointers[tf];
    if (prev?.setupId) {
      persistTerminalSetup({
        setupId: prev.setupId,
        lifecycleStage: 'FORECAST_INVALIDATED',
        status: 'FORECAST INVALIDATED',
        invalidationReason: reason
      });
    }
    return {
      ...defaultExecution,
      status: 'FORECAST INVALIDATED',
      lifecycleStage: 'FORECAST_INVALIDATED',
      invalidated: true,
      invalidationReason: reason
    };
  }

  if (!bestSetup) {
    const pointers = getActivePointers();
    const prev = pointers[tf];
    if (prev?.setupId) {
      persistTerminalSetup({
        setupId: prev.setupId,
        lifecycleStage: 'FORECAST_INVALIDATED',
        status: 'WAITING FOR SETUP',
        invalidationReason: 'Belum ada setup Entry Map yang lolos seluruh filter.'
      });
    }
    return {
      ...defaultExecution,
      direction: dd.signal,
      status: 'WAITING FOR SETUP',
      lifecycleStage: 'WAITING_ENTRY',
      alignedWithForecast: true,
      invalidationReason: 'Belum ada setup Entry Map yang lolos seluruh filter.'
    };
  }

  const setupDir = String(bestSetup.dir || bestSetup.direction || '').toUpperCase();
  const setupIsBuy = setupDir.includes('BUY') || setupDir.includes('BULL');
  const setupIsSell = setupDir.includes('SELL') || setupDir.includes('BEAR');
  const aligned = (dd.signal === 'BUY' && setupIsBuy) || (dd.signal === 'SELL' && setupIsSell);

  if (!aligned) {
    const pointers = getActivePointers();
    const prev = pointers[tf];
    if (prev?.setupId) {
      persistTerminalSetup({
        setupId: prev.setupId,
        lifecycleStage: 'FORECAST_INVALIDATED',
        status: 'SETUP CONFLICT',
        invalidationReason: `Setup Entry Map (${setupDir}) bertentangan dengan Direction Forecast (${dd.signal}).`
      });
    }
    return {
      ...defaultExecution,
      direction: dd.signal,
      status: 'SETUP CONFLICT',
      lifecycleStage: 'FORECAST_INVALIDATED',
      alignedWithForecast: false,
      invalidated: true,
      invalidationReason: `Setup Entry Map (${setupDir}) bertentangan dengan Direction Forecast (${dd.signal}).`
    };
  }

  const geom = validateSetupGeometry(bestSetup, dd.signal);
  if (!geom.valid) {
    const pointers = getActivePointers();
    const prev = pointers[tf];
    if (prev?.setupId) {
      persistTerminalSetup({
        setupId: prev.setupId,
        lifecycleStage: 'INVALID_GEOMETRY',
        status: 'INVALID SETUP GEOMETRY',
        invalidationReason: geom.reason
      });
    }
    return {
      ...defaultExecution,
      direction: dd.signal,
      status: 'INVALID SETUP GEOMETRY',
      lifecycleStage: 'INVALID_GEOMETRY',
      alignedWithForecast: true,
      geometryValid: false,
      invalidated: true,
      invalidationReason: geom.reason
    };
  }

  const setupId = buildSetupId(bestSetup, forecast, tf);

  const fcStartTime = forecast?.startTime || 0;
  const pointers = getActivePointers();
  const prevPointer = pointers[tf];

  if (prevPointer && prevPointer.setupId !== setupId) {
    const sameForecast = prevPointer.forecastStartTime === fcStartTime && prevPointer.direction === dd.signal;
    if (sameForecast) {
      persistTerminalSetup({
        setupId: prevPointer.setupId,
        lifecycleStage: 'SETUP_REPLACED',
        status: 'SETUP REPLACED',
        invalidationReason: 'Setup lama telah digantikan oleh setup Entry Map yang lebih baru.'
      });
    } else {
      persistTerminalSetup({
        setupId: prevPointer.setupId,
        lifecycleStage: 'FORECAST_INVALIDATED',
        status: 'FORECAST INVALIDATED',
        invalidationReason: 'Direction Forecast atau arah market telah berubah.'
      });
    }
  }

  pointers[tf] = {
    setupId,
    timeframe: tf,
    direction: dd.signal,
    forecastStartTime: fcStartTime,
    updatedAt: Date.now()
  };
  saveActivePointers(pointers);

  let lcStorage = {};
  try {
    lcStorage = JSON.parse(localStorage.getItem('amy_mapping_lifecycle_v3') || '{}');
  } catch (_) {}

  const savedState = lcStorage[setupId] || {};

  const lo = Math.min(Number(bestSetup.entryLow), Number(bestSetup.entryHigh));
  const hi = Math.max(Number(bestSetup.entryLow), Number(bestSetup.entryHigh));
  const sl = Number(bestSetup.sl);
  const tp1 = Number(bestSetup.tp1);
  const tp2 = Number(bestSetup.tp2);
  const singleTarget = Boolean(bestSetup.singleTarget);
  const isBuy = dd.signal === 'BUY';

  if (savedState.terminal) {
    return {
      ...defaultExecution,
      active: false,
      setupId,
      direction: dd.signal,
      status: savedState.status || 'TERMINAL',
      lifecycleStage: savedState.lifecycleStage || 'FORECAST_INVALIDATED',
      entryLow: lo,
      entryHigh: hi,
      stopLoss: sl,
      target1: tp1,
      target2: Number.isFinite(tp2) ? tp2 : null,
      singleTarget,
      entryTouched: Boolean(savedState.entryTouched),
      target1Secured: Boolean(savedState.target1Secured),
      terminal: true,
      alignedWithForecast: true,
      geometryValid: true,
      invalidated: true,
      invalidationReason: savedState.invalidationReason || 'Setup sudah terminal.',
      liquidityTarget: null
    };
  }

  let entryTouched = Boolean(savedState.entryTouched);
  let target1Secured = Boolean(savedState.target1Secured);

  let liquidityTarget = null;
  const drawTarget = result.liquidityHierarchy?.drawTarget;
  if (drawTarget && Number.isFinite(drawTarget.level)) {
    const levelPrice = Number(drawTarget.level);
    const targetType = String(drawTarget.type || '').toUpperCase();
    
    if (isBuy) {
      const isAbove = levelPrice > Math.max(price, hi);
      const isTypeValid = !targetType || targetType === 'BSL';
      if (isAbove && isTypeValid) {
        liquidityTarget = { type: targetType || 'BSL', level: levelPrice };
      }
    } else {
      const isBelow = levelPrice < Math.min(price, lo);
      const isTypeValid = !targetType || targetType === 'SSL';
      if (isBelow && isTypeValid) {
        liquidityTarget = { type: targetType || 'SSL', level: levelPrice };
      }
    }
  }

  let stage = 'WAITING_ENTRY';
  let statusText = 'MENUNGGU ENTRY';
  let isTerminal = false;
  let invalidReason = '';

  if (bestSetup.timestamp && Date.now() - bestSetup.timestamp > 86400000) {
    stage = 'EXPIRED';
    statusText = 'SETUP EXPIRED';
    isTerminal = true;
    invalidReason = 'Setup sudah kedaluwarsa (lebih dari 24 jam).';
  } else if (price > 0) {
    const reachedTarget1BeforeEntry = !entryTouched && (isBuy ? price >= tp1 : price <= tp1);
    
    if (reachedTarget1BeforeEntry) {
      stage = 'MISSED_ENTRY';
      statusText = 'MISSED ENTRY';
      isTerminal = true;
      invalidReason = 'Harga sudah bergerak mencapai target tanpa menyentuh area entry. Jangan mengejar harga.';
    } else {
      if (!entryTouched && price >= lo && price <= hi) {
        entryTouched = true;
        savedState.entryTouched = true;
        savedState.entryAt = Date.now();
      }

      if (entryTouched) {
        const slHit = isBuy ? price <= sl : price >= sl;
        if (slHit) {
          stage = 'STOPPED';
          statusText = 'SL HIT';
          isTerminal = true;
          invalidReason = `Harga tersentuh Stop Loss pada ${p2(sl)}.`;
        } else {
          const tp1Hit = isBuy ? price >= tp1 : price <= tp1;
          if (tp1Hit) {
            target1Secured = true;
            savedState.target1Secured = true;
            savedState.target1At = Date.now();

            if (singleTarget) {
              stage = 'TARGET_HIT';
              statusText = 'TP1 HIT';
              isTerminal = true;
            } else {
              const tp2Hit = Number.isFinite(tp2) && (isBuy ? price >= tp2 : price <= tp2);
              if (tp2Hit) {
                stage = 'TARGET_HIT';
                statusText = 'TP2 HIT';
                isTerminal = true;
              } else {
                stage = 'RUNNER_ACTIVE';
                statusText = 'TP1 SECURED · RUNNER KE TP2';
                isTerminal = false;
              }
            }
          } else if (target1Secured) {
            stage = 'RUNNER_ACTIVE';
            statusText = 'TP1 SECURED · RUNNER AKTIF';
            isTerminal = false;
          } else {
            stage = 'ENTRY_ACTIVE';
            statusText = 'ENTRY AKTIF';
            isTerminal = false;
          }
        }
      } else {
        stage = 'WAITING_ENTRY';
        statusText = 'MENUNGGU ENTRY';
        isTerminal = false;
      }
    }
  }

  persistTerminalSetup({
    setupId,
    lifecycleStage: stage,
    status: statusText,
    invalidationReason: invalidReason,
    entryTouched,
    target1Secured,
    entryAt: savedState.entryAt,
    target1At: savedState.target1At
  });

  const active = !isTerminal;

  return {
    active,
    setupId,
    direction: dd.signal,
    status: statusText,
    lifecycleStage: stage,
    entryLow: lo,
    entryHigh: hi,
    stopLoss: sl,
    target1: tp1,
    target2: Number.isFinite(tp2) ? tp2 : null,
    singleTarget,
    entryTouched,
    target1Secured,
    terminal: isTerminal,
    alignedWithForecast: true,
    geometryValid: true,
    invalidated: !active,
    invalidationReason: invalidReason,
    liquidityTarget
  };
}

export function buildMappingExplanation(result) {
  if (!result) {
    return {
      headline: 'Data market belum tersedia',
      action: 'Jangan mengambil keputusan entry.',
      reason: 'Analisis Mapping belum tersedia.',
      confirmationNeeded: 'Tunggu data candle dan hasil analisis terbaru.',
      invalidation: '-',
      marketContext: 'BELUM TERSEDIA',
      dataStatus: 'BELUM TERSEDIA'
    };
  }

  const dd = result.directionDecision || buildDirectionDecision(result);
  const se = result.setupExecution || buildSetupExecution(result);
  const validated = result.validatedMarketContext;
  const forecast = validated?.directionForecast;
  const marketState = validated?.marketState;
  const concepts = result.marketConcepts;

  if (dd.source === 'DATA_STALE' || result.dataStale) {
    return {
      headline: 'Data market sudah kedaluwarsa',
      action: 'Jangan mengambil keputusan entry.',
      reason: 'Cache candle telah melewati batas waktu dan API belum berhasil memperbarui data.',
      confirmationNeeded: 'Tunggu data candle terbaru tersedia.',
      invalidation: '-',
      marketContext: 'DATA USANG — CACHE KEDALUWARSA',
      dataStatus: 'DATA USANG'
    };
  }

  if (dd.invalidated && !forecast?.active && (forecast?.invalidated || forecast?.expired || dd.source === 'VALIDATED_DIRECTION_FORECAST')) {
    return {
      headline: 'Arah sebelumnya sudah tidak berlaku',
      action: 'Tunggu Direction Forecast baru.',
      reason: dd.invalidationReason || 'Direction Forecast sebelumnya sudah kedaluwarsa atau dihentikan.',
      confirmationNeeded: 'Structural break dan Direction Forecast baru yang tervalidasi.',
      invalidation: '-',
      marketContext: 'FORECAST INVALID / EXPIRED',
      dataStatus: 'AKTIF'
    };
  }

  if (forecast?.active) {
    const forecastDir = forecast.direction;

    if (se.active && se.alignedWithForecast) {
      const obInfo = concepts?.nearestOrderBlocks?.length ? ` Order Block terdekat di ${p2(concepts.nearestOrderBlocks[0].bottom)}–${p2(concepts.nearestOrderBlocks[0].top)}.` : '';
      const fvgInfo = concepts?.nearestFairValueGaps?.length ? ` FVG terdekat di ${p2(concepts.nearestFairValueGaps[0].bottom)}–${p2(concepts.nearestFairValueGaps[0].top)}.` : '';
      const zoneMention = (obInfo || fvgInfo) ? `${obInfo}${fvgInfo}` : '';
      const targetMention = se.liquidityTarget ? ` Target likuiditas utama: ${se.liquidityTarget.type} ${p2(se.liquidityTarget.level)}.` : '';
      
      return {
        headline: 'Setup searah dengan arah market tervalidasi',
        action: `FOKUS ${se.direction}`,
        reason: `Direction Forecast tervalidasi ${forecastDir} (${forecast.confidence || 60}%). Struktur market ${marketState?.structureTrend || 'TERBENTUK'}.${zoneMention}${targetMention} Status setup: ${se.status}.`,
        confirmationNeeded: se.entryTouched ? 'Setup sedang berjalan dalam area entry.' : `Harga sedang menunggu di area entry ${p2(se.entryLow)}–${p2(se.entryHigh)}.`,
        invalidation: se.stopLoss ? `SL pada ${p2(se.stopLoss)}` : 'Batas invalidasi setup',
        marketContext: `VALIDATED FORECAST ${forecastDir}`,
        dataStatus: 'AKTIF'
      };
    }

    const reasonDetail = se.invalidationReason ? ` (${se.invalidationReason})` : '';
    return {
      headline: 'Arah market tervalidasi, tetapi belum ada area entry',
      action: 'Jangan mengejar harga. Tunggu setup Entry Map searah.',
      reason: `Direction Forecast tervalidasi ${forecastDir} (${forecast.confidence || 60}%). Struktur market ${marketState?.structureTrend || 'TERBENTUK'}.${reasonDetail} Belum ada area entry aktif yang aman.`,
      confirmationNeeded: 'Setup Entry Map searah forecast dan masih aktif.',
      invalidation: 'Structural break berlawanan',
      marketContext: `VALIDATED FORECAST ${forecastDir}`,
      dataStatus: 'AKTIF'
    };
  }

  const stateText = marketState?.state || 'RANGE / TRANSITION';
  return {
    headline: 'Belum ada arah market yang tervalidasi',
    action: 'Tunggu konfirmasi arah baru.',
    reason: `Kondisi market saat ini adalah ${stateText}. Kondisi ini merupakan konteks perilaku harga, bukan sinyal BUY atau SELL.`,
    confirmationNeeded: 'Membutuhkan structural break terkonfirmasi dan Direction Forecast aktif.',
    invalidation: '-',
    marketContext: stateText,
    dataStatus: 'AKTIF'
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
  const execution = result?.setupExecution || buildSetupExecution(result);
  const explanation = result?.mappingExplanation || buildMappingExplanation(result);
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
    setupExecution: execution,
    mappingExplanation: explanation,
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
  result.setupExecution = buildSetupExecution(result);
  result.mappingExplanation = buildMappingExplanation(result);
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
      result.setupExecution = buildSetupExecution(result);
      result.mappingExplanation = buildMappingExplanation(result);
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
    if (state.result) {
      state.result.setupExecution = buildSetupExecution(state.result);
      state.result.mappingExplanation = buildMappingExplanation(state.result);
    }
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
