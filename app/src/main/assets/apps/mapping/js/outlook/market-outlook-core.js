const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const OUTLOOK_HORIZONS = [
  {
    id: 'INTRADAY',
    label: '1–4 Jam',
    horizonMs: 4 * HOUR,
    weights: { M15: 4, M30: 3, H1: 3, H4: 1 }
  },
  {
    id: 'SESSION',
    label: 'Sesi Berjalan',
    horizonMs: 8 * HOUR,
    weights: { M15: 1, M30: 3, H1: 4, H4: 3 }
  },
  {
    id: 'DAILY',
    label: '24 Jam',
    horizonMs: DAY,
    weights: { H1: 2, H4: 5, D1: 6 }
  }
];

const MAX_MODEL_PROBABILITY = 76;
const MIN_MODEL_PROBABILITY = 45;

function num(value, fallback = NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function signOf(direction) {
  const value = String(direction || '').toUpperCase();
  if (value.includes('BULL')) return 1;
  if (value.includes('BEAR')) return -1;
  return 0;
}

function directionName(score, threshold = 0.16) {
  if (Math.abs(score) < threshold) return 'RANGE';
  return score > 0 ? 'BULLISH' : 'BEARISH';
}

function trueRange(candle, previousClose) {
  if (!candle) return 0;
  const high = num(candle.high, 0);
  const low = num(candle.low, 0);
  if (!Number.isFinite(previousClose)) return Math.max(0, high - low);
  return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
}

export function atr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < 2) return 0;
  const start = Math.max(1, candles.length - period);
  const values = [];
  for (let index = start; index < candles.length; index += 1) {
    values.push(trueRange(candles[index], num(candles[index - 1]?.close)));
  }
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function volatilityState(candles) {
  if (!Array.isArray(candles) || candles.length < 30) {
    return { atr: atr(candles), ratio: 1, recentRangeAtr: 0 };
  }
  const currentAtr = atr(candles, 14);
  const historical = [];
  for (let end = Math.max(16, candles.length - 70); end <= candles.length; end += 7) {
    historical.push(atr(candles.slice(0, end), 14));
  }
  const baseline = median(historical) || currentAtr || 1;
  const recent = candles.slice(-20);
  const high = Math.max(...recent.map(item => num(item.high, -Infinity)));
  const low = Math.min(...recent.map(item => num(item.low, Infinity)));
  return {
    atr: currentAtr,
    ratio: currentAtr > 0 ? currentAtr / baseline : 1,
    recentRangeAtr: currentAtr > 0 && Number.isFinite(high) && Number.isFinite(low)
      ? (high - low) / currentAtr
      : 0
  };
}

function validBreakDirection(result) {
  const item = result?.st?.last;
  if (!item || item.breakType !== 'VALID_BREAK' || !item.valid) return 0;
  return signOf(item.dir);
}

function sweepReversalDirection(result) {
  const item = result?.st?.last;
  if (!item || !(item.breakType === 'SWEEP_ONLY' || item.sweepOnly)) return 0;
  const attempt = signOf(item.dir);
  return attempt === -1 ? 1 : attempt === 1 ? -1 : 0;
}

function collectVotes(analyses, weights) {
  let score = 0;
  let maximum = 0;
  const votes = [];
  for (const [tf, weight] of Object.entries(weights || {})) {
    const result = analyses?.[tf];
    if (!result) continue;
    const local = signOf(result.st?.trend);
    const composite = signOf(result.final);
    const vote = local || composite;
    if (vote) votes.push(vote);
    score += local * weight;
    score += composite * weight * 0.35;
    maximum += weight * 1.35;
  }
  return {
    score,
    maximum: maximum || 1,
    votes,
    consensus: votes.length
      ? Math.max(
          votes.filter(value => value === 1).length,
          votes.filter(value => value === -1).length
        ) / votes.length
      : 0
  };
}

