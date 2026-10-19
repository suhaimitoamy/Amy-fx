import assert from 'node:assert/strict';
import test from 'node:test';

// Setup minimal document / window mock if needed by ict-canvas imports
globalThis.document = {
  documentElement: { dataset: { amyfxTheme: 'dark' } },
  createElement: () => ({
    style: {},
    setAttribute: () => {},
    appendChild: () => {},
    getContext: () => null
  })
};
globalThis.window = { devicePixelRatio: 1 };

const { getCandlesFingerprint } = await import('../app/src/main/assets/apps/mapping/js/ict-workspace/ict-canvas.js');

test('getCandlesFingerprint returns empty string for empty inputs', () => {
  assert.equal(getCandlesFingerprint('M15', null), '');
  assert.equal(getCandlesFingerprint('M15', []), '');
});

test('getCandlesFingerprint generates O(1) composite fingerprint', () => {
  const candles = [
    { time: 1700000000, open: 2600, high: 2605, low: 2595, close: 2602 },
    { time: 1700000900, open: 2602, high: 2610, low: 2601, close: 2608 },
    { time: 1700001800, open: 2608, high: 2615, low: 2605, close: 2612 }
  ];

  const fp1 = getCandlesFingerprint('M15', candles);
  assert.equal(fp1, 'M15:3:1700000000:1700001800:2612');

  // Same candles produce identical fingerprint
  const fp2 = getCandlesFingerprint('M15', [...candles]);
  assert.equal(fp1, fp2);

  // Changing close price of last candle alters fingerprint
  candles[2].close = 2614;
  const fp3 = getCandlesFingerprint('M15', candles);
  assert.equal(fp3, 'M15:3:1700000000:1700001800:2614');
  assert.notEqual(fp1, fp3);

  // Appending candle alters fingerprint
  candles.push({ time: 1700002700, open: 2614, high: 2620, low: 2613, close: 2618 });
  const fp4 = getCandlesFingerprint('M15', candles);
  assert.equal(fp4, 'M15:4:1700000000:1700002700:2618');
  assert.notEqual(fp3, fp4);
});

test('getCandlesFingerprint handles datetime string fallback', () => {
  const candles = [
    { datetime: '2026-10-18T00:00:00Z', open: 2600, high: 2605, low: 2595, close: 2602 },
    { datetime: '2026-10-18T00:15:00Z', open: 2602, high: 2610, low: 2601, close: 2608 }
  ];

  const fp = getCandlesFingerprint('M15', candles);
  assert.equal(fp, 'M15:2:2026-10-18T00:00:00Z:2026-10-18T00:15:00Z:2608');
});
