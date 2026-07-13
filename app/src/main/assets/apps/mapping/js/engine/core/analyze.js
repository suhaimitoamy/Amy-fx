import { clamp, detectStructure, directionSign, p2, swings } from './math-structure.js';
import { buildHtfNarrative, detectFvg, detectOB } from './zones.js';
import { buildDealingRange, buildLiquidityHierarchy, buildSessionContext } from './liquidity.js';
import { buildSetups } from './setups.js';

export function tfGroup(tf) {
  if (tf === 'M1') return ['M1', 'M5', 'M15', 'H1'];
  if (tf === 'M5') return ['M5', 'M15', 'H1', 'H4'];
  if (tf === 'M15') return ['M15', 'H1', 'H4', 'D1'];
  if (tf === 'M30') return ['M30', 'H1', 'H4', 'D1'];
  if (tf === 'H1') return ['H1', 'H4', 'D1', 'W1'];
  if (tf === 'H4') return ['H4', 'D1', 'W1'];
  return ['D1', 'W1'];
}

function weightedBias(htfBiases, localTrend, narrative, localStructureFailed = false) {
  const weights = { M1: 0.05, M5: 0.08, M15: 0.14, M30: 0.18, H1: 0.24, H4: 0.32, D1: 0.4, W1: 0.45 };
  const localReliability = localStructureFailed ? 0.15 : 0.35;
  let score = directionSign(localTrend) * localReliability;
  let maximum = localReliability;
  let hasNarrativeSource = false;

  for (const [tf, direction] of Object.entries(htfBiases || {})) {
    const weight = weights[tf] || 0.15;
    score += directionSign(direction) * weight;
    maximum += weight;
    if (tf === narrative?.sourceTf) hasNarrativeSource = true;
  }

  if (!hasNarrativeSource && narrative?.htfBias && narrative.htfBias !== 'NEUTRAL') {
    score += directionSign(narrative.htfBias) * 0.3;
    maximum += 0.3;
  }

  const normalized = maximum > 0 ? clamp(score / maximum, -1, 1) : 0;
  return {
    normalized,
    direction: Math.abs(normalized) < 0.18 ? 'NEUTRAL' : normalized > 0 ? 'BULLISH' : 'BEARISH'
  };
}