function activeLevels(result, price) {
  const hierarchy = result?.liquidityHierarchy || {};
  const raw = Array.isArray(hierarchy.activeTargets)
    ? hierarchy.activeTargets
    : Array.isArray(result?.activeLiquidityTargets)
      ? result.activeLiquidityTargets
      : [];
  return raw
    .map(item => ({ ...item, level: num(item.level) }))
    .filter(item => Number.isFinite(item.level) && item.level > 0)
    .filter(item => item.type === 'BSL' ? item.level > price : item.type === 'SSL' ? item.level < price : false)
    .sort((a, b) => Math.abs(a.level - price) - Math.abs(b.level - price));
}

function allLevels(analyses, result, price) {
  const merged = [];
  for (const item of [result, ...Object.values(analyses || {})]) {
    for (const level of activeLevels(item, price)) {
      if (!merged.some(existing => existing.type === level.type && Math.abs(existing.level - level.level) < 0.05)) {
        merged.push(level);
      }
    }
  }
  return merged.sort((a, b) => Math.abs(a.level - price) - Math.abs(b.level - price));
}

function locationOf(result) {
  return String(result?.premiumDiscountZone || result?.zone || 'EQUILIBRIUM').toUpperCase();
}

function freshnessPenalty(freshness) {
  const values = Object.values(freshness || {});
  if (!values.length) return { penalty: 5, risk: 'Freshness candle belum terverifikasi.' };
  const stale = values.filter(item => String(item?.state || '').includes('STALE')).length;
  const cache = values.filter(item => String(item?.state || '').includes('CACHE')).length;
  if (stale) return { penalty: 10, risk: `${stale} timeframe memakai candle stale.` };
  if (cache) return { penalty: 6, risk: `${cache} timeframe belum terverifikasi penuh.` };
  return { penalty: 0, risk: '' };
}

function newsPenalty(newsRisk) {
  const value = String(newsRisk || 'UNKNOWN').toUpperCase();
  if (value === 'HIGH') return { penalty: 7, risk: 'Risiko berita tinggi dapat mengubah arah secara tiba-tiba.' };
  if (value === 'ELEVATED') return { penalty: 4, risk: 'Risiko berita meningkat; proyeksi perlu dibaca lebih hati-hati.' };
  if (value === 'UNKNOWN') return { penalty: 3, risk: 'Risiko berita belum terverifikasi.' };
  return { penalty: 0, risk: '' };
}

export function detectMarketRegime({ analyses = {}, candlesByTf = {}, newsRisk = 'UNKNOWN', freshness = {} } = {}) {
  const trends = ['M15', 'M30', 'H1', 'H4', 'D1']
    .map(tf => signOf(analyses?.[tf]?.st?.trend || analyses?.[tf]?.final))
    .filter(Boolean);
  const consensus = trends.length
    ? Math.max(
        trends.filter(value => value === 1).length,
        trends.filter(value => value === -1).length
      ) / trends.length
    : 0;
  const vol = volatilityState(candlesByTf.M15 || candlesByTf.H1 || []);
  const stale = Object.values(freshness || {}).some(item => String(item?.state || '').includes('STALE'));
  const hasTransition = Object.values(analyses || {}).some(result => {
    const type = result?.st?.last?.breakType;
    return type === 'SWEEP_ONLY' || type === 'BREAK_FAILED';
  });

  if (String(newsRisk).toUpperCase() === 'HIGH' && vol.ratio >= 1.2) {
    return { id: 'NEWS_DRIVEN', label: 'NEWS-DRIVEN', consensus, ...vol };
  }
  if (stale) return { id: 'DATA_RISK', label: 'DATA RISK', consensus, ...vol };
  if (vol.ratio >= 1.55) return { id: 'HIGH_VOLATILITY', label: 'HIGH VOLATILITY', consensus, ...vol };
  if (hasTransition || (consensus > 0 && consensus < 0.66)) {
    return { id: 'TRANSITION', label: 'TRANSITION / REVERSAL RISK', consensus, ...vol };
  }
  if (consensus >= 0.75 && vol.recentRangeAtr >= 2.8) {
    return { id: 'TRENDING', label: 'TRENDING', consensus, ...vol };
  }
  if (consensus <= 0.55 || (vol.recentRangeAtr > 0 && vol.recentRangeAtr < 2.2)) {
    return { id: 'RANGING', label: 'RANGING', consensus, ...vol };
  }
  return { id: 'BALANCED', label: 'BALANCED / MIXED', consensus, ...vol };
}

