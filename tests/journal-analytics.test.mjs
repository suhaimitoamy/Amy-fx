import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../app/src/main/assets/apps/journal/journal-analytics.js', import.meta.url),
  'utf8'
);

function createAnalyticsContext() {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.AmyJournalAnalytics;
}

test('normalizeResult handles various case styles, whitespace, and abbreviations', () => {
  const analytics = createAnalyticsContext();
  assert.equal(analytics.normalizeResult('Win'), 'Win');
  assert.equal(analytics.normalizeResult('win'), 'Win');
  assert.equal(analytics.normalizeResult('WIN'), 'Win');
  assert.equal(analytics.normalizeResult('  win  '), 'Win');

  assert.equal(analytics.normalizeResult('Loss'), 'Loss');
  assert.equal(analytics.normalizeResult('loss'), 'Loss');
  assert.equal(analytics.normalizeResult('LOSS'), 'Loss');

  assert.equal(analytics.normalizeResult('Breakeven'), 'Breakeven');
  assert.equal(analytics.normalizeResult('breakeven'), 'Breakeven');
  assert.equal(analytics.normalizeResult('BE'), 'Breakeven');
  assert.equal(analytics.normalizeResult('be'), 'Breakeven');

  assert.equal(analytics.normalizeResult('open'), null);
  assert.equal(analytics.normalizeResult('PENDING'), null);
  assert.equal(analytics.normalizeResult(''), null);
  assert.equal(analytics.normalizeResult(null), null);
  assert.equal(analytics.normalizeResult(undefined), null);
});

test('analyze aggregates imported entries with lowercase/uppercase result fields', () => {
  const analytics = createAnalyticsContext();
  const entries = [
    { result: 'win', riskReward: 2.5, setupType: 'TurtleSoup', session: 'London' },
    { result: 'LOSS', riskReward: 1.0, setupType: 'TurtleSoup', session: 'London' },
    { result: 'be', riskReward: 0, setupType: 'Judas', session: 'NewYork' },
    { result: 'Win', riskReward: 3.0, setupType: 'Judas', session: 'NewYork' },
    { result: 'OPEN', riskReward: 2.0, setupType: 'Judas', session: 'NewYork' } // Unclosed trade
  ];

  const report = analytics.analyze(entries);
  assert.equal(report.total, 5);
  assert.equal(report.closed, 4);
  assert.equal(report.wins, 2);
  assert.equal(report.losses, 1);
  assert.equal(report.winRate, 50); // 2 wins / 4 closed = 50%
  assert.equal(report.bySetup.TurtleSoup.total, 2);
  assert.equal(report.bySetup.TurtleSoup.win, 1);
  assert.equal(report.bySetup.TurtleSoup.loss, 1);
  assert.equal(report.bySession.London.total, 2);
  assert.equal(report.bySession.NewYork.total, 2);
});

test('equity calculates balance curve correctly with case-insensitive results', () => {
  const analytics = createAnalyticsContext();
  const entries = [
    { result: 'WIN', riskReward: 2, createdAt: '2026-10-18T10:00:00Z' },
    { result: 'loss', riskReward: 1, createdAt: '2026-10-18T11:00:00Z' },
    { result: 'BE', riskReward: 0, createdAt: '2026-10-18T12:00:00Z' }
  ];

  const curve = analytics.equity(entries);
  assert.equal(curve.length, 3);
  assert.equal(curve[0].balance, 2);  // +2R
  assert.equal(curve[1].balance, 1);  // +2 - 1 = +1R
  assert.equal(curve[2].balance, 1);  // +1 + 0 = +1R
  assert.equal(curve[0].unit, 'R');
});

test('equity sorts newest-first entries into chronological ascending order (Item 1.33)', () => {
  const analytics = createAnalyticsContext();
  // Provided in reverse/newest-first order (e.g. 14:00, 12:00, 08:00)
  const entries = [
    { result: 'WIN', riskReward: 3, actualEntryTime: '2026-10-18T14:00:00Z' }, // 3rd
    { result: 'LOSS', riskReward: 1, actualEntryTime: '2026-10-18T12:00:00Z' }, // 2nd
    { result: 'WIN', riskReward: 2, actualEntryTime: '2026-10-18T08:00:00Z' }  // 1st
  ];

  const curve = analytics.equity(entries);
  assert.equal(curve.length, 3);
  // Chronological order:
  // 1st (08:00): +2R -> balance: 2
  // 2nd (12:00): -1R -> balance: 1
  // 3rd (14:00): +3R -> balance: 4
  assert.equal(curve[0].balance, 2);
  assert.equal(curve[1].balance, 1);
  assert.equal(curve[2].balance, 4);
});

