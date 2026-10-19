import test from 'node:test';
import assert from 'node:assert/strict';

// Load replay engine
const root = {};
// Minimal practice core mock
root.AmyPracticeCore = {
  finite: (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
};

// Evaluate replay-engine in sandbox
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync('app/src/main/assets/apps/academy/trading-practice/assets/js/replay-engine.js', 'utf8');
vm.runInNewContext(code, root);

test('ReplayController prefetchWindow populates buffer and satisfies emit from memory (Item 1.18)', async () => {
  let providerFetchCount = 0;
  const mockTimeline = [1000, 2000, 3000, 4000, 5000, 6000, 7000];

  const mockProvider = {
    getTimeline: async () => mockTimeline.slice(),
    getCandles: async ({ cursor }) => {
      providerFetchCount++;
      return {
        sourceId: 'mock-pack',
        source: 'Mock',
        candles: [{ time: cursor, open: 2600, high: 2605, low: 2595, close: 2602 }]
      };
    }
  };

  const controller = new root.AmyReplayEngine.ReplayController({
    provider: mockProvider,
    symbol: 'XAUUSD',
    timeframe: 'M15'
  });

  await controller.start(1000);
  assert.equal(controller.cursor, 1000);
  assert.equal(providerFetchCount, 1); // initial emit

  // Prefetch 3 ahead
  await controller.prefetchWindow(3);
  assert.equal(controller.prefetchBuffer.size, 3);
  assert.equal(providerFetchCount, 4); // 1 initial + 3 prefetched

  // Move forward to 2000: emit should consume prefetchBuffer WITHOUT extra provider call!
  const prevFetch = providerFetchCount;
  await controller.move(1);
  assert.equal(controller.cursor, 2000);
  assert.equal(providerFetchCount, prevFetch, 'emit must consume from prefetchBuffer without extra provider query');
  assert.equal(controller.prefetchBuffer.size, 2);

  // Pause clears prefetch buffer
  controller.pause();
  assert.equal(controller.prefetchBuffer.size, 0);
});
