import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateClosedCandles } from '../app/src/main/assets/apps/mapping/js/api/closed-candle-aggregation.js';

function m1Series(start, count, missing = new Set()) {
  return Array.from({ length: count }, (_, index) => {
    if (missing.has(index)) return null;
    const open = 3300 + index;
    return {
      time: start + index * 60,
      open,
      high: open + 2,
      low: open - 1,
      close: open + 1,
      tickCount: 3,
      isClosed: true
    };
  }).filter(Boolean);
}

test('complete M1 buckets produce closed M5 and M15 candles', () => {
  const start = 1_785_571_200;
  const source = m1Series(start, 15);
  const cutoff = (start + 16 * 60) * 1000;
  const m5 = aggregateClosedCandles(source, {
    timeframe: 'M5',
    durationMs: 5 * 60_000,
    closeCutoff: cutoff
  });
  const m15 = aggregateClosedCandles(source, {
    timeframe: 'M15',
    durationMs: 15 * 60_000,
    closeCutoff: cutoff
  });

  assert.equal(m5.length, 3);
  assert.equal(m15.length, 1);
  assert.equal(m15[0].sourceCount, 15);
  assert.equal(m15[0].open, source[0].open);
  assert.equal(m15[0].close, source.at(-1).close);
  assert.equal(m15[0].high, Math.max(...source.map(item => item.high)));
  assert.equal(m15[0].low, Math.min(...source.map(item => item.low)));
  assert.equal(m15[0].isClosed, true);
});

test('incomplete or discontinuous buckets are discarded', () => {
  const start = 1_785_571_200;
  const source = m1Series(start, 15, new Set([7]));
  const cutoff = (start + 16 * 60) * 1000;
  const m15 = aggregateClosedCandles(source, {
    timeframe: 'M15',
    durationMs: 15 * 60_000,
    closeCutoff: cutoff
  });
  const m5 = aggregateClosedCandles(source, {
    timeframe: 'M5',
    durationMs: 5 * 60_000,
    closeCutoff: cutoff
  });

  assert.equal(m15.length, 0);
  assert.equal(m5.length, 2);
});

test('bucket whose end has not closed is discarded', () => {
  const start = 1_785_571_200;
  const source = m1Series(start, 5);
  const result = aggregateClosedCandles(source, {
    timeframe: 'M5',
    durationMs: 5 * 60_000,
    closeCutoff: (start + 4 * 60) * 1000
  });
  assert.deepEqual(result, []);
});

test('zero, invalid OHLC, open candles, and duplicate timestamps cannot complete a bucket', () => {
  const start = 1_785_571_200;
  const source = m1Series(start, 5);
  source[1].close = 0;
  source[2].isClosed = false;
  source.push({ ...source[4] });
  const result = aggregateClosedCandles(source, {
    timeframe: 'M5',
    durationMs: 5 * 60_000,
    closeCutoff: (start + 6 * 60) * 1000
  });
  assert.deepEqual(result, []);
});
