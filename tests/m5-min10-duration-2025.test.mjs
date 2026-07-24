import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reportUrl = new URL('../docs/backtests/AMY_FX_M5_MIN10_DURATION_2025.md', import.meta.url);
const dataUrl = new URL('../docs/backtests/amy-fx-m5-min10-duration-2025.json', import.meta.url);

test('2025 min-10 point experiment records duration sensitivity honestly', () => {
  const report = readFileSync(reportUrl, 'utf8');
  const result = JSON.parse(readFileSync(dataUrl, 'utf8'));
  const comparison = result.durationComparison || result.variants;
  const twoHours = comparison['24bars'].summary;
  const twentyFourHours = comparison['288bars'].summary;

  assert.equal(result.status, 'FINAL_BACKTEST_M5_MIN10_DURATION_COMPARISON_2025');
  assert.equal(result.methodology.m5Candles, 70810);
  assert.equal(result.methodology.m1Candles, 353951);
  assert.equal(twoHours.entries, 299);
  assert.equal(twoHours.netPointsTp2Model, -400);
  assert.equal(twentyFourHours.entries, 250);
  assert.equal(twentyFourHours.tp1Rate, 50);
  assert.equal(twentyFourHours.tp2Rate, 34.4);
  assert.equal(twentyFourHours.netPointsTp2Model, 140);
  assert.match(report, /hasil positifnya \*\*tipis\*\*/i);
  assert.match(report, /belum cukup kuat untuk dipasang ke aplikasi/i);
});
