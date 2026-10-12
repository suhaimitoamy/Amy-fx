import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  AMY_SMC_D_BASELINE_SHA,
  normalizeAmySmcDClosedCandles,
  replayAmySmcD
} from '../app/src/main/assets/apps/mapping/js/engine/amy-smc-d-engine.js';
import { analyze } from '../app/src/main/assets/apps/mapping/js/engine/concept-analyze.js';

const FIVE_MINUTES = 5 * 60;
const FIFTEEN_MINUTES = 15 * 60;
const ONE_HOUR = 60 * 60;
const BASE_TIME = 1_700_000_000;

function waveCandles(count, timeframe, stepSeconds) {
  return Array.from({ length: count }, (_, index) => {
    const center = 150 + 25 * Math.sin(index * Math.PI / 35) + index * 0.01;
    const body = 0.3 * Math.cos(index * Math.PI / 9);
    const open = center - body;
    const close = center + body;
    return {
      time: BASE_TIME + index * stepSeconds,
      timeframe,
      open,
      high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1,
      close,
      isClosed: true
    };
  });
}

test('Amy-SMC-D engine pins the required production baseline and semantic contract', () => {
  const result = replayAmySmcD(waveCandles(260, 'M15', FIFTEEN_MINUTES), { tf: 'M15' });

  assert.equal(AMY_SMC_D_BASELINE_SHA, 'd6e6d7c979dd5a852bddd9661bef0480caa2eb35');
  assert.equal(result.baselineSha, AMY_SMC_D_BASELINE_SHA);
  assert.equal(result.source, 'AMY_SMC_D');
  assert.equal(result.semanticContract, 'Z_ORIGINAL_PLUS_D_DEALING_RANGE_FIXES');
  assert.equal(result.closedCandleOnly, true);
  assert.equal(result.noFutureCandle, true);
  assert.equal(result.noInterpolation, true);
  assert.equal(result.noSyntheticCandles, true);
});

test('closed-candle normalization rejects open, synthetic, and invalid candles without filling gaps', () => {
  const valid = waveCandles(1, 'M5', FIVE_MINUTES)[0];
  const later = { ...valid, time: valid.time + FIVE_MINUTES * 3, close: valid.close + 1, high: valid.high + 1 };
  const duplicate = { ...later, close: later.close + 1, high: later.high + 1 };
  const normalized = normalizeAmySmcDClosedCandles([
    later,
    { ...valid, time: valid.time + FIVE_MINUTES, isClosed: false },
    valid,
    { ...valid, time: valid.time + FIVE_MINUTES * 2, amyfxSyntheticCurrent: true },
    { ...valid, time: valid.time + FIVE_MINUTES * 4, high: valid.low - 1 },
    duplicate
  ], 'M5');

  assert.deepEqual(normalized.map(candle => candle.time), [valid.time, later.time]);
  assert.equal(normalized[1].close, duplicate.close, 'deterministic last duplicate wins');
  assert.equal(normalized.every(candle => candle.isClosed), true);
  assert.equal(normalized.some(candle => candle.time === valid.time + FIVE_MINUTES * 2), false);
});

test('replay is deterministic and ignores flagged live/future candles', () => {
  const closed = waveCandles(320, 'M15', FIFTEEN_MINUTES);
  const openTail = {
    ...closed.at(-1),
    time: closed.at(-1).time + FIFTEEN_MINUTES,
    close: 9_999,
    high: 10_000,
    isClosed: false
  };
  const syntheticTail = {
    ...closed.at(-1),
    time: closed.at(-1).time + FIFTEEN_MINUTES * 2,
    amyfxSyntheticCurrent: true
  };
  const first = replayAmySmcD(closed, { tf: 'M15' });
  const second = replayAmySmcD(closed, { tf: 'M15' });
  const withLiveTail = replayAmySmcD([...closed, openTail, syntheticTail], { tf: 'M15' });
  const analyzedClosed = analyze(closed, 'M15');
  const analyzedWithLiveTail = analyze([...closed, openTail, syntheticTail], 'M15');

  assert.deepEqual(first, second);
  assert.deepEqual(first, withLiveTail);
  assert.deepEqual(analyzedClosed, analyzedWithLiveTail);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.descriptive.dealingRange), true);
});

