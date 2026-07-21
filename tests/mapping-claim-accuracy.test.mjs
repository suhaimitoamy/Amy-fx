import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPPING_CLAIM_ACCURACY, LOCKED_PINE_REFERENCE_CLAIMS } from '../app/src/main/assets/apps/mapping/js/engine/mapping-claim-accuracy.js';

test('claim registry exposes the audited 2022-2025 app metrics', () => {
  assert.equal(MAPPING_CLAIM_ACCURACY.nearestLiquidity.value, 79.55);
  assert.equal(MAPPING_CLAIM_ACCURACY.nearestLiquidity.coverage, 82.97);
  assert.equal(MAPPING_CLAIM_ACCURACY.marketRegime.value, 19.74);
  assert.equal(MAPPING_CLAIM_ACCURACY.marketShift.value, 14.01);
  assert.equal(MAPPING_CLAIM_ACCURACY.marketShift.secondaryValue, 62.21);
  assert.equal(MAPPING_CLAIM_ACCURACY.strategyRouter.value, 48.53);
  assert.equal(MAPPING_CLAIM_ACCURACY.validBreak.value, 67.51);
  assert.equal(MAPPING_CLAIM_ACCURACY.sweepOnly.value, 68.33);
  assert.equal(MAPPING_CLAIM_ACCURACY.failedBreak.value, 81.38);
  assert.equal(MAPPING_CLAIM_ACCURACY.entryMap.value, 48.24);
});

test('every metric states its own claim and authority', () => {
  for (const [key, claim] of Object.entries(MAPPING_CLAIM_ACCURACY)) {
    assert.ok(claim.claim?.length > 20, `${key} is missing a claim definition`);
    assert.ok(claim.metric?.length > 3, `${key} is missing a metric`);
    assert.ok(claim.authority?.length > 3, `${key} is missing authority`);
  }
});

test('locked Pine references are preserved without retuning', () => {
  const values = Object.fromEntries(LOCKED_PINE_REFERENCE_CLAIMS.map(item => [item.label, item.value]));
  assert.equal(values['Validated Target'], 91.38);
  assert.equal(values['Asia High / Low'], 86.64);
  assert.equal(values['PDH / PDL'], 85.64);
  assert.equal(values['Midnight Open'], 86.43);
  assert.equal(values['Order Block'], 83.91);
  assert.equal(values.FVG, 82.37);
  assert.equal(values['M5 Key Liquidity'], 82.43);
  assert.equal(values['Protected Low'], 93.47);
  assert.equal(values['Protected High'], 91.86);
});
