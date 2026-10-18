import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const candleStoreSource = readFileSync(new URL('../app/src/main/java/com/amyelitesuite/CandleStore.kt', import.meta.url), 'utf8');

test('Item 1.25: CandleStore companion defines 24h throttling interval and lastCleanupMillis', () => {
  assert.match(
    candleStoreSource,
    /CLEANUP_INTERVAL_MILLIS\s*=\s*24L\s*\*\s*60L\s*\*\s*60L\s*\*\s*1000L/,
    'Must define 24-hour cleanup interval in milliseconds'
  );
  assert.match(
    candleStoreSource,
    /@Volatile\s+var\s+lastCleanupMillis:\s*Long\s*=\s*0L/,
    'Must maintain thread-safe volatile lastCleanupMillis timestamp'
  );
});

test('Item 1.25: cleanupExpiredCandles throttles repeated calls within 24 hours', () => {
  assert.match(
    candleStoreSource,
    /if\s*\(!force\s*&&\s*\(nowMillis\s*-\s*lastCleanupMillis\s*<\s*CLEANUP_INTERVAL_MILLIS\)\)\s*\{\s*return\s*\}/,
    'cleanupExpiredCandles must return early if called within 24 hours unless force=true'
  );
  assert.match(
    candleStoreSource,
    /lastCleanupMillis\s*=\s*nowMillis/,
    'Must update lastCleanupMillis when cleanup executes'
  );
});

test('Item 1.25: Mathematical simulation of CandleStore throttling behavior', () => {
  const CLEANUP_INTERVAL_MILLIS = 24 * 60 * 60 * 1000;
  let lastCleanup = 0;
  let executionCount = 0;

  function simulateCleanup(nowSeconds, force = false) {
    const nowMillis = nowSeconds * 1000;
    if (!force && (nowMillis - lastCleanup < CLEANUP_INTERVAL_MILLIS)) {
      return false;
    }
    executionCount++;
    lastCleanup = nowMillis;
    return true;
  }

  const baseSec = 1700000000;

  // First call executes
  assert.equal(simulateCleanup(baseSec), true);
  assert.equal(executionCount, 1);

  // Calls within 15 minutes, 1 hour, 12 hours must be throttled
  assert.equal(simulateCleanup(baseSec + 900), false);
  assert.equal(simulateCleanup(baseSec + 3600), false);
  assert.equal(simulateCleanup(baseSec + 43200), false);
  assert.equal(executionCount, 1, 'Executions must remain 1');

  // Call after 24h + 1 sec executes
  assert.equal(simulateCleanup(baseSec + 86401), true);
  assert.equal(executionCount, 2, 'Must execute once 24h has passed');

  // Forced execution ignores throttle
  assert.equal(simulateCleanup(baseSec + 86500, true), true);
  assert.equal(executionCount, 3, 'Force execution must succeed');
});
