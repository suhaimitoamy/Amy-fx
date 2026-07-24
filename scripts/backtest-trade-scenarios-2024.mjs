import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.AMYFX_2024_DATA || '/mnt/data/amyfx_2024';
const LOOKBACK = 32;
const ATR_PERIOD = 14;
const ENTRY_BUFFER_ATR = 0.05;
const VALIDITY_BARS = 32;
const RETEST_BARS = 8;
const WARMUP_BARS = 299;
const TP1_R = 1.5;
const TP2_R = 2.0;
const M15_MS = 15 * 60 * 1000;

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
  const pattern = new RegExp(`^XAUUSD_${tf}_.*_2024\\.csv$`, 'i');
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

function atrAt(candles, index) {
  const start = Math.max(1, index + 1 - Math.max(2, ATR_PERIOD));
  const ranges = [];
  for (let cursor = start; cursor <= index; cursor += 1) {
    const candle = candles[cursor];
    const previousClose = candles[cursor - 1].close;
    ranges.push(Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    ));
  }
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
}

function buildLevels(candles, setupIndex) {
  const window = candles.slice(setupIndex - LOOKBACK + 1, setupIndex + 1);
  const resistance = Math.max(...window.map(candle => candle.high));
  const support = Math.min(...window.map(candle => candle.low));
  const atr = atrAt(candles, setupIndex);
  const buffer = atr * ENTRY_BUFFER_ATR;
  return {
    resistance,
    support,
    atr,
    buyEntry: resistance + buffer,
    sellEntry: support - buffer
  };
}

function evaluateFromEntry({ side, entry, stopLoss, tp1, tp2, entryMinuteIndex, endMinuteIndex, m1 }) {
  let tp1Reached = false;
  let tp2Reached = false;
  let stopReached = false;
  let outcomeMinuteIndex = Math.max(entryMinuteIndex, endMinuteIndex - 1);
  let mfe = 0;
  let mae = 0;

  for (let index = entryMinuteIndex; index < endMinuteIndex; index += 1) {
    const candle = m1[index];
    const stopTouched = side === 'BUY' ? candle.low <= stopLoss : candle.high >= stopLoss;
    const tp1Touched = side === 'BUY' ? candle.high >= tp1 : candle.low <= tp1;
    const tp2Touched = side === 'BUY' ? candle.high >= tp2 : candle.low <= tp2;
    mfe = Math.max(mfe, side === 'BUY' ? candle.high - entry : entry - candle.low);
    mae = Math.max(mae, side === 'BUY' ? entry - candle.low : candle.high - entry);

    if (stopTouched) {
      stopReached = true;
      outcomeMinuteIndex = index;
      break;
    }
    if (tp1Touched) tp1Reached = true;
    if (tp2Touched) {
      tp1Reached = true;
      tp2Reached = true;
      outcomeMinuteIndex = index;
      break;
    }
  }

  return {
    tp1Reached,
    tp2Reached,
    stopReached,
    stoppedBeforeTp1: stopReached && !tp1Reached,
    tp1ThenStopped: stopReached && tp1Reached && !tp2Reached,
    tp1OnlyAtExpiry: tp1Reached && !tp2Reached && !stopReached,
    noTp1OrStop: !tp1Reached && !stopReached,
    outcomeMinuteIndex,
    immediateStop: stopReached && outcomeMinuteIndex === entryMinuteIndex,
    mfe,
    mae
  };
}