test('live price argument cannot change Mapping output', () => {
  const closed = waveCandles(320, 'M15', FIFTEEN_MINUTES);
  const lowLivePrice = analyze(closed, 'M15', {}, 1);
  const highLivePrice = analyze(closed, 'M15', {}, 999_999);

  assert.deepEqual(lowLivePrice.amySmcD, highLivePrice.amySmcD);
  assert.equal(lowLivePrice.signal, highLivePrice.signal);
  assert.equal(lowLivePrice.final, highLivePrice.final);
  assert.equal(lowLivePrice.analyzedPrice, closed.at(-1).close);
  assert.equal(highLivePrice.analyzedPrice, closed.at(-1).close);
});

test('Twelve Data WebSocket tick handler is display-only and cannot invoke Mapping replay', async () => {
  const source = await readFile(
    new URL('../app/src/main/assets/apps/mapping/js/api/market-data.js', import.meta.url),
    'utf8'
  );
  const start = source.indexOf('function applyLivePriceTick(');
  const end = source.indexOf('function handleNativeLiveStatus(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = source.slice(start, end);

  assert.match(handler, /renderAnalyzeLive\(\)/);
  assert.match(handler, /renderSoft\(\)/);
  assert.doesNotMatch(handler, /runAnalysis|fetchTf|\banalyze\s*\(|publishMappingSnapshot|amyfx:mapping-state-change/);
});

test('H1 dealing range uses only the previous 240 closed H1 candles', () => {
  const candles = Array.from({ length: 241 }, (_, index) => ({
    time: BASE_TIME + index * ONE_HOUR,
    timeframe: 'H1',
    open: 150,
    high: index === 10 ? 200 : index === 240 ? 1_000 : 160,
    low: index === 20 ? 100 : index === 240 ? 10 : 140,
    close: 150,
    isClosed: true
  }));
  const result = replayAmySmcD(candles, { tf: 'H1' });
  const range = result.descriptive.dealingRange;

  assert.equal(range.source, 'PREVIOUS_240_CLOSED_H1');
  assert.equal(range.top, 200);
  assert.equal(range.bottom, 100);
  assert.equal(range.premiumRatio, 0.55);
  assert.equal(range.discountRatio, 0.45);
  assert.equal(range.premiumGate, 155);
  assert.equal(range.discountGate, 145);
  assert.equal(range.location, 'EQUILIBRIUM');
  assert.notEqual(range.top, candles.at(-1).high);
  assert.notEqual(range.bottom, candles.at(-1).low);
});

test('M5 and M15 retain structural dealing-range sources and D pure-location boundaries', () => {
  const cases = [
    ['M5', FIVE_MINUTES, 'D_STRUCTURAL_M5', 0.70, 0.30],
    ['M15', FIFTEEN_MINUTES, 'D_STRUCTURAL_M15', 0.60, 0.40]
  ];

  for (const [tf, step, source, premiumRatio, discountRatio] of cases) {
    const result = replayAmySmcD(waveCandles(400, tf, step), { tf });
    const range = result.descriptive.dealingRange;
    assert.equal(range.valid, true, `${tf} structural range should be established`);
    assert.equal(range.source, source);
    assert.equal(range.premiumRatio, premiumRatio);
    assert.equal(range.discountRatio, discountRatio);
    assert.notEqual(range.source, 'PREVIOUS_240_CLOSED_H1');
  }
});

test('W1 keeps the original D monthly HTF profile using complete D1 candles only', () => {
  const daily = [];
  const cursor = new Date(Date.UTC(2024, 0, 1));
  while (daily.length < 450) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      const base = 100 + daily.length * 0.2;
      daily.push({
        time: Math.floor(cursor.getTime() / 1000),
        timeframe: 'D1',
        open: base,
        high: base + 1,
        low: base - 1,
        close: base + 0.5,
        isClosed: true
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const lastTime = daily.at(-1).time;
  const weekly = waveCandles(30, 'W1', 7 * 24 * ONE_HOUR)
    .map((candle, index, values) => ({
      ...candle,
      time: lastTime - (values.length - 1 - index) * 7 * 24 * ONE_HOUR
    }));
  const complete = replayAmySmcD(weekly, { tf: 'W1', htfCandles: { D1: daily } });
  const incompleteMonthly = daily.filter(candle => new Date(candle.time * 1000).getUTCDate() === 1);
  const incomplete = replayAmySmcD(weekly, { tf: 'W1', htfCandles: { D1: incompleteMonthly } });

  assert.equal(complete.descriptive.htfSwing.timeframe, 'MN1');
  assert.equal(complete.descriptive.htfSwing.direction, 'BULLISH');
  assert.equal(incomplete.descriptive.htfSwing.direction, 'NEUTRAL');
});

test('D dealing range is descriptive-only and excluded from all directional predictors', async () => {
  const source = await readFile(
    new URL('../app/src/main/assets/apps/mapping/js/engine/amy-smc-d-engine.js', import.meta.url),
    'utf8'
  );
  const result = replayAmySmcD(waveCandles(320, 'M15', FIFTEEN_MINUTES), { tf: 'M15' });
  const range = result.descriptive.dealingRange;
  const finalBias = result.descriptive.finalBias;

  assert.equal(range.descriptiveOnly, true);
  assert.equal(range.predictorDependency, false);
  assert.equal(finalBias.dealingRangeExcluded, true);
  assert.deepEqual(Object.keys(finalBias.components).sort(), [
    'htfSwing',
    'internalStructure',
    'liquidity',
    'swingStructure'
  ]);
  assert.match(source, /const finalScore = htfBias \* 35 \+ trends\.swing \* 30 \+ trends\.internal \* 20 \+ liquidityBias \* 15;/);
  assert.doesNotMatch(source, /const finalScore[^;]*dealingBias/);
});

test('qualified BOS stays empty on M5, M15, and H1 instead of creating synthetic events', () => {
  const cases = [
    ['M5', FIVE_MINUTES],
    ['M15', FIFTEEN_MINUTES],
    ['H1', ONE_HOUR]
  ];

  for (const [tf, step] of cases) {
    const result = replayAmySmcD(waveCandles(400, tf, step), { tf });
    assert.equal(result.predictive.qualifiedBos, null, `${tf} qualified BOS must remain N=0`);
    assert.equal(
      result.raw.predictiveEvents.some(event => event.kind === 'BOS' && event.qualified === true),
      false,
      `${tf} history must not contain qualified synthetic BOS`
    );
  }
});

test('active analysis path has one D authority and excludes B/B-LAB execution experiments', async () => {
  const [analysisSource, marketSource, dSource] = await Promise.all([
    readFile(new URL('../app/src/main/assets/apps/mapping/js/engine/concept-analyze.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/main/assets/apps/mapping/js/api/market-data.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/main/assets/apps/mapping/js/engine/amy-smc-d-engine.js', import.meta.url), 'utf8')
  ]);

  assert.match(analysisSource, /replayAmySmcD/);
  assert.match(marketSource, /activeRegime: 'AMY_SMC_D'/);
  assert.doesNotMatch(marketSource, /from ['"][^'"]*(market-regime-engine|strategy-router-engine|validated-market-context)/);
  assert.doesNotMatch(`${analysisSource}\n${dSource}`, /M5_TGT2|SEGMENTED_TARGET|B_LAB|ATR_TRADE_MANAGEMENT/);
});
