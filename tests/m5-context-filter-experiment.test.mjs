import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dataUrl = new URL('../docs/backtests/amy-fx-m5-context-filters-2024.json', import.meta.url);
const reportUrl = new URL('../docs/backtests/AMY_FX_M5_CONTEXT_FILTERS_2024.md', import.meta.url);

test('M5 context-filter audit records the 18:00–04:00 WITA candidate honestly', () => {
  const result = JSON.parse(readFileSync(dataUrl, 'utf8'));
  const report = readFileSync(reportUrl, 'utf8');
  const baseline = result.models.BASELINE;
  const candidate = result.models.NEW_YORK_OR_PRE_NY;

  assert.equal(result.status, 'FINAL_M5_CONTEXT_FILTER_EXPERIMENT_2024');
  assert.equal(result.methodology.m5Candles, 71133);
  assert.equal(result.methodology.m1Candles, 355592);
  assert.equal(result.methodology.noLookahead, true);
  assert.equal(baseline.overall.entries, 165);
  assert.equal(baseline.overall.tp2Rate, 42.42);
  assert.equal(candidate.overall.entries, 63);
  assert.equal(candidate.overall.tp1Rate, 69.84);
  assert.equal(candidate.overall.tp2Rate, 57.14);
  assert.equal(candidate.validationSepDec.entries, 21);
  assert.equal(candidate.validationSepDec.tp2Rate, 57.14);
  assert.equal(candidate.costStressTp2R['0.20'], 0.48);
  assert.match(report, /18:00–04:00 WITA/);
  assert.match(report, /risiko data-mining/);
  assert.match(report, /belum dijadikan logika aktif aplikasi/);
});
