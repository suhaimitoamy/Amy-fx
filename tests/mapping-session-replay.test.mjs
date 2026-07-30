import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyze,
  resolveAnalysisTimeMs
} from '../app/src/main/assets/apps/mapping/js/engine/core/analyze.js';

const historicalTime = Date.parse('2021-03-19T12:00:00Z');

test('replay analysis time uses the last closed candle and ignores a future open candle', () => {
  const candles = [
    { time: historicalTime / 1000 - 300, isClosed: true },
    { time: historicalTime / 1000, isClosed: true },
    { time: historicalTime / 1000 + 300, isClosed: false }
  ];

  assert.equal(
    resolveAnalysisTimeMs(candles, { mode: 'REPLAY' }),
    historicalTime
  );
});

test('explicit analysis timestamp accepts seconds or milliseconds and overrides replay inference', () => {
  const explicit = Date.parse('2022-10-03T07:00:00Z');
  const candles = [{ time: historicalTime / 1000, isClosed: true }];

  assert.equal(
    resolveAnalysisTimeMs(candles, {
      mode: 'REPLAY',
      analysisTimestamp: explicit / 1000
    }),
    explicit
  );
  assert.equal(
    resolveAnalysisTimeMs(candles, {
      analysisTimeMs: explicit
    }),
    explicit
  );
});

test('live analysis time still resolves from the current clock', () => {
  const before = Date.now();
  const resolved = resolveAnalysisTimeMs([
    { time: historicalTime / 1000, isClosed: true }
  ]);
  const after = Date.now();

  assert.ok(resolved >= before);
  assert.ok(resolved <= after);
});

test('legacy session context becomes historical in replay mode', () => {
  const candles = Array.from({ length: 40 }, (_, index) => {
    const close = 100 + index * 0.1;
    return {
      time: historicalTime / 1000 - (39 - index) * 300,
      open: close - 0.1,
      high: close + 0.4,
      low: close - 0.4,
      close,
      isClosed: true
    };
  });

  const result = analyze(
    candles,
    'M5',
    {},
    candles.at(-1).close,
    {},
    { mode: 'REPLAY' }
  );

  assert.equal(result.sessionContext.session, 'NEW_YORK');
  assert.equal(result.activeSession, 'NEW_YORK');
});