function sessionDuration(session, now) {
  const value = String(session?.id || session?.name || '').toUpperCase();
  if (!value || value.includes('OFF')) return 6 * HOUR;
  const date = new Date(now);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const [hour, minute] = formatter.format(date).split(':').map(Number);
  const currentMinutes = hour * 60 + minute;
  const endMinutes = value.includes('ASIA') ? 12 * 60
    : value.includes('LONDON') ? 17 * 60
      : value.includes('NEW') ? 23 * 60 : currentMinutes + 6 * 60;
  const remaining = (endMinutes - currentMinutes) * 60 * 1000;
  return clamp(remaining, HOUR, 8 * HOUR);
}

function horizonConfig(horizon, session, now) {
  return horizon.id === 'SESSION'
    ? { ...horizon, horizonMs: sessionDuration(session, now) }
    : horizon;
}

function choosePrimaryTarget(direction, levels, price) {
  if (direction === 'BULLISH') return levels.find(item => item.type === 'BSL' && item.level > price) || null;
  if (direction === 'BEARISH') return levels.find(item => item.type === 'SSL' && item.level < price) || null;
  return levels[0] || null;
}

function chooseSecondaryTarget(direction, levels, primary) {
  const sameType = direction === 'BULLISH' ? 'BSL' : direction === 'BEARISH' ? 'SSL' : primary?.type;
  return levels.find(item =>
    item.type === sameType
    && (!primary || Math.abs(item.level - primary.level) > 0.05)
  ) || null;
}

function chooseInvalidation(direction, levels, result, price, atrValue) {
  const range = result?.dealingRange || {};
  if (direction === 'BULLISH') {
    const opposite = levels.find(item => item.type === 'SSL' && item.level < price);
    return opposite?.level || num(range.low, price - Math.max(atrValue * 1.2, price * 0.001));
  }
  if (direction === 'BEARISH') {
    const opposite = levels.find(item => item.type === 'BSL' && item.level > price);
    return opposite?.level || num(range.high, price + Math.max(atrValue * 1.2, price * 0.001));
  }
  const lower = levels.find(item => item.type === 'SSL' && item.level < price)?.level;
  const upper = levels.find(item => item.type === 'BSL' && item.level > price)?.level;
  return { lower: lower || price - atrValue, upper: upper || price + atrValue };
}

function probabilityParts(primaryProbability) {
  const primary = clamp(Math.round(primaryProbability), MIN_MODEL_PROBABILITY, MAX_MODEL_PROBABILITY);
  const remaining = 100 - primary;
  const alternative = Math.max(14, Math.round(remaining * 0.62));
  return {
    primary,
    alternative,
    invalidation: Math.max(0, 100 - primary - alternative)
  };
}

function targetLabel(target) {
  return target ? `${target.type} ${target.level.toFixed(2)}` : 'Belum ada target liquidity aktif';
}

function pathText(direction, price, result, primary, secondary) {
  const equilibrium = num(result?.dealingRange?.equilibrium);
  const location = locationOf(result);
  const parts = [`${price.toFixed(2)}`];

  if (direction === 'BULLISH') {
    if (Number.isFinite(equilibrium) && equilibrium > price && (!primary || equilibrium < primary.level)) {
      parts.push(`EQ ${equilibrium.toFixed(2)}`);
    } else if (location === 'PREMIUM') {
      parts.push('konsolidasi / pullback');
    }
  } else if (direction === 'BEARISH') {
    if (Number.isFinite(equilibrium) && equilibrium < price && (!primary || equilibrium > primary.level)) {
      parts.push(`EQ ${equilibrium.toFixed(2)}`);
    } else if (location === 'DISCOUNT') {
      parts.push('retracement / konsolidasi');
    }
  } else {
    const low = primary?.type === 'SSL' ? primary : secondary?.type === 'SSL' ? secondary : null;
    const high = primary?.type === 'BSL' ? primary : secondary?.type === 'BSL' ? secondary : null;
    return low && high
      ? `${low.level.toFixed(2)} ↔ ${high.level.toFixed(2)}`
      : `${price.toFixed(2)} → konsolidasi hingga struktur memilih sisi`;
  }

  if (primary) parts.push(targetLabel(primary));
  if (secondary) parts.push(targetLabel(secondary));
  return parts.join(' → ');
}

