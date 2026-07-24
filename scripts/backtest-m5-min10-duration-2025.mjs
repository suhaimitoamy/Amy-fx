import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  TRADE_SCENARIO_CONFIG,
  detectReactionZones
} from '../app/src/main/assets/apps/mapping/js/outlook/trade-scenario-core.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const DATA_DIR = process.env.AMYFX_2025_DATA || '/mnt/data/amyfx_2025';
const YEAR = 2025;
const M5_MS = 5 * 60 * 1000;
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MIN_STOP_POINTS = 10;
const TP1_POINTS = 10;
const TP2_POINTS = 20;

function parseCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  const header = lines.shift().split(',').map(value => value.trim().toLowerCase());
  const index = Object.fromEntries(header.map((name, position) => [name, position]));
  return lines.map(line => {
    const parts = line.split(',');
    const datetime = parts[index.datetime]?.trim();
    return {
      datetime,
      time: Date.parse(`${datetime.replace(' ', 'T')}Z`),
      open: Number(parts[index.open]),
      high: Number(parts[index.high]),
      low: Number(parts[index.low]),
      close: Number(parts[index.close])
    };
  }).filter(candle => Number.isFinite(candle.time)
    && Number.isFinite(candle.open)
    && Number.isFinite(candle.high)
    && Number.isFinite(candle.low)
    && Number.isFinite(candle.close));
}

function loadTf(tf) {
  const pattern = new RegExp(`^XAUUSD_${tf}_.*_${YEAR}\\.csv$`, 'i');
  const files = fs.readdirSync(DATA_DIR).filter(name => pattern.test(name));
  if (files.length !== 12) throw new Error(`Expected 12 ${tf} files, found ${files.length}.`);
  const byTime = new Map();
  for (const file of files) {
    for (const candle of parseCsv(path.join(DATA_DIR, file))) byTime.set(candle.time, candle);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function lowerBound(values, target) {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const middle = (left + right) >> 1;
    if (values[middle] < target) left = middle + 1;
    else right = middle;
  }
  return left;
}

function upperBound(values, target) {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const middle = (left + right) >> 1;
    if (values[middle] <= target) left = middle + 1;
    else right = middle;
  }
  return left;
}

function didSweep(candles, side, touchIndex, lookback) {
  if (touchIndex < lookback) return false;
  const previous = candles.slice(touchIndex - lookback, touchIndex);
  return side === 'BUY'
    ? candles[touchIndex].low < Math.min(...previous.map(item => item.low))
    : candles[touchIndex].high > Math.max(...previous.map(item => item.high));
}

function firstTouch(candles, atr, zone, endIndex, settings) {
  const lastIndex = Math.min(endIndex, zone.createdIndex + settings.zoneExpiryBars);
  for (let index = zone.createdIndex + 1; index <= lastIndex; index += 1) {
    const candle = candles[index];
    const atrValue = atr[index] || zone.originAtr;
    if (zone.side === 'BUY' && candle.close < zone.bottom - settings.invalidationAtr * atrValue) return null;
    if (zone.side === 'SELL' && candle.close > zone.top + settings.invalidationAtr * atrValue) return null;
    if (candle.low <= zone.top && candle.high >= zone.bottom) return index;
  }
  return null;
}

function confirmation(candles, atr, zone, touchIndex, endIndex, settings) {
  const lastIndex = Math.min(endIndex, touchIndex + settings.confirmationBars);
  for (let index = touchIndex; index <= lastIndex; index += 1) {
    const candle = candles[index];
    const atrValue = atr[index] || zone.originAtr;
    const body = candle.close - candle.open;
    const range = candle.high - candle.low;
    if (!(atrValue > 0) || !(range > 0)) continue;
    if (zone.side === 'BUY'
      && candle.close > zone.top
      && body > 0
      && body >= settings.confirmationBodyAtr * atrValue
      && body / range >= settings.confirmationBodyRatio) return index;
    if (zone.side === 'SELL'
      && candle.close < zone.bottom
      && body < 0
      && -body >= settings.confirmationBodyAtr * atrValue
      && -body / range >= settings.confirmationBodyRatio) return index;
  }
  return null;
}

function confirmationInsideSession(timestamp) {
  const wita = new Date(timestamp + WITA_OFFSET_MS);
  const hour = wita.getUTCHours();
  return hour >= 18 || hour < 4;
}

