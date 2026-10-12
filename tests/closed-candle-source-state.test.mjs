import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCurrentClosedCandleSource,
  inspectClosedCandleSource
} from '../app/src/main/assets/apps/mapping/js/engine/closed-candle-source-state.js';

function candles({ count = 300, latestOpen, stepSeconds = 900 }) {
  return Array.from({ length: count }, (_, index) => {
    const time = latestOpen - (count - 1 - index) * stepSeconds;
    const open = 4100 + index * 0.01;
    return {
      time,
      open,
      high: open + 1,
      low: open - 1,
      close: open + 0.3,
      isClosed: true
    };
  });
}

test('300 stale candles are not current merely because fetch completed now', () => {
  const nowMs = Date.UTC(2026, 7, 5, 5, 5, 0);
  const expected = 1785905100;
  const values = candles({ latestOpen: expected - 8 * 900 });
  const state = inspectClosedCandleSource('M15', values, { nowMs });
  assert.equal(state.count, 300);
  assert.equal(state.delayed, true);
  assert.equal(state.blockingDelayed, true);
  assert.equal(state.lagBars, 8);
  assert.throws(
    () => assertCurrentClosedCandleSource('M15', values, { nowMs }),
    /tertinggal 8 bar/
  );
});

test('current M15 closed candle is accepted', () => {
  const nowMs = Date.UTC(2026, 7, 5, 5, 5, 0);
  const expected = 1785905100;
  const state = inspectClosedCandleSource(
    'M15',
    candles({ latestOpen: expected }),
    { nowMs }
  );
  assert.equal(state.current, true);
  assert.equal(state.delayed, false);
  assert.equal(state.lagBars, 0);
});