function recordTrade({ model, riskPoints, side, setupIndex, entryMinuteIndex, levels, entry, stopLoss, tp1, tp2, evaluation, m15, m1 }) {
  const risk = Math.abs(entry - stopLoss);
  return {
    model,
    riskPoints,
    setupTime: new Date(m15[setupIndex].time).toISOString(),
    entryTime: new Date(m1[entryMinuteIndex].time).toISOString(),
    outcomeTime: new Date(m1[evaluation.outcomeMinuteIndex].time).toISOString(),
    month: new Date(m1[entryMinuteIndex].time).toISOString().slice(0, 7),
    side,
    entry,
    stopLoss,
    takeProfit1: tp1,
    takeProfit2: tp2,
    risk,
    tp1Reached: evaluation.tp1Reached,
    tp2Reached: evaluation.tp2Reached,
    stopReached: evaluation.stopReached,
    stoppedBeforeTp1: evaluation.stoppedBeforeTp1,
    tp1ThenStopped: evaluation.tp1ThenStopped,
    tp1OnlyAtExpiry: evaluation.tp1OnlyAtExpiry,
    noTp1OrStop: evaluation.noTp1OrStop,
    immediateStop: evaluation.immediateStop,
    mfeR: risk > 0 ? evaluation.mfe / risk : 0,
    maeR: risk > 0 ? evaluation.mae / risk : 0,
    resistance: levels.resistance,
    support: levels.support,
    atr: levels.atr
  };
}

function nextSetupIndex(outcomeTime, m15Times, previousSetupIndex) {
  const containingIndex = upperBound(m15Times, outcomeTime) - 1;
  return Math.max(previousSetupIndex + 1, containingIndex + 1);
}

function backtestStopOrder({ riskPoints, m15, m1 }) {
  const m15Times = m15.map(candle => candle.time);
  const m1Times = m1.map(candle => candle.time);
  const records = [];
  let setupIndex = WARMUP_BARS;
  let armedSetups = 0;
  let noTrigger = 0;
  let ambiguousDualTouch = 0;

  while (setupIndex < m15.length - VALIDITY_BARS - 2) {
    armedSetups += 1;
    const levels = buildLevels(m15, setupIndex);
    const expiryIndex = Math.min(m15.length - 1, setupIndex + VALIDITY_BARS);
    const startMinuteIndex = lowerBound(m1Times, m15[setupIndex + 1].time);
    const endMinuteIndex = lowerBound(m1Times, m15[expiryIndex].time + M15_MS);
    let selected = null;

    for (let index = startMinuteIndex; index < endMinuteIndex; index += 1) {
      const candle = m1[index];
      const buyTouched = candle.high >= levels.buyEntry;
      const sellTouched = candle.low <= levels.sellEntry;
      if (buyTouched && sellTouched) {
        ambiguousDualTouch += 1;
        const buyDistance = Math.abs(levels.buyEntry - candle.open);
        const sellDistance = Math.abs(candle.open - levels.sellEntry);
        selected = { side: buyDistance <= sellDistance ? 'BUY' : 'SELL', minuteIndex: index };
        break;
      }
      if (buyTouched) {
        selected = { side: 'BUY', minuteIndex: index };
        break;
      }
      if (sellTouched) {
        selected = { side: 'SELL', minuteIndex: index };
        break;
      }
    }

    if (!selected) {
      noTrigger += 1;
      setupIndex = expiryIndex + 1;
      continue;
    }

    const entry = selected.side === 'BUY' ? levels.buyEntry : levels.sellEntry;
    const stopLoss = selected.side === 'BUY' ? entry - riskPoints : entry + riskPoints;
    const tp1 = selected.side === 'BUY' ? entry + TP1_R * riskPoints : entry - TP1_R * riskPoints;
    const tp2 = selected.side === 'BUY' ? entry + TP2_R * riskPoints : entry - TP2_R * riskPoints;
    const evaluation = evaluateFromEntry({
      side: selected.side,
      entry,
      stopLoss,
      tp1,
      tp2,
      entryMinuteIndex: selected.minuteIndex,
      endMinuteIndex,
      m1
    });

    records.push(recordTrade({
      model: `STOP_ORDER_${riskPoints.toFixed(0)}PT`,
      riskPoints,
      side: selected.side,
      setupIndex,
      entryMinuteIndex: selected.minuteIndex,
      levels,
      entry,
      stopLoss,
      tp1,
      tp2,
      evaluation,
      m15,
      m1
    }));

    setupIndex = nextSetupIndex(m1[evaluation.outcomeMinuteIndex].time, m15Times, setupIndex);
  }

  return { records, flow: { armedSetups, noTrigger, ambiguousDualTouch } };
}