function findM1Entry({ side, entry, stopLoss, startTime, endTime, m1, m1Times }) {
  const start = lowerBound(m1Times, startTime);
  const end = lowerBound(m1Times, endTime);
  for (let index = start; index < end; index += 1) {
    const candle = m1[index];
    if (candle.low <= entry && candle.high >= entry) return index;
    const invalidated = side === 'BUY' ? candle.low <= stopLoss : candle.high >= stopLoss;
    if (invalidated) return null;
  }
  return null;
}

function evaluateEntry({ side, entry, stopLoss, takeProfit1, takeProfit2, entryIndex, endTime, m1, m1Times }) {
  const endIndex = lowerBound(m1Times, endTime);
  let tp1Reached = false;
  let mfe = 0;
  let mae = 0;
  let outcomeIndex = Math.max(entryIndex, endIndex - 1);

  for (let index = entryIndex; index < endIndex; index += 1) {
    const candle = m1[index];
    const stopTouched = side === 'BUY' ? candle.low <= stopLoss : candle.high >= stopLoss;
    const tp1Touched = side === 'BUY' ? candle.high >= takeProfit1 : candle.low <= takeProfit1;
    const tp2Touched = side === 'BUY' ? candle.high >= takeProfit2 : candle.low <= takeProfit2;
    mfe = Math.max(mfe, side === 'BUY' ? candle.high - entry : entry - candle.low);
    mae = Math.max(mae, side === 'BUY' ? entry - candle.low : candle.high - entry);

    if (stopTouched) {
      return {
        outcome: tp1Reached ? 'TP1_THEN_SL' : 'SL',
        tp1Reached,
        tp2Reached: false,
        immediateStop: index === entryIndex,
        outcomeIndex: index,
        mfe,
        mae
      };
    }
    if (tp1Touched) tp1Reached = true;
    if (tp2Touched) {
      return {
        outcome: 'TP2',
        tp1Reached: true,
        tp2Reached: true,
        immediateStop: false,
        outcomeIndex: index,
        mfe,
        mae
      };
    }
  }

  return {
    outcome: tp1Reached ? 'TP1_EXPIRY' : 'EXPIRY',
    tp1Reached,
    tp2Reached: false,
    immediateStop: false,
    outcomeIndex,
    mfe,
    mae
  };
}

function fixedPointLevels(side, entry, structuralStop) {
  const structuralRisk = Math.abs(entry - structuralStop);
  const risk = Math.max(MIN_STOP_POINTS, structuralRisk);
  const sign = side === 'BUY' ? 1 : -1;
  return {
    structuralRisk,
    risk,
    stopLoss: entry - sign * risk,
    takeProfit1: entry + sign * TP1_POINTS,
    takeProfit2: entry + sign * TP2_POINTS,
    rrTp1: TP1_POINTS / risk,
    rrTp2: TP2_POINTS / risk
  };
}

