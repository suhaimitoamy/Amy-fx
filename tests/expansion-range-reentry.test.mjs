import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Scalper Engine registers Expansion Range Re-entry V3 without drifting from the current Pro source identity', () => {
  const signals = read('supabase/functions/scalper-engine/signals.mjs');
  const detector = read('supabase/functions/scalper-engine/expansion-range-reentry.mjs');
  const lifecycle = read('supabase/functions/scalper-engine/expansion-range-lifecycle.mjs');
  const engine = read('supabase/functions/scalper-engine/engine.mjs');
  const gradle = read('app/build.gradle.kts');
  const appVersion = read('app/src/main/assets/app-version.js');

  for (const marker of [
    'EXPANSION_RANGE_REENTRY',
    'Expansion Range Re-entry',
    'ERR-V3-2026-M15-V1',
    "timeframes: ['M15']",
    'rangeSpan < 2.5 || rangeSpan > 10',
    'rangeLow + 1',
    'rangeHigh - 1',
    'rangeLow - 3',
    'rangeHigh + 3',
    '* 0.35',
    'MIDPOINT_REARM_BUY',
    'MIDPOINT_REARM_SELL',
    'parent_entry_deadline',
    'cancel_on_m15_close_break',
  ]) {
    assert.ok(detector.includes(marker), `ERR V3 detector marker missing: ${marker}`);
  }

  for (const marker of [
    'EXPANSION_RANGE_REENTRY_DRIVER',
    'evaluateExpansionRangeReentryCandidates',
    'detectExpansionRangeReentryCandidates',
  ]) {
    assert.ok(signals.includes(marker), `ERR V3 signals integration marker missing: ${marker}`);
  }

  for (const marker of [
    'EXPANSION_RANGE_REENTRY_V3',
    'ERR_RANGE_LIMIT',
    'ERR_RANGE_M15_CLOSE_BREAK_BEFORE_FILL',
    'profit_lock_at_tp1',
    "runner_exit: 'TP1_LOCK'",
    "runner_exit: 'TP2'",
    'extension on the next M1 candle',
  ]) {
    assert.ok(lifecycle.includes(marker), `ERR V3 lifecycle marker missing: ${marker}`);
  }

  assert.ok(engine.includes("from './rebuilt-lifecycle.mjs'"));
  assert.ok(fs.readFileSync(new URL('../supabase/functions/scalper-engine/rebuilt-lifecycle.mjs', import.meta.url), 'utf8').includes("from './discipline-lifecycle.mjs'"));
  assert.ok(fs.readFileSync(new URL('../supabase/functions/scalper-engine/discipline-lifecycle.mjs', import.meta.url), 'utf8').includes("from './expansion-range-lifecycle.mjs'"));

  const identity = appVersion.match(/name: '(2\.0\.0-pro\.(\d+))', code: (95\d{4})/);
  assert.ok(identity, 'current Pro identity must be readable from app-version.js');
  const [, versionName, sequenceText, versionCodeText] = identity;
  assert.equal(Number(versionCodeText), 950000 + Number(sequenceText));
  assert.match(gradle, new RegExp(`versionCode = .*\\?: ${versionCodeText}\\)`));
  assert.ok(gradle.includes(`versionName = System.getenv("AMYFX_VERSION_NAME") ?: "${versionName}"`));
});