export function analyze(cs, tf, htfBiases = {}, currentPrice = null, htfCandles = {}) {
  if (!cs || cs.length < 30) {
    return {
      tf,
      price: currentPrice || 0,
      final: 'WAIT',
      signal: 'WAIT',
      biasScore: 0,
      score: 0,
      zone: 'EQUILIBRIUM',
      high: 0,
      low: 0,
      eq: 0,
      bsl: 0,
      ssl: 0,
      st: { trend: 'NEUTRAL', confirmedTrend: 'NEUTRAL', last: null, lastConfirmedBreak: null, lastSweep: null, lastFailedBreak: null, events: [] },
      htf: 'NEUTRAL',
      htfBiases: {},
      htfNarrative: { htfBias: 'NEUTRAL', drawOnLiquidity: 'NEUTRAL', dealingHigh: 0, dealingLow: 0, drawLevel: 0, reason: 'Data candle kurang dari 30.' },
      setups: [],
      bestSetup: null,
      concepts: [['Status', 'WAIT', 'Data belum cukup']],
      sessionContext: { session: 'OFF_SESSION', killzone: 'NONE', sessionQuality: 'LOW', note: 'Data tidak cukup' },
      activeSession: 'OFF_SESSION',
      killzone: 'NONE',
      sessionQuality: 'LOW',
      liquidityHierarchy: { activeTargets: [], swept: [], drawTarget: null, summary: 'Data kurang' },
      drawTarget: null,
      activeLiquidityTargets: [],
      dealingRange: { high: 0, low: 0, equilibrium: 0, currentZone: 'EQUILIBRIUM', rangeSource: 'FALLBACK', confidence: 'LOW', reason: 'Data kurang' },
      premiumDiscountZone: 'EQUILIBRIUM',
      rangeConfidence: 'LOW'
    };
  }

  const price = Number(currentPrice) || cs.at(-1).close;
  const swingDepth = tf === 'M1' ? 2 : 3;
  const sw = swings(cs, swingDepth, swingDepth);
  const st = detectStructure(cs, sw);
  const htfNarrative = buildHtfNarrative(htfCandles, price);
  const liquidityHierarchy = buildLiquidityHierarchy(cs, sw, { price, htfNarrative });
  const dealingRange = buildDealingRange(cs, sw, htfNarrative, liquidityHierarchy, price);

  const unsweptHighs = sw.highs.filter(item => !liquidityHierarchy.swept?.some(level => level.type === 'BSL' && Math.abs(level.level - item.high) < 0.1));
  const unsweptLows = sw.lows.filter(item => !liquidityHierarchy.swept?.some(level => level.type === 'SSL' && Math.abs(level.level - item.low) < 0.1));
  const bsl = liquidityHierarchy.activeTargets.find(item => item.type === 'BSL')?.level
    || (unsweptHighs.length ? Math.max(...unsweptHighs.map(item => item.high)) : Math.max(...cs.slice(-30).map(candle => candle.high)));
  const ssl = liquidityHierarchy.activeTargets.find(item => item.type === 'SSL')?.level
    || (unsweptLows.length ? Math.min(...unsweptLows.map(item => item.low)) : Math.min(...cs.slice(-30).map(candle => candle.low)));
  const fvgs = detectFvg(cs, htfNarrative);
  const obs = detectOB(cs, st, htfNarrative);
  const nearFvg = fvgs.find(zone => price >= zone.bottom && price <= zone.top) || null;
  const nearOb = obs.find(zone => price >= zone.bottom && price <= zone.top) || null;

  const bias = weightedBias(htfBiases, st.trend, htfNarrative, Boolean(st.lastConfirmedBreak?.failed));
  const htfDirections = Object.values(htfBiases).map(directionSign).filter(Boolean);
  const htf = htfDirections.length
    ? (htfDirections.reduce((sum, value) => sum + value, 0) > 0 ? 'BULLISH'
      : htfDirections.reduce((sum, value) => sum + value, 0) < 0 ? 'BEARISH' : 'NEUTRAL')
    : htfNarrative.htfBias;
  const sessionContext = buildSessionContext(Date.now());

  const ctx = {
    tf,
    price,
    sw,
    st,
    nearFvg,
    nearOb,
    fvgs,
    final: bias.direction,
    bsl,
    ssl,
    high: dealingRange.high,
    low: dealingRange.low,
    eq: dealingRange.equilibrium,
    zone: dealingRange.currentZone,
    htfNarrative,
    sessionContext,
    liquidityHierarchy,
    dealingRange
  };

  const setups = buildSetups(cs, tf, ctx);
  const candidates = setups
    .filter(item => item.status !== 'INVALID' && item.status !== 'WAIT' && item.conflictCheck?.conflictLevel !== 'FATAL')
    .sort((a, b) => {
      const rank = value => value === 'NONE' ? 0 : value === 'LOW' ? 1 : value === 'MEDIUM' ? 2 : 3;
      const difference = rank(a.conflictCheck?.conflictLevel) - rank(b.conflictCheck?.conflictLevel);
      return difference || b.score - a.score;
    });
  const bestSetup = candidates[0] || null;
  const signal = bestSetup?.dir || 'WAIT';
  const score = bestSetup?.score || Math.round(45 + Math.abs(bias.normalized) * 20);
  const confirmed = st.lastConfirmedBreak;
  const latest = st.lastEvent;

  const concepts = [
    ['Dealing Range', `${dealingRange.rangeSource} | ${dealingRange.confidence}`, `High: ${p2(dealingRange.high)} Low: ${p2(dealingRange.low)}`],
    ['Premium / Discount', dealingRange.currentZone, dealingRange.reason],
    ['Liquidity Hierarchy', liquidityHierarchy.summary, liquidityHierarchy.drawTarget ? `Draw Target: ${liquidityHierarchy.drawTarget.type} @ ${p2(liquidityHierarchy.drawTarget.level)}` : 'Belum ada Draw Target jelas'],
    ['Final Bias', bias.direction, `${bias.direction} | ${dealingRange.currentZone}`],
    ['Structure', st.trend, confirmed ? `${confirmed.kind} ${confirmed.dir} @ ${p2(confirmed.price)}` : 'Belum ada break struktur valid'],
    ['Latest Event', latest?.breakType || 'WAIT', latest ? `${latest.dir} @ ${p2(latest.price)}` : 'Belum ada event struktur'],
    ['OB', nearOb ? 'ACTIVE' : 'WAIT', nearOb ? `${nearOb.type} ${p2(nearOb.bottom)} - ${p2(nearOb.top)}` : 'Tidak ada OB aktif'],
    ['FVG', nearFvg ? 'ACTIVE' : 'WAIT', nearFvg ? `${nearFvg.type} ${p2(nearFvg.bottom)} - ${p2(nearFvg.top)}` : 'Tidak ada FVG aktif']
  ];
  if (htfNarrative.htfBias !== 'NEUTRAL' || htfNarrative.drawOnLiquidity !== 'NEUTRAL') {
    concepts.unshift(['Draw on Liquidity', htfNarrative.drawOnLiquidity, `${htfNarrative.drawOnLiquidity} @ ${p2(htfNarrative.drawLevel)}`]);
    concepts.unshift(['HTF Narrative', htfNarrative.htfBias, htfNarrative.reason]);
  }
  concepts.push(['Best Setup', bestSetup?.status || 'WAIT', bestSetup ? `${bestSetup.type} ${bestSetup.score}/100` : 'Belum ada setup valid']);

  return {
    tf,
    price,
    final: bias.direction,
    biasScore: bias.normalized,
    score,
    signal,
    zone: dealingRange.currentZone,
    high: dealingRange.high,
    low: dealingRange.low,
    eq: dealingRange.equilibrium,
    bsl,
    ssl,
    st,
    htf,
    htfBiases,
    htfNarrative,
    setups,
    bestSetup,
    concepts,
    sessionContext,
    activeSession: sessionContext.session,
    killzone: sessionContext.killzone,
    sessionQuality: sessionContext.sessionQuality,
    liquidityHierarchy,
    drawTarget: liquidityHierarchy.drawTarget,
    activeLiquidityTargets: liquidityHierarchy.activeTargets,
    dealingRange,
    premiumDiscountZone: dealingRange.currentZone,
    rangeConfidence: dealingRange.confidence,
    biasEvidence: {
      localTrend: st.trend,
      htfBiases,
      narrative: htfNarrative.htfBias,
      normalized: bias.normalized
    }
  };
}