function scenarioText(direction, horizonLabel, target) {
  if (direction === 'BULLISH') {
    return `Harga lebih mungkin melanjutkan kenaikan selama struktur pendukung bertahan, dengan fokus ${targetLabel(target)} pada horizon ${horizonLabel}.`;
  }
  if (direction === 'BEARISH') {
    return `Harga lebih mungkin melanjutkan penurunan selama struktur pendukung bertahan, dengan fokus ${targetLabel(target)} pada horizon ${horizonLabel}.`;
  }
  return `Harga lebih mungkin bergerak dua arah di dalam range sampai ada candle close yang memilih sisi struktur.`;
}

function alternativeText(direction, result, target) {
  const equilibrium = num(result?.dealingRange?.equilibrium);
  const eqText = Number.isFinite(equilibrium) ? `equilibrium ${equilibrium.toFixed(2)}` : 'area keseimbangan';
  if (direction === 'BULLISH') {
    return `Harga dapat melakukan pullback atau konsolidasi menuju ${eqText} sebelum kembali mencoba ${targetLabel(target)}.`;
  }
  if (direction === 'BEARISH') {
    return `Harga dapat melakukan retracement atau konsolidasi menuju ${eqText} sebelum kembali mencoba ${targetLabel(target)}.`;
  }
  return 'Alternatifnya, salah satu sisi liquidity ditembus dan market berubah dari ranging menjadi trending.';
}

function invalidationText(direction, invalidation) {
  if (direction === 'BULLISH') {
    return `Proyeksi bullish batal jika candle konteks menutup tegas di bawah ${num(invalidation).toFixed(2)}.`;
  }
  if (direction === 'BEARISH') {
    return `Proyeksi bearish batal jika candle konteks menutup tegas di atas ${num(invalidation).toFixed(2)}.`;
  }
  return `Proyeksi range batal jika harga menutup di luar ${num(invalidation?.lower).toFixed(2)}–${num(invalidation?.upper).toFixed(2)}.`;
}

function supportingFactors(direction, analyses, result, regime, primaryTarget) {
  const factors = [];
  const relevant = ['M15', 'M30', 'H1', 'H4', 'D1'];
  const aligned = relevant.filter(tf => signOf(analyses?.[tf]?.st?.trend) === signOf(direction));
  if (aligned.length) factors.push(`${aligned.join(', ')} mendukung arah ${direction.toLowerCase()}.`);
  const htf = String(result?.htfNarrative?.htfBias || '').toUpperCase();
  if (htf === direction) factors.push(`Bias HTF ${htf.toLowerCase()} selaras.`);
  if (primaryTarget) factors.push(`${targetLabel(primaryTarget)} masih aktif pada sisi harga yang benar.`);
  const breakDirection = validBreakDirection(result);
  if (breakDirection && breakDirection === signOf(direction)) factors.push('Ada break struktur valid yang searah.');
  if (regime.id === 'TRENDING') factors.push('Regime market sedang trending.');
  return factors.slice(0, 4);
}

function riskFactors(direction, result, regime, news, freshness) {
  const risks = [];
  const location = locationOf(result);
  if (direction === 'BEARISH' && location === 'DISCOUNT') {
    risks.push('Harga sudah berada di discount; penurunan dapat didahului retracement.');
  }
  if (direction === 'BULLISH' && location === 'PREMIUM') {
    risks.push('Harga sudah berada di premium; kenaikan dapat didahului pullback.');
  }
  if (regime.id === 'RANGING') risks.push('Regime ranging meningkatkan risiko false break.');
  if (regime.id === 'TRANSITION') risks.push('Market berada pada fase transisi; arah dapat berubah setelah konfirmasi baru.');
  if (regime.id === 'HIGH_VOLATILITY') risks.push('Volatilitas tinggi memperbesar deviasi jalur harga.');
  const newsInfo = newsPenalty(news);
  const freshInfo = freshnessPenalty(freshness);
  if (newsInfo.risk) risks.push(newsInfo.risk);
  if (freshInfo.risk) risks.push(freshInfo.risk);
  return risks.slice(0, 4);
}

