import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Regression: STALE/EXPIRED not a hard gate in execution-plan-core.js', () => {
  const code = fs.readFileSync('app/src/main/assets/apps/mapping/js/execution-plan-core.js', 'utf8');
  assert.ok(!code.includes("return 'STALE'"), "Should not have hard STALE return");
});

test('Regression: 0, 0.00, null, non-positive levels are invalid', () => {
  const code = fs.readFileSync('app/src/main/assets/apps/mapping/js/execution-plan-core.js', 'utf8');
  assert.ok(code.includes('number != null && number > 0 ? number : null'), "positivePrice logic must exist");
});

test('Regression: Asia Range uses canonical 06:00-14:00 window', () => {
  const code = fs.readFileSync('app/src/main/assets/apps/mapping/js/session/asia-range.js', 'utf8');
  assert.ok(code.includes('const ASIA_START_HOUR = 6;'), "ASIA_START_HOUR should be 6");
  assert.ok(code.includes('const ASIA_END_HOUR = 14;'), "ASIA_END_HOUR should be 14");
});

test('Regression: M5/M15 aggregation from M1 when fetch fails', () => {
  const code = fs.readFileSync('app/src/main/assets/apps/mapping/js/api/market-data.js', 'utf8');
  assert.ok(code.includes("state.candles['M1']?.length"), "Should check M1 candles for fallback");
  assert.ok(code.includes("Math.floor(c.time / targetSeconds) * targetSeconds"), "Should aggregate candles");
});

test('Regression: Scalping direction prioritizing M15, M5, M1', () => {
  const code = fs.readFileSync('app/src/main/assets/apps/mapping/js/outlook/v2/base.js', 'utf8');
  assert.ok(code.includes("id: 'SCALPING'"), "SCALPING horizon must exist");
  assert.ok(code.includes("M15: 0.45, M5: 0.25, M1: 0.2, M30: 0.05, H1: 0.05"), "SCALPING weights should match requirements");
});

test('Regression: UI stability - observers and auto-scroll disabled', () => {
  const code = fs.readFileSync('app/src/main/assets/apps/mapping/js/view-stability.js', 'utf8');
  assert.ok(!code.includes('window.scrollTo({ top: target'), "auto-scroll should be disabled in restorePosition");
  const execUi = fs.readFileSync('app/src/main/assets/apps/mapping/js/execution-plan-ui.js', 'utf8');
  assert.ok(!execUi.includes('scrollIntoView'), "scrollIntoView should be removed");
});