function buildBaseCandidates(m5, m1, settings) {
  const detected = detectReactionZones(m5, settings);
  const candles = detected.candles;
  const atr = detected.atr;
  const m5Times = candles.map(item => item.time);
  const m1Times = m1.map(item => item.time);
  const candidates = [];
  const flow = {
    qualifiedFreshFvg: detected.zones.length,
    firstTouch: 0,
    confirmedReaction: 0,
    sessionEligible: 0,
    entryFilled: 0
  };

  for (const zone of detected.zones) {
    const setupEndIndex = Math.min(candles.length - 1, zone.createdIndex + settings.zoneExpiryBars);
    const touchIndex = firstTouch(candles, atr, zone, setupEndIndex, settings);
    if (touchIndex === null) continue;
    flow.firstTouch += 1;

    const confirmationIndex = confirmation(candles, atr, zone, touchIndex, setupEndIndex, settings);
    if (confirmationIndex === null) continue;
    flow.confirmedReaction += 1;
    const confirmationTime = candles[confirmationIndex].time;
    if (!confirmationInsideSession(confirmationTime)) continue;
    flow.sessionEligible += 1;

    const entry = zone.midpoint;
    const atrValue = atr[confirmationIndex] || zone.originAtr;
    const structuralStop = zone.side === 'BUY'
      ? zone.bottom - settings.stopBufferAtr * atrValue
      : zone.top + settings.stopBufferAtr * atrValue;
    const levels = fixedPointLevels(zone.side, entry, structuralStop);
    const entryWindowEndIndex = Math.min(setupEndIndex, confirmationIndex + settings.entryWaitBars);
    if (confirmationIndex + 1 > entryWindowEndIndex) continue;
    const entryMinuteIndex = findM1Entry({
      side: zone.side,
      entry,
      stopLoss: levels.stopLoss,
      startTime: candles[confirmationIndex + 1].time,
      endTime: candles[entryWindowEndIndex].time + M5_MS,
      m1,
      m1Times
    });
    if (entryMinuteIndex === null) continue;
    flow.entryFilled += 1;

    const entryM5Index = Math.max(0, upperBound(m5Times, m1[entryMinuteIndex].time) - 1);
    const tradeEndIndex = Math.min(candles.length - 1, entryM5Index + settings.tradeValidityBars);
    const evaluation = evaluateEntry({
      side: zone.side,
      entry,
      stopLoss: levels.stopLoss,
      takeProfit1: levels.takeProfit1,
      takeProfit2: levels.takeProfit2,
      entryIndex: entryMinuteIndex,
      endTime: candles[tradeEndIndex].time + M5_MS,
      m1,
      m1Times
    });

    const sweep = didSweep(candles, zone.side, touchIndex, settings.sweepLookbackBars);
    candidates.push({
      model: 'M5_MIN10_FIXED_TARGETS',
      side: zone.side,
      quality: sweep ? 'A' : 'B',
      zoneCreatedIndex: zone.createdIndex,
      touchIndex,
      confirmationIndex,
      confirmationTime,
      entryMinuteIndex,
      outcomeMinuteIndex: evaluation.outcomeIndex,
      entryTime: new Date(m1[entryMinuteIndex].time).toISOString(),
      outcomeTime: new Date(m1[evaluation.outcomeIndex].time).toISOString(),
      month: new Date(m1[entryMinuteIndex].time).toISOString().slice(0, 7),
      entry,
      structuralStop,
      structuralRisk: levels.structuralRisk,
      stopLoss: levels.stopLoss,
      takeProfit1: levels.takeProfit1,
      takeProfit2: levels.takeProfit2,
      risk: levels.risk,
      rrTp1: levels.rrTp1,
      rrTp2: levels.rrTp2,
      outcome: evaluation.outcome,
      tp1Reached: evaluation.tp1Reached,
      tp2Reached: evaluation.tp2Reached,
      immediateStop: evaluation.immediateStop,
      mfePoints: evaluation.mfe,
      maePoints: evaluation.mae,
      mfeR: levels.risk > 0 ? evaluation.mfe / levels.risk : 0,
      maeR: levels.risk > 0 ? evaluation.mae / levels.risk : 0
    });
  }

  return { candidates, flow, candles };
}

function selectNonOverlapping(candidates, m5) {
  const times = m5.map(item => item.time);
  const sorted = [...candidates].sort((a, b) =>
    a.entryMinuteIndex - b.entryMinuteIndex || a.zoneCreatedIndex - b.zoneCreatedIndex
  );
  const selected = [];
  let lastOutcomeM5Index = -1;
  for (const candidate of sorted) {
    if (candidate.touchIndex <= lastOutcomeM5Index || candidate.confirmationIndex <= lastOutcomeM5Index) continue;
    selected.push(candidate);
    lastOutcomeM5Index = Math.max(
      lastOutcomeM5Index,
      upperBound(times, Date.parse(candidate.outcomeTime)) - 1
    );
  }
  return selected;
}