function calibrateProbability({
  normalizedScore,
  direction,
  result,
  analyses,
  regime,
  newsRisk,
  freshness,
  primaryTarget
}) {
  let probability = 50 + Math.abs(normalizedScore) * 23;
  const local = signOf(result?.st?.trend);
  const htf = signOf(result?.htfNarrative?.htfBias);
  const desired = signOf(direction);

  if (desired && local === desired && htf === desired) probability += 4;
  if (validBreakDirection(result) === desired) probability += 3;
  if (primaryTarget) probability += 2;
  if (sweepReversalDirection(result) === desired) probability += 1.5;

  const location = locationOf(result);
  const stretched = (direction === 'BEARISH' && location === 'DISCOUNT')
    || (direction === 'BULLISH' && location === 'PREMIUM');
  if (stretched) probability -= 5;
  if (regime.id === 'TRENDING' && desired) probability += 3;
  if (regime.id === 'RANGING' && desired) probability -= 5;
  if (regime.id === 'TRANSITION') probability -= 4;
  if (regime.id === 'HIGH_VOLATILITY') probability -= 2;
  if (direction === 'RANGE') probability = 52 + (1 - Math.abs(normalizedScore)) * 8;

  probability -= newsPenalty(newsRisk).penalty;
  probability -= freshnessPenalty(freshness).penalty;

  const timeframeCount = Object.keys(analyses || {}).filter(key => analyses[key]).length;
  if (timeframeCount < 4) probability -= 4;

  const probabilityCap = stretched ? 70 : MAX_MODEL_PROBABILITY;
  return clamp(probability, MIN_MODEL_PROBABILITY, probabilityCap);
}

export function buildMarketOutlooks({
  result,
  analyses = {},
  candlesByTf = {},
  price,
  newsRisk = 'UNKNOWN',
  freshness = {},
  session = {},
  now = Date.now()
} = {}) {
  const currentPrice = num(price || result?.price);
  if (!result || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { generatedAt: now, regime: { id: 'WAIT', label: 'WAITING DATA' }, outlooks: [], trackable: false };
  }

  const combinedAnalyses = { ...analyses };
  if (!combinedAnalyses[result.tf]) combinedAnalyses[result.tf] = result;
  const regime = detectMarketRegime({ analyses: combinedAnalyses, candlesByTf, newsRisk, freshness });
  const levels = allLevels(combinedAnalyses, result, currentPrice);
  const atrValue = atr(candlesByTf.M15 || candlesByTf.H1 || []);
  const outlooks = OUTLOOK_HORIZONS.map(base => {
    const config = horizonConfig(base, session, now);
    const votes = collectVotes(combinedAnalyses, config.weights);
    let normalized = votes.score / votes.maximum;

    const htfDirection = signOf(result?.htfNarrative?.htfBias);
    normalized += htfDirection * (config.id === 'DAILY' ? 0.16 : 0.08);
    normalized += validBreakDirection(result) * 0.07;
    normalized += sweepReversalDirection(result) * 0.03;

    const draw = result?.liquidityHierarchy?.drawTarget;
    const drawDirection = draw?.type === 'BSL' ? 1 : draw?.type === 'SSL' ? -1 : 0;
    normalized += drawDirection * 0.06;
    normalized = clamp(normalized, -1, 1);

    const direction = directionName(normalized);
    const primaryTarget = choosePrimaryTarget(direction, levels, currentPrice);
    const secondaryTarget = chooseSecondaryTarget(direction, levels, primaryTarget);
    const invalidation = chooseInvalidation(direction, levels, result, currentPrice, atrValue || currentPrice * 0.001);
    const probability = calibrateProbability({
      normalizedScore: normalized,
      direction,
      result,
      analyses: combinedAnalyses,
      regime,
      newsRisk,
      freshness,
      primaryTarget
    });
    const probabilities = probabilityParts(probability);

    return {
      id: config.id,
      label: config.label,
      direction,
      probability: probabilities.primary,
      alternativeProbability: probabilities.alternative,
      invalidationProbability: probabilities.invalidation,
      horizonMs: config.horizonMs,
      expiresAt: now + config.horizonMs,
      startPrice: currentPrice,
      primaryTarget: primaryTarget?.level || null,
      primaryTargetType: primaryTarget?.type || null,
      secondaryTarget: secondaryTarget?.level || null,
      secondaryTargetType: secondaryTarget?.type || null,
      invalidation,
      scenario: scenarioText(direction, config.label, primaryTarget),
      alternativeScenario: alternativeText(direction, result, primaryTarget),
      invalidationScenario: invalidationText(direction, invalidation),
      path: pathText(direction, currentPrice, result, primaryTarget, secondaryTarget),
      factors: supportingFactors(direction, combinedAnalyses, result, regime, primaryTarget),
      risks: riskFactors(direction, result, regime, newsRisk, freshness),
      modelScore: normalized,
      regime: regime.label,
      location: locationOf(result)
    };
  });

  const requiredFreshness = ['M15', 'H1', 'H4'].map(tf => String(freshness?.[tf]?.state || 'CACHE'));
  const trackable = requiredFreshness.every(value => !value.includes('STALE') && !value.includes('CACHE'))
    && outlooks.length === 3;

  return {
    generatedAt: now,
    price: currentPrice,
    regime,
    newsRisk,
    outlooks,
    trackable,
    disclaimer: 'Probabilitas adalah kekuatan proyeksi rule-based, bukan akurasi historis yang sudah terbukti.'
  };
}

