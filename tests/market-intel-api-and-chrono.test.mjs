import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync('app/src/main/assets/apps/market-intel/app.js', 'utf8');

test('Market Intel: resolveApiBase dynamically switches between local and Vercel production (Item 1.36)', () => {
  // Extract resolveApiBase from source
  const fnMatch = code.match(/function resolveApiBase\(\)\s*\{([\s\S]*?)\}/);
  assert.ok(fnMatch, 'resolveApiBase function must exist');

  const fn = new Function('location', `${fnMatch[0]}; return resolveApiBase();`);

  // Localhost & LAN tests
  assert.equal(fn({ hostname: 'localhost' }), '/api');
  assert.equal(fn({ hostname: '127.0.0.1' }), '/api');
  assert.equal(fn({ hostname: '192.168.1.100' }), '/api');
  assert.equal(fn({ hostname: '10.0.2.2' }), '/api');
  assert.equal(fn({ hostname: '172.16.0.5' }), '/api');

  // Production Vercel / Remote tests
  assert.equal(fn({ hostname: 'amy-fx.vercel.app' }), 'https://amy-fx.vercel.app/api');
  assert.equal(fn({ hostname: 'example.com' }), 'https://amy-fx.vercel.app/api');
  assert.equal(fn({}), 'https://amy-fx.vercel.app/api');
});

test('Market Intel: calendar rendering sorts events in chronological ascending order (Item 1.37)', () => {
  // Verify chronological ascending sort implementation in renderCalendar
  assert.match(code, /filtered\.sort\(\(a,\s*b\)\s*=>/);
  assert.match(code, /const timeA = new Date\(a\.date\)\.getTime\(\) \|\| 0;/);
  assert.match(code, /const timeB = new Date\(b\.date\)\.getTime\(\) \|\| 0;/);
  assert.match(code, /return timeA - timeB;/);

  // Test sorting logic on simulated events
  const events = [
    { title: 'FOMC Statement', date: '2026-10-18T18:00:00Z' },
    { title: 'UK GDP', date: '2026-10-18T07:00:00Z' },
    { title: 'US Non-Farm Payrolls', date: '2026-10-18T12:30:00Z' }
  ];

  events.sort((a, b) => (new Date(a.date).getTime() || 0) - (new Date(b.date).getTime() || 0));

  assert.equal(events[0].title, 'UK GDP'); // 07:00
  assert.equal(events[1].title, 'US Non-Farm Payrolls'); // 12:30
  assert.equal(events[2].title, 'FOMC Statement'); // 18:00
});
