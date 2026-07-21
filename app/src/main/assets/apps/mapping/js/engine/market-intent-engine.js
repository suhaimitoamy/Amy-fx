const EPSILON = 1e-9;

function numeric(value, fallback = NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function directionValue(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('BULL') || text === 'BUY' || text === 'LONG') return 1;
  if (text.includes('BEAR') || text === 'SELL' || text === 'SHORT') return -1;
  return 0;
}

function cleanCandles(candles) {
  return (Array.isArray(candles) ? candles : [])
    .map((candle, index) => ({
      index,
      time: numeric(candle?.time, index),
      open: numeric(candle?.open),
      high: numeric(candle?.high),
      low: numeric(candle?.low),
      close: numeric(candle?.close)
    }))
    .filter(candle => [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite));
}

function targetLabel(target) {
  const label = String(target?.label || target?.subtype || target?.type || 'LIQUIDITY').toUpperCase();
  if (label === 'HIGH' || label === 'SWING HIGH') return 'BSL LOKAL';
  if (label === 'LOW' || label === 'SWING LOW') return 'SSL LOKAL';
  return label;
}

function targetType(target) {
  const text = `${target?.type || ''} ${target?.label || ''} ${target?.subtype || ''}`.toUpperCase();
  if (text.includes('BSL') || text.includes('HIGH') || text.includes('PDH') || text.includes('PWH')) return 'BSL';
  if (text.includes('SSL') || text.includes('LOW') || text.includes('PDL') || text.includes('PWL')) return 'SSL';
  return '';
}

function fallbackTargets(candles, price) {
  const window = candles.slice(-48, -1);
  if (!window.length || !(price > 0)) return [];
  const high = Math.max(...window.map(candle => candle.high));
  const low = Math.min(...window.map(candle => candle.low));
  const targets = [];
  if (high > price) targets.push({ type: 'BSL', label: 'BSL LOKAL', level: high, source: 'LOCAL_RANGE', strength: 'MEDIUM' });
  if (low < price) targets.push({ type: 'SSL', label: 'SSL LOKAL', level: low, source: 'LOCAL_RANGE', strength: 'MEDIUM' });
  return targets;
}

function activeTargets(result, candles, price) {
  const hierarchy = result?.marketConcepts?.liquidityHierarchy || result?.liquidityHierarchy || {};
  const supplied = Array.isArray(hierarchy.activeTargets)
    ? hierarchy.activeTargets
    : Array.isArray(result?.activeLiquidityTargets)
      ? result.activeLiquidityTargets
      : [];
  const candidates = supplied
    .map(target => ({ ...target, type: targetType(target), level: numeric(target?.level ?? target?.price) }))
    .filter(target => target.type && Number.isFinite(target.level) && target.level > 0)
    .filter(target => target.type === 'BSL' ? target.level > price : target.level < price);

  const addFallback = (type, level, label) => {
    const value = numeric(level);
    if (!(value > 0) || candidates.some(target => target.type === type)) return;
    if (type === 'BSL' ? value > price : value < price) {
      candidates.push({ type, level: value, label, source: 'CONCEPT_FALLBACK', strength: 'MEDIUM' });
    }
  };
  addFallback('BSL', result?.bsl, 'BSL');
  addFallback('SSL', result?.ssl, 'SSL');

  if (!candidates.length) candidates.push(...fallbackTargets(candles, price));
  return candidates;
}

function recentSweep(result) {
  const concepts = result?.marketConcepts || {};
  const sweep = concepts.latestConfirmedSweep || concepts.structure?.lastSweep || result?.st?.lastSweep || null;
  if (!sweep) return null;
  const type = targetType({
    type: sweep.type || sweep.brokenSide,
    label: sweep.label || sweep.dir || sweep.direction,
    subtype: sweep.concept
  });
  return type ? { ...sweep, type, level: numeric(sweep.level ?? sweep.price) } : null;
}