function pct(value, total) {
  return total ? Number((value / total * 100).toFixed(2)) : 0;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarize(records) {
  const total = records.length;
  const count = predicate => records.filter(predicate).length;
  const tp1Reached = count(item => item.tp1Reached);
  const tp2Reached = count(item => item.tp2Reached);
  const stoppedBeforeTp1 = count(item => item.outcome === 'SL');
  const tp1ThenStopped = count(item => item.outcome === 'TP1_THEN_SL');
  const expiries = count(item => item.outcome === 'EXPIRY' || item.outcome === 'TP1_EXPIRY');
  const totalTp1Points = tp1Reached * TP1_POINTS - stoppedBeforeTp1 * MIN_STOP_POINTS;
  const totalTp2Points = tp2Reached * TP2_POINTS
    - stoppedBeforeTp1 * MIN_STOP_POINTS
    - tp1ThenStopped * MIN_STOP_POINTS;
  const risks = records.map(item => item.risk);
  return {
    entries: total,
    buyEntries: count(item => item.side === 'BUY'),
    sellEntries: count(item => item.side === 'SELL'),
    gradeAEntries: count(item => item.quality === 'A'),
    tp1Reached,
    tp1Rate: pct(tp1Reached, total),
    tp2Reached,
    tp2Rate: pct(tp2Reached, total),
    stoppedBeforeTp1,
    stoppedBeforeTp1Rate: pct(stoppedBeforeTp1, total),
    tp1ThenStopped,
    tp1ThenStoppedRate: pct(tp1ThenStopped, total),
    immediateStop: count(item => item.immediateStop),
    immediateStopRate: pct(count(item => item.immediateStop), total),
    expiries,
    expiryRate: pct(expiries, total),
    averageRiskPoints: total ? Number((risks.reduce((sum, value) => sum + value, 0) / total).toFixed(3)) : 0,
    medianRiskPoints: Number(median(risks).toFixed(3)),
    averageRrTp1: total ? Number((records.reduce((sum, item) => sum + item.rrTp1, 0) / total).toFixed(3)) : 0,
    averageRrTp2: total ? Number((records.reduce((sum, item) => sum + item.rrTp2, 0) / total).toFixed(3)) : 0,
    netPointsTp1Model: Number(totalTp1Points.toFixed(2)),
    pointsPerEntryTp1Model: total ? Number((totalTp1Points / total).toFixed(3)) : 0,
    netPointsTp2Model: Number(totalTp2Points.toFixed(2)),
    pointsPerEntryTp2Model: total ? Number((totalTp2Points / total).toFixed(3)) : 0,
    medianMfePoints: Number(median(records.map(item => item.mfePoints)).toFixed(3)),
    medianMaePoints: Number(median(records.map(item => item.maePoints)).toFixed(3))
  };
}

function monthly(records) {
  return Object.fromEntries(
    [...new Set(records.map(item => item.month))].sort()
      .map(month => [month, summarize(records.filter(item => item.month === month))])
  );
}

function sample(records, n = 8) {
  if (!records.length) return [];
  return Array.from({ length: Math.min(n, records.length) }, (_, index) =>
    records[Math.round(index * (records.length - 1) / Math.max(1, Math.min(n, records.length) - 1))]
  );
}

const m5 = loadTf('M5');
const m1 = loadTf('M1');
const validityBars = [24, 72, 144, 288];
const variants = {};
for (const bars of validityBars) {
  const settings = { ...TRADE_SCENARIO_CONFIG, tradeValidityBars: bars };
  const built = buildBaseCandidates(m5, m1, settings);
  const records = selectNonOverlapping(built.candidates, built.candles);
  variants[`${bars}bars`] = {
    hours: bars * 5 / 60,
    flow: built.flow,
    summary: summarize(records),
    monthly: monthly(records),
    examples: sample(records),
    auditSha256: crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex')
  };
}
const result = {
  status: 'FINAL_BACKTEST_M5_MIN10_DURATION_COMPARISON_2025',
  generatedAt: new Date().toISOString(),
  methodology: {
    dataset: 'XAU/USD M5 signal logic with M1 execution resolution, January–December 2025',
    m5Candles: m5.length,
    m1Candles: m1.length,
    entryLogic: 'Fresh FVG M5, first touch, M5 rejection, midpoint entry within five M5 candles.',
    sessionFilter: 'Confirmation candle from 18:00 through 03:59 WITA.',
    exitLogic: 'Stop distance is max(10 points, structural invalidation distance); TP1 fixed 10 points and TP2 fixed 20 points.',
    oldRiskAndLiquidityFilters: 'Removed.',
    noLookahead: true,
    executionResolution: 'M1 only orders entry, SL, and TP touches; stop-first on the same minute.',
    costs: 'Raw results exclude spread, slippage, commission, news, and broker execution.'
  },
  variants
};
fs.writeFileSync(path.join(ROOT, 'docs/backtests/amy-fx-m5-min10-duration-2025.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