function backtestRetest({ m15, m1 }) {
  const m15Times = m15.map(candle => candle.time);
  const m1Times = m1.map(candle => candle.time);
  const records = [];
  let setupIndex = WARMUP_BARS;
  let armedSetups = 0;
  let breakouts = 0;
  let noBreakout = 0;
  let breakoutWithoutRetest = 0;

  while (setupIndex < m15.length - VALIDITY_BARS - 2) {
    armedSetups += 1;
    const levels = buildLevels(m15, setupIndex);
    const expiryIndex = Math.min(m15.length - 1, setupIndex + VALIDITY_BARS);
    let selection = null;

    for (let index = setupIndex + 1; index <= expiryIndex; index += 1) {
      if (m15[index].close > levels.buyEntry) {
        selection = { side: 'BUY', breakoutIndex: index };
        break;
      }
      if (m15[index].close < levels.sellEntry) {
        selection = { side: 'SELL', breakoutIndex: index };
        break;
      }
    }

    if (!selection) {
      noBreakout += 1;
      setupIndex = expiryIndex + 1;
      continue;
    }
    breakouts += 1;

    const entry = selection.side === 'BUY' ? levels.buyEntry : levels.sellEntry;
    const stopLoss = selection.side === 'BUY'
      ? levels.resistance - levels.atr
      : levels.support + levels.atr;
    const risk = Math.abs(entry - stopLoss);
    const tp1 = selection.side === 'BUY' ? entry + TP1_R * risk : entry - TP1_R * risk;
    const tp2 = selection.side === 'BUY' ? entry + TP2_R * risk : entry - TP2_R * risk;
    const lastRetestIndex = Math.min(expiryIndex, selection.breakoutIndex + RETEST_BARS);
    const retestStartTime = m15[selection.breakoutIndex + 1]?.time ?? Number.MAX_SAFE_INTEGER;
    const retestEndTime = m15[lastRetestIndex].time + M15_MS;
    const startMinuteIndex = lowerBound(m1Times, retestStartTime);
    const retestEndMinuteIndex = lowerBound(m1Times, retestEndTime);
    let entryMinuteIndex = -1;

    for (let index = startMinuteIndex; index < retestEndMinuteIndex; index += 1) {
      if (m1[index].low <= entry && m1[index].high >= entry) {
        entryMinuteIndex = index;
        break;
      }
    }

    if (entryMinuteIndex < 0) {
      breakoutWithoutRetest += 1;
      setupIndex = expiryIndex + 1;
      continue;
    }

    const endMinuteIndex = lowerBound(m1Times, m15[expiryIndex].time + M15_MS);
    const evaluation = evaluateFromEntry({
      side: selection.side,
      entry,
      stopLoss,
      tp1,
      tp2,
      entryMinuteIndex,
      endMinuteIndex,
      m1
    });

    records.push(recordTrade({
      model: 'BREAKOUT_RETEST',
      riskPoints: risk,
      side: selection.side,
      setupIndex,
      entryMinuteIndex,
      levels,
      entry,
      stopLoss,
      tp1,
      tp2,
      evaluation,
      m15,
      m1
    }));

    setupIndex = nextSetupIndex(m1[evaluation.outcomeMinuteIndex].time, m15Times, setupIndex);
  }

  return { records, flow: { armedSetups, breakouts, noBreakout, breakoutWithoutRetest } };
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
  const count = key => records.filter(item => item[key]).length;
  const tp1Reached = count('tp1Reached');
  const tp2Reached = count('tp2Reached');
  const stoppedBeforeTp1 = count('stoppedBeforeTp1');
  const tp1ThenStopped = count('tp1ThenStopped');
  const risks = records.map(item => item.risk);
  return {
    entries: total,
    buyEntries: records.filter(item => item.side === 'BUY').length,
    sellEntries: records.filter(item => item.side === 'SELL').length,
    tp1Reached,
    tp1Rate: pct(tp1Reached, total),
    tp2Reached,
    tp2Rate: pct(tp2Reached, total),
    stoppedBeforeTp1,
    stoppedBeforeTp1Rate: pct(stoppedBeforeTp1, total),
    tp1ThenStopped,
    tp1ThenStoppedRate: pct(tp1ThenStopped, total),
    immediateStop: count('immediateStop'),
    immediateStopRate: pct(count('immediateStop'), total),
    noTp1OrStop: count('noTp1OrStop'),
    noTp1OrStopRate: pct(count('noTp1OrStop'), total),
    averageRiskPoints: total ? Number((risks.reduce((sum, value) => sum + value, 0) / total).toFixed(2)) : 0,
    medianRiskPoints: Number(median(risks).toFixed(2)),
    expectancyAtTp1R: total ? Number(((tp1Reached * TP1_R - stoppedBeforeTp1) / total).toFixed(3)) : 0,
    expectancyAtTp2R: total ? Number(((tp2Reached * TP2_R - stoppedBeforeTp1 - tp1ThenStopped) / total).toFixed(3)) : 0,
    medianMfeR: Number(median(records.map(item => item.mfeR)).toFixed(3))
  };
}

