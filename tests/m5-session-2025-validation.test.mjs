import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reportUrl = new URL('../docs/backtests/AMY_FX_M5_SESSION_2025.md', import.meta.url);
const dataUrl = new URL('../docs/backtests/amy-fx-m5-session-2025.json', import.meta.url);

test('2025 validates the locked 18:00–04:00 WITA M5 session model', () => {
  const report = readFileSync(reportUrl, 'utf8');
  const result = JSON.parse(readFileSync(dataUrl, 'utf8'));
  const session = result.session1800To0400Wita;

  assert.equal(result.status, 'FINAL_BACKTEST_M5_REACTION_FIRST_SESSION_2025');
  assert.equal(result.methodology.m5Candles, 70810);
  assert.equal(result.methodology.m1Candles, 353951);
  assert.match(result.methodology.sessionFilter, /18:00 through 03:59 WITA/);

  assert.equal(session.entries, 109);
  assert.equal(session.buyEntries, 53);
  assert.equal(session.sellEntries, 56);
  assert.equal(session.tp1Reached, 59);
  assert.equal(session.tp1Rate, 54.13);
  assert.equal(session.tp2Reached, 48);
  assert.equal(session.tp2Rate, 44.04);
  assert.equal(session.expectancyAtTp2R, 0.321);

  assert.equal(result.allDay2025.entries, 330);
  assert.equal(result.allDay2025.tp2Rate, 36.67);
  assert.equal(result.combined2024And2025Session.entries, 172);
  assert.equal(result.combined2024And2025Session.tp2Rate, 48.84);

  assert.match(report, /lulus validasi 2025 dalam arti masih positif/);
  assert.match(report, /hasil 2025 jauh lebih rendah daripada 2024/);
  assert.match(report, /Spread|biaya broker nyata/);
});