function nearestRetraceZone(result, direction, price) {
  const concepts = result?.marketConcepts || {};
  const zones = [
    ...(Array.isArray(concepts.nearestOrderBlocks) ? concepts.nearestOrderBlocks : []),
    ...(Array.isArray(concepts.nearestFairValueGaps) ? concepts.nearestFairValueGaps : [])
  ].filter(zone => zone && zone.status !== 'INVALIDATED');
  const expected = direction > 0 ? 'BULLISH' : direction < 0 ? 'BEARISH' : '';
  const aligned = zones.filter(zone => !expected || String(zone.direction || '').toUpperCase().includes(expected));
  const usable = aligned.length ? aligned : zones;
  return usable
    .map(zone => ({
      ...zone,
      middle: (numeric(zone.top) + numeric(zone.bottom)) / 2,
      distance: Math.abs(((numeric(zone.top) + numeric(zone.bottom)) / 2) - price)
    }))
    .filter(zone => Number.isFinite(zone.middle))
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

function scoreTarget(target, context) {
  const { price, atr, regime, result, sweep, contextDirection } = context;
  const side = target.type === 'BSL' ? 1 : -1;
  const distanceAtr = Math.abs(target.level - price) / Math.max(atr, EPSILON);
  let score = 26 + 22 / (1 + distanceAtr * 0.42);
  const strength = String(target.strength || '').toUpperCase();
  if (strength === 'STRONG') score += 8;
  if (/PWH|PWL/.test(targetLabel(target))) score += 7;
  else if (/PDH|PDL/.test(targetLabel(target))) score += 5;

  if (contextDirection) score += side === contextDirection ? 20 : -11;
  const setupDirection = directionValue(result?.bestSetup?.dir || result?.bestSetup?.direction);
  if (setupDirection) score += side === setupDirection ? 13 : -7;

  const regimeName = String(regime?.regime || 'TRANSITION').toUpperCase();
  const location = numeric(regime?.features?.rangeLocation, 0.5);
  if (regimeName === 'TRENDING' || regimeName === 'EXPANSION') {
    score += side === contextDirection ? 12 : -5;
  } else if (regimeName === 'RANGING') {
    if (location <= 0.42) score += side > 0 ? 11 : -3;
    if (location >= 0.58) score += side < 0 ? 11 : -3;
  } else if (regimeName === 'MANIPULATION' && sweep) {
    score += sweep.type !== target.type ? 18 : -6;
  } else if (regimeName === 'TRANSITION') {
    score -= 7;
  }

  const drawTarget = result?.marketConcepts?.liquidityHierarchy?.drawTarget || result?.drawTarget;
  if (drawTarget && numeric(drawTarget.level ?? drawTarget.price) === target.level) score += 6;
  return { ...target, label: targetLabel(target), distanceAtr, score };
}

function htfContextDirection(result, regime) {
  const htf = numeric(regime?.features?.htfScore, 0);
  const structure = directionValue(result?.st?.confirmedTrend || result?.st?.trend);
  const ema = Math.sign(numeric(regime?.features?.emaSlopeAtr, 0));
  const weighted = htf * 0.5 + structure * 0.32 + ema * 0.18;
  return Math.abs(weighted) >= 0.12 ? Math.sign(weighted) : 0;
}

function formatLevel(level) {
  return Number.isFinite(level) ? level.toFixed(2) : '-';
}

function pathFor({ direction, primary, secondary, regime, sweep, zone, price }) {
  const bullish = direction > 0;
  const targetText = `${primary.label} ${formatLevel(primary.level)}`;
  const opposite = bullish ? 'SSL' : 'BSL';
  const mss = bullish ? 'Bullish MSS / reclaim' : 'Bearish MSS / reclaim';
  const zoneText = zone
    ? `${String(zone.kind || zone.type || 'FVG/OB').toUpperCase()} ${formatLevel(zone.bottom)}–${formatLevel(zone.top)}`
    : 'area value / retracement';
  const regimeName = String(regime?.regime || 'TRANSITION').toUpperCase();

  if (regimeName === 'TRANSITION' || numeric(regime?.shift?.risk, 0) >= 55) {
    return [
      'Tunggu sweep atau close struktur yang jelas',
      mss,
      `Retest ${zoneText}`,
      `Skenario valid menuju ${targetText}`
    ];
  }
  if (sweep && sweep.type === opposite) {
    return [
      `${opposite} ${formatLevel(sweep.level)} sudah disapu`,
      mss,
      `Retest ke ${zoneText}`,
      `Ekspansi menuju ${targetText}`
    ];
  }
  if (regimeName === 'MANIPULATION') {
    return [
      `Cari sweep ${opposite} terlebih dahulu`,
      mss,
      `Entry hanya setelah retest ${zoneText}`,
      `Tujuan utama ${targetText}`
    ];
  }
  if (regimeName === 'RANGING') {
    return [
      `Reaksi dari sisi range dekat ${formatLevel(price)}`,
      'Rotasi melewati equilibrium',
      secondary ? `Ambil liquidity antara ${secondary.label}` : 'Ambil internal liquidity',
      `Tujuan luar ${targetText}`
    ];
  }
  return [
    `Harga bertahan di ${formatLevel(price)}`,
    `Pullback ke ${zoneText}`,
    bullish ? 'Higher low dan continuation' : 'Lower high dan continuation',
    `Target liquidity ${targetText}`
  ];
}

export function deriveMarketIntent({ result = null, regime = null, candles = [] } = {}) {
  const values = cleanCandles(candles);
  const price = numeric(result?.price, values.at(-1)?.close);
  const waiting = {
    version: '3.0.0-preview',
    status: 'WAITING',
    direction: 'WAIT',
    headline: 'MEMINDAI MARKET',
    decision: 'TUNGGU DATA M15',
    confidence: 0,
    primary: null,
    secondary: null,
    invalidation: null,
    path: ['Memuat candle M15', 'Membaca HTF', 'Menyusun liquidity objective', 'Menunggu hasil'],
    reasons: ['Market Intent membutuhkan hasil Mapping dan minimal 30 candle tertutup.']
  };
  if (!result || values.length < 30 || !(price > 0)) return waiting;

  const atr = Math.max(numeric(regime?.features?.atr, 0), Math.abs(price) * 0.0005, EPSILON);
  const sweep = recentSweep(result);
  const contextDirection = htfContextDirection(result, regime);
  const scored = activeTargets(result, values, price)
    .map(target => scoreTarget(target, { price, atr, regime, result, sweep, contextDirection }))
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return { ...waiting, status: 'NO_TARGET', headline: 'LIQUIDITY BELUM TERBACA' };

  const primary = scored[0];
  const secondary = scored[1] || null;
  const gap = primary.score - (secondary?.score ?? primary.score - 18);
  const side = primary.type === 'BSL' ? 1 : -1;
  const regimeConfidence = numeric(regime?.confidence, 0) / 100;
  const htfConsensus = numeric(regime?.features?.htfConsensus, 0);
  const shiftRisk = numeric(regime?.shift?.risk, 0);
  const dataRisk = numeric(regime?.features?.dataRisk, 0);
  const targetQuality = String(primary.source || '').includes('LOCAL_RANGE') ? 0.55 : 1;
  const clarity = clamp((gap + 16) / 48);
  let confidence = Math.round(clamp(
    0.49 * clarity + 0.25 * regimeConfidence + 0.16 * htfConsensus + 0.10 * targetQuality,
    0,
    1
  ) * 100 - shiftRisk * 0.22 - dataRisk * 18);
  confidence = Math.round(clamp(confidence, 24, 89));

  const conflicting = contextDirection && side !== contextDirection;
  const uncertainRegime = String(regime?.regime || '').toUpperCase() === 'TRANSITION';
  const closeRace = secondary && Math.abs(gap) < 7;
  const direction = conflicting && (uncertainRegime || closeRace) ? 0 : side;
  if (!direction) confidence = Math.min(confidence, 52);

  const invalidation = scored.find(target => target.type !== primary.type) || null;
  const zone = nearestRetraceZone(result, direction || side, price);
  const activeSetupDirection = directionValue(result?.bestSetup?.dir || result?.bestSetup?.direction);
  const setupActive = Boolean(result?.bestSetup && result?.bestSetup?.lifecycle?.live !== false && result?.bestSetup?.live !== false);

  let decision = 'WAIT — TUNGGU KONFIRMASI M15';
  if (shiftRisk >= 55 || uncertainRegime) {
    decision = 'WAIT — MARKET SEDANG BERUBAH';
  } else if (direction > 0) {
    decision = setupActive && activeSetupDirection > 0 ? 'SETUP BUY M15 AKTIF' : 'TUNGGU SETUP BUY M15';
  } else if (direction < 0) {
    decision = setupActive && activeSetupDirection < 0 ? 'SETUP SELL M15 AKTIF' : 'TUNGGU SETUP SELL M15';
  }

  const reasons = [];
  reasons.push(`${primary.label} menjadi liquidity objective terkuat dengan jarak ${primary.distanceAtr.toFixed(2)} ATR.`);
  if (contextDirection) reasons.push(`HTF, struktur, dan momentum lebih condong ${contextDirection > 0 ? 'bullish' : 'bearish'}.`);
  else reasons.push('Arah HTF belum kompak; objective dibaca terutama dari liquidity terdekat dan regime.');
  if (sweep) reasons.push(`${sweep.type} terakhir sudah bereaksi; jalur berikutnya menunggu konfirmasi MSS.`);
  if (shiftRisk >= 30) reasons.push(`Risiko Market Shift ${Math.round(shiftRisk)}%; skenario wajib menunggu konfirmasi.`);

  return {
    version: '3.0.0-preview',
    status: 'READY',
    direction: direction > 0 ? 'BULLISH' : direction < 0 ? 'BEARISH' : 'WAIT',
    headline: direction > 0 ? 'NAIK KE BSL' : direction < 0 ? 'TURUN KE SSL' : 'ARAH BELUM BERSIH',
    decision,
    confidence,
    confidenceLabel: 'Kejelasan konteks',
    price,
    primary,
    secondary,
    invalidation,
    sweep,
    retraceZone: zone,
    regime: regime?.regime || 'TRANSITION',
    shiftRisk,
    path: pathFor({ direction: direction || side, primary, secondary, regime, sweep, zone, price }),
    reasons: reasons.slice(0, 4),
    condition: direction
      ? `Skenario berlaku selama struktur tidak menembus ${invalidation ? `${invalidation.label} ${formatLevel(invalidation.level)}` : 'batas salah terdekat'}.`
      : 'Jangan memilih arah sebelum MSS dan retest memberi konfirmasi.'
  };
}