function summarizeModel(model) {
  const overall = summarize(model.records);
  const months = [...new Set(model.records.map(item => item.month))].sort();
  const monthly = Object.fromEntries(months.map(month => [month, summarize(model.records.filter(item => item.month === month))]));
  return { flow: model.flow, overall, monthly };
}

const m15 = loadTf('M15');
const m1 = loadTf('M1');
const retest = backtestRetest({ m15, m1 });
const stop3 = backtestStopOrder({ riskPoints: 3, m15, m1 });
const stop4 = backtestStopOrder({ riskPoints: 4, m15, m1 });

const result = {
  status: 'FINAL_BACKTEST_RETEST_VS_STOP_ORDER_2024',
  generatedAt: new Date().toISOString(),
  methodology: {
    dataset: 'XAU/USD M15 setup with M1 execution, January–December 2024',
    m15Candles: m15.length,
    m1Candles: m1.length,
    firstCandleUtc: new Date(m15[0].time).toISOString(),
    lastCandleUtc: new Date(m15.at(-1).time).toISOString(),
    lookbackBars: LOOKBACK,
    atrPeriod: ATR_PERIOD,
    entryBufferAtr: ENTRY_BUFFER_ATR,
    validityBars: VALIDITY_BARS,
    tp1R: TP1_R,
    tp2R: TP2_R,
    stopOrderRiskVariants: [3, 4],
    oco: true,
    noLookahead: true,
    intrabarResolution: 'M1; stop-first when stop and target touch within the same M1 candle.',
    costs: 'Spread, slippage, commission, news, and broker execution are not modeled.'
  },
  models: {
    breakoutRetest: summarizeModel(retest),
    stopOrder3Point: summarizeModel(stop3),
    stopOrder4Point: summarizeModel(stop4)
  },
  audit: {
    retestRecordsSha256: crypto.createHash('sha256').update(JSON.stringify(retest.records)).digest('hex'),
    stop3RecordsSha256: crypto.createHash('sha256').update(JSON.stringify(stop3.records)).digest('hex'),
    stop4RecordsSha256: crypto.createHash('sha256').update(JSON.stringify(stop4.records)).digest('hex')
  }
};

const outputPath = path.resolve('docs/backtests/amy-fx-trade-scenarios-2024.json');
fs.writeFileSync(outputPath, `${JSON.stringify(result)}\n`);
console.log(JSON.stringify(result, null, 2));