export function predictionSlot(outlook, now = Date.now(), session = {}) {
  if (outlook.id === 'INTRADAY') return `${outlook.id}:${Math.floor(now / HOUR)}`;
  if (outlook.id === 'SESSION') {
    const sessionId = String(session?.id || session?.name || 'OFF').replace(/\s+/g, '_').toUpperCase();
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(now));
    return `${outlook.id}:${date}:${sessionId}`;
  }
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(now));
  return `${outlook.id}:${date}`;
}

export function appendPredictionSnapshots(history, projection, { now = Date.now(), session = {} } = {}) {
  const output = Array.isArray(history) ? [...history] : [];
  if (!projection?.trackable) return output;
  for (const outlook of projection.outlooks || []) {
    const slot = predictionSlot(outlook, now, session);
    if (output.some(item => item.slot === slot)) continue;
    const invalidation = outlook.direction === 'RANGE'
      ? outlook.invalidation
      : num(outlook.invalidation);
    output.push({
      id: `${slot}:${Math.round(outlook.startPrice * 100)}`,
      slot,
      horizonId: outlook.id,
      horizonLabel: outlook.label,
      createdAt: now,
      expiresAt: outlook.expiresAt,
      startPrice: outlook.startPrice,
      direction: outlook.direction,
      probability: outlook.probability,
      target: outlook.primaryTarget,
      targetType: outlook.primaryTargetType,
      invalidation,
      regime: outlook.regime,
      status: 'PENDING',
      maxHigh: outlook.startPrice,
      minLow: outlook.startPrice,
      finalPrice: null,
      directionCorrect: null,
      targetHit: false,
      invalidated: false
    });
  }
  return output.slice(-500);
}

function candlePoints(candlesByTf, createdAt, expiresAt, livePrice, now) {
  const preferred = candlesByTf.M1?.length ? candlesByTf.M1
    : candlesByTf.M5?.length ? candlesByTf.M5
      : candlesByTf.M15 || [];
  const points = preferred
    .map(candle => ({
      time: num(candle.time) * 1000,
      high: num(candle.high),
      low: num(candle.low),
      close: num(candle.close)
    }))
    .filter(point => point.time >= createdAt && point.time <= Math.min(expiresAt, now))
    .sort((a, b) => a.time - b.time);
  if (Number.isFinite(num(livePrice)) && now >= createdAt) {
    points.push({ time: now, high: num(livePrice), low: num(livePrice), close: num(livePrice) });
  }
  return points;
}

function actualDirection(startPrice, finalPrice, tolerance) {
  const change = finalPrice - startPrice;
  if (Math.abs(change) <= tolerance) return 'RANGE';
  return change > 0 ? 'BULLISH' : 'BEARISH';
}

