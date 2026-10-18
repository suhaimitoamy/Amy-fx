import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  cleanEventTitle,
  parseCachedCalendar,
  filterHighImpactGoldEvents,
  evaluateEconomicRisk,
  formatEventCountdownBanner
} from '../app/src/main/assets/apps/mapping/js/ict-workspace/economic-countdown.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(`${root}/${path}`, 'utf8');

function assertSyntax(path) {
  const result = spawnSync(process.execPath, ['--check', `${root}/${path}`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('economic-countdown.js has valid syntax', () => {
  assertSyntax('app/src/main/assets/apps/mapping/js/ict-workspace/economic-countdown.js');
});

test('cleanEventTitle strips country prefix correctly', () => {
  assert.equal(cleanEventTitle('USD | CPI m/m'), 'CPI m/m');
  assert.equal(cleanEventTitle('USD |Non-Farm Employment Change'), 'Non-Farm Employment Change');
  assert.equal(cleanEventTitle('FOMC Statement'), 'FOMC Statement');
});

test('parseCachedCalendar handles diverse structures and errors safely', () => {
  assert.deepEqual(parseCachedCalendar(null), []);
  assert.deepEqual(parseCachedCalendar('invalid json'), []);
  assert.deepEqual(parseCachedCalendar([]), []);

  const arr = [{ title: 'CPI', impact: 'High' }];
  assert.deepEqual(parseCachedCalendar(JSON.stringify(arr)), arr);

  const wrapped = { savedAt: 1234567, events: arr };
  assert.deepEqual(parseCachedCalendar(JSON.stringify(wrapped)), arr);
  assert.deepEqual(parseCachedCalendar(wrapped), arr);
});

test('filterHighImpactGoldEvents isolates only high impact USD and XAU drivers', () => {
  const events = [
    { title: 'USD | CPI m/m', country: 'USD', impact: 'High', date: '2026-10-18T14:30:00Z' },
    { title: 'EUR | ECB Rate Decision', country: 'EUR', impact: 'High', date: '2026-10-18T14:30:00Z' },
    { title: 'USD | Empire State Index', country: 'USD', impact: 'Medium', date: '2026-10-18T14:30:00Z' },
    { title: 'XAU | Gold Reserve Audit', country: 'XAU', impact: 'High', date: '2026-10-18T15:00:00Z' },
    { title: 'USD | FOMC Rate', country: 'USD', impact: 'HIGH', date: '2026-10-18T18:00:00Z' },
    { title: 'USD | Jobless Claims', country: 'USD', impact: 'Low', date: '2026-10-18T14:30:00Z' },
    { title: 'USD | Invalid Date Event', country: 'USD', impact: 'High', date: 'not-a-date' }
  ];

  const filtered = filterHighImpactGoldEvents(events);
  assert.equal(filtered.length, 3);
  assert.equal(filtered[0].cleanTitle, 'CPI m/m');
  assert.equal(filtered[1].cleanTitle, 'Gold Reserve Audit');
  assert.equal(filtered[2].cleanTitle, 'FOMC Rate');
});

test('evaluateEconomicRisk activates No-Trade Window within ±5 minutes of high-impact release', () => {
  const nowMs = 1792330000000;

  // 1. Tepat pada waktu rilis (diffMs = 0)
  const exactRelease = [{ title: 'CPI m/m', country: 'USD', impact: 'High', date: new Date(nowMs).toISOString() }];
  const riskExact = evaluateEconomicRisk(exactRelease, nowMs);
  assert.equal(riskExact.active, true);
  assert.equal(riskExact.status, 'NO_TRADE_WINDOW');
  assert.equal(riskExact.level, 'critical');
  assert.equal(riskExact.text, '🛑 No-Trade Window — Rilis Berita High-Impact (CPI m/m)');

  // 2. 3 menit sebelum rilis (diffMs = +3m)
  const beforeRelease = [{ title: 'USD | Non-Farm Payrolls', country: 'USD', impact: 'High', date: new Date(nowMs + 3 * 60000).toISOString() }];
  const riskBefore = evaluateEconomicRisk(beforeRelease, nowMs);
  assert.equal(riskBefore.active, true);
  assert.equal(riskBefore.status, 'NO_TRADE_WINDOW');
  assert.equal(riskBefore.text, '🛑 No-Trade Window — Rilis Berita High-Impact (Non-Farm Payrolls)');

  // 3. 4 menit setelah rilis (diffMs = -4m)
  const afterRelease = [{ title: 'FOMC Statement', country: 'USD', impact: 'High', date: new Date(nowMs - 4 * 60000).toISOString() }];
  const riskAfter = evaluateEconomicRisk(afterRelease, nowMs);
  assert.equal(riskAfter.active, true);
  assert.equal(riskAfter.status, 'NO_TRADE_WINDOW');
});

test('evaluateEconomicRisk activates Upcoming Countdown when event is 5 to 30 minutes away', () => {
  const nowMs = 1792330000000;
  // 18 menit ke depan
  const upcomingEvent = [{
    title: 'USD | CPI m/m',
    country: 'US',
    impact: 'High',
    date: new Date(nowMs + 18 * 60000).toISOString()
  }];

  const risk = evaluateEconomicRisk(upcomingEvent, nowMs);
  assert.equal(risk.active, true);
  assert.equal(risk.status, 'UPCOMING_ALERT');
  assert.equal(risk.level, 'warning');
  assert.equal(risk.minutesLeft, 18);
  assert.equal(risk.text, '🔴 US CPI m/m dalam 18 Menit — Spread Berpotensi Melebar');
});

test('evaluateEconomicRisk returns SAFE outside 30 minutes or beyond past 5 minutes', () => {
  const nowMs = 1792330000000;
  const farEvents = [
    // 35 menit ke depan (terlalu jauh untuk banner aktif)
    { title: 'USD | CPI m/m', country: 'USD', impact: 'High', date: new Date(nowMs + 35 * 60000).toISOString() },
    // 10 menit yang lalu (sudah lewat jendela no-trade 5 menit)
    { title: 'USD | PPI m/m', country: 'USD', impact: 'High', date: new Date(nowMs - 10 * 60000).toISOString() }
  ];

  const risk = evaluateEconomicRisk(farEvents, nowMs);
  assert.equal(risk.active, false);
  assert.equal(risk.status, 'SAFE');
  assert.equal(risk.level, 'none');
});

test('formatEventCountdownBanner formats HTML elements and badges accurately', () => {
  const safeBanner = formatEventCountdownBanner({ active: false });
  assert.equal(safeBanner.visible, false);

  const noTradeBanner = formatEventCountdownBanner({
    active: true,
    status: 'NO_TRADE_WINDOW',
    level: 'critical',
    text: '🛑 No-Trade Window — Rilis Berita High-Impact (CPI m/m)'
  });
  assert.equal(noTradeBanner.visible, true);
  assert.equal(noTradeBanner.className, 'economic-event-banner is-no-trade');
  assert.match(noTradeBanner.html, /dot-critical/);
  assert.match(noTradeBanner.html, /NO-TRADE WINDOW/);
  assert.match(noTradeBanner.html, /CPI m\/m/);

  const upcomingBanner = formatEventCountdownBanner({
    active: true,
    status: 'UPCOMING_ALERT',
    level: 'warning',
    minutesLeft: 14,
    text: '🔴 US Retail Sales dalam 14 Menit — Spread Berpotensi Melebar'
  });
  assert.equal(upcomingBanner.visible, true);
  assert.equal(upcomingBanner.className, 'economic-event-banner is-upcoming');
  assert.match(upcomingBanner.html, /dot-warning/);
  assert.match(upcomingBanner.html, /14M LAGI/);
  assert.match(upcomingBanner.html, /Retail Sales/);
});

test('Cockpit Mapping index.html and ict-workspace.css include banner integration', () => {
  const html = read('app/src/main/assets/apps/mapping/index.html');
  const css = read('app/src/main/assets/apps/mapping/css/ict-workspace.css');
  const appJs = read('app/src/main/assets/apps/mapping/js/ict-workspace/app.js');

  assert.match(html, /id="economic-event-banner"/);
  assert.match(css, /\.economic-event-banner/);
  assert.match(css, /\.is-no-trade/);
  assert.match(css, /\.is-upcoming/);
  assert.match(css, /amy-banner-pulse/);
  assert.match(appJs, /mountEconomicEventBanner/);
});
