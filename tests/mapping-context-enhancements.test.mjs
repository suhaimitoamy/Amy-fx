import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAPPING_EVIDENCE_CLASS,
  buildEvidenceCatalog,
  buildStrongWeakStructure,
  detectAdaptiveEqualHighLow,
  detectPreviousMonthLevels,
  previousMonthSnapshot,
  reviewOrderBlockOrigins
} from '../app/src/main/assets/apps/mapping/js/engine/concept-context-enhancements.js';

const candle = (time, open, high, low, close) => ({
  time: Math.floor(Date.parse(time) / 1000),
  open, high, low, close,
  isClosed: true
});

test('PMH and PML are context-only previous-month liquidity', () => {
  const daily = [
    candle('2026-07-01T00:00:00Z', 3300, 3310, 3290, 3305),
    candle('2026-07-15T00:00:00Z', 3305, 3350, 3280, 3340),
    candle('2026-07-31T00:00:00Z', 3340, 3345, 3270, 3295),
    candle('2026-08-01T00:00:00Z', 3295, 3320, 3290, 3310)
  ];
  const intraday = Array.from({ length: 20 }, (_, index) =>
    candle(`2026-08-01T${String(index).padStart(2, '0')}:00:00Z`, 3300, 3310, 3290, 3300));
  const levels = detectPreviousMonthLevels(intraday, daily, { currentPrice: 3300 });
  const snapshot = previousMonthSnapshot(levels);
  assert.equal(snapshot.pmh, 3350);
  assert.equal(snapshot.pml, 3270);
  assert.equal(levels.every(level => level.executionAuthority === false), true);
  assert.equal(levels.every(level => level.evidenceClass === MAPPING_EVIDENCE_CLASS.VALIDATED_CONTEXT), true);
});

test('strong and weak labels use protected structure and active liquidity without becoming entry authority', () => {
  const result = buildStrongWeakStructure(
    { bias: 'BULLISH', protectedLow: 3285, protectedHigh: 3360 },
    { activeTargets: [{ type: 'BSL', level: 3360, label: 'PMH' }] }
  );
  assert.equal(result.strongLow.level, 3285);
  assert.equal(result.weakHigh.level, 3360);
  assert.equal(result.executionAuthority, false);
});

test('adaptive EQH/EQL remains advisory and does not replace production threshold', () => {
  const values = [];
  let price = 3300;
  for (let index = 0; index < 80; index += 1) {
    const wave = Math.sin(index / 3) * 5;
    const high = price + wave + 3;
    const low = price + wave - 3;
    values.push({ time: 1_700_000_000 + index * 900, open: price + wave, high, low, close: price + wave + 0.5, isClosed: true });
  }
  const result = detectAdaptiveEqualHighLow(values, 'H1');
  assert.equal(result.appliedToProduction, false);
  assert.equal(result.productionToleranceAtr, 0.03);
  assert.equal(result.profile.toleranceAtr, 0.05);
});

test('dual-origin review never mutates the locked primary OB', () => {
  const values = [
    { time: 1, open: 100, high: 102, low: 97, close: 98, isClosed: true },
    { time: 2, open: 99, high: 101, low: 95, close: 96, isClosed: true },
    { time: 3, open: 96, high: 100, low: 94, close: 99, isClosed: true },
    { time: 4, open: 99, high: 108, low: 98, close: 107, isClosed: true }
  ];
  const zones = [{
    id: 'OB:BULLISH', direction: 'BULLISH', originIndex: 2,
    structureBreakIndex: 3, structureScope: 'INTERNAL'
  }];
  const review = reviewOrderBlockOrigins(zones, values)[0];
  assert.equal(review.lockedPrimaryIndex, 2);
  assert.equal(review.applied, false);
  assert.equal(zones[0].originIndex, 2);
});

test('evidence contract keeps raw zones outside execution authority', () => {
  const catalog = buildEvidenceCatalog({
    structureSnapshot: { events: [{ id: 's1', concept: 'MSS', status: 'CANDIDATE', valid: false }] },
    liquidityLevels: [{ id: 'l1', type: 'BSL', status: 'DETECTED', confirmed: false }],
    fairValueGaps: [{ id: 'f1', kind: 'FVG', status: 'DETECTED' }],
    orderBlocks: [{ id: 'o1', kind: 'ORDER_BLOCK', status: 'CONFIRMED_REACTION' }]
  });
  assert.equal(catalog.zones[0].evidenceClass, MAPPING_EVIDENCE_CLASS.RAW_OBSERVATION);
  assert.equal(catalog.zones[1].evidenceClass, MAPPING_EVIDENCE_CLASS.VALIDATED_CONTEXT);
  assert.equal(catalog.zones.every(item => item.executionAuthority === false), true);
});