export function evaluatePredictionHistory(history, {
  candlesByTf = {},
  livePrice,
  now = Date.now()
} = {}) {
  return (Array.isArray(history) ? history : []).map(record => {
    if (record.status !== 'PENDING') return record;
    const points = candlePoints(candlesByTf, record.createdAt, record.expiresAt, livePrice, now);
    if (!points.length) return record;

    let maxHigh = num(record.maxHigh, record.startPrice);
    let minLow = num(record.minLow, record.startPrice);
    let targetAt = 0;
    let invalidAt = 0;

    for (const point of points) {
      maxHigh = Math.max(maxHigh, point.high);
      minLow = Math.min(minLow, point.low);
      if (!targetAt && Number.isFinite(num(record.target))) {
        if (record.direction === 'BULLISH' && point.high >= num(record.target)) targetAt = point.time;
        if (record.direction === 'BEARISH' && point.low <= num(record.target)) targetAt = point.time;
      }
      if (!invalidAt) {
        if (record.direction === 'BULLISH' && point.low <= num(record.invalidation)) invalidAt = point.time;
        if (record.direction === 'BEARISH' && point.high >= num(record.invalidation)) invalidAt = point.time;
        if (record.direction === 'RANGE' && record.invalidation) {
          if (point.low <= num(record.invalidation.lower) || point.high >= num(record.invalidation.upper)) invalidAt = point.time;
        }
      }
    }

    const finalPrice = points[points.length - 1].close;
    const baseTolerance = Math.max(record.startPrice * 0.0008, 0.5);
    const expired = now >= record.expiresAt;
    const targetFirst = targetAt && (!invalidAt || targetAt <= invalidAt);
    const invalidFirst = invalidAt && (!targetAt || invalidAt < targetAt);

    if (targetFirst) {
      return {
        ...record,
        status: 'RESOLVED',
        outcome: 'TARGET_HIT',
        resolvedAt: targetAt,
        finalPrice,
        maxHigh,
        minLow,
        directionCorrect: true,
        targetHit: true,
        invalidated: false
      };
    }

    if (invalidFirst) {
      return {
        ...record,
        status: 'RESOLVED',
        outcome: 'INVALIDATED',
        resolvedAt: invalidAt,
        finalPrice,
        maxHigh,
        minLow,
        directionCorrect: false,
        targetHit: false,
        invalidated: true
      };
    }

    if (!expired) return { ...record, finalPrice, maxHigh, minLow };

    const actual = actualDirection(record.startPrice, finalPrice, baseTolerance);
    return {
      ...record,
      status: 'RESOLVED',
      outcome: actual === record.direction ? 'DIRECTION_CORRECT' : 'DIRECTION_WRONG',
      resolvedAt: now,
      finalPrice,
      maxHigh,
      minLow,
      actualDirection: actual,
      directionCorrect: actual === record.direction,
      targetHit: false,
      invalidated: false,
      absoluteError: Number.isFinite(num(record.target)) ? Math.abs(num(record.target) - finalPrice) : null
    };
  });
}

export function predictionStats(history, minimumSample = 20) {
  const resolved = (Array.isArray(history) ? history : []).filter(item => item.status === 'RESOLVED');
  const summarize = items => {
    const count = items.length;
    const correct = items.filter(item => item.directionCorrect).length;
    const targetHits = items.filter(item => item.targetHit).length;
    const invalidated = items.filter(item => item.invalidated).length;
    return {
      count,
      ready: count >= minimumSample,
      needed: Math.max(0, minimumSample - count),
      directionalAccuracy: count ? (correct / count) * 100 : 0,
      targetHitRate: count ? (targetHits / count) * 100 : 0,
      invalidationRate: count ? (invalidated / count) * 100 : 0
    };
  };

  return {
    overall: summarize(resolved),
    byHorizon: Object.fromEntries(
      OUTLOOK_HORIZONS.map(horizon => [
        horizon.id,
        summarize(resolved.filter(item => item.horizonId === horizon.id))
      ])
    ),
    pending: (Array.isArray(history) ? history : []).filter(item => item.status === 'PENDING').length,
    recent: [...resolved].sort((a, b) => num(b.resolvedAt) - num(a.resolvedAt)).slice(0, 8)
  };
}
