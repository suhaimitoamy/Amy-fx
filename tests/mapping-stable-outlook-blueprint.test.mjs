import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(`${root}/${path}`, 'utf8');
const paths = {
  index: 'app/src/main/assets/apps/mapping/index.html',
  main: 'app/src/main/assets/apps/mapping/js/main.js',
  live: 'app/src/main/assets/apps/mapping/js/live-price-display-only-v1.js',
  outlook: 'app/src/main/assets/apps/mapping/js/market-outlook.js',
  runtime: 'app/src/main/assets/apps/mapping/js/mapping-runtime-repair-v3.js',
  candles: 'app/src/main/assets/apps/mapping/js/candle-refresh-coordinator.js',
  authority: 'app/src/main/assets/apps/mapping/js/scalper-execution-authority.js'
};

for (const [name, path] of Object.entries(paths)) {
  if (name === 'index') continue;
  test(`${name} runtime is syntactically valid`, () => {
    const result = spawnSync(process.execPath, ['--check', `${root}/${path}`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}

test('live price display-only bridge loads before Mapping engine', () => {
  const index = read(paths.index);
  const livePosition = index.indexOf('js/live-price-display-only-v1.js');
  const mainPosition = index.indexOf('js/main.js');
  assert.ok(livePosition >= 0);
  assert.ok(mainPosition > livePosition);
});

test('live WebSocket tick updates only price display and blocks legacy Mapping rebuild', () => {
  const live = read(paths.live);
  const main = read(paths.main);
  assert.match(live, /stopImmediatePropagation\(\)/);
  assert.match(live, /amyfx:live-price-display/);
  assert.match(live, /\.price, \[data-live-price\]/);
  assert.match(live, /__amyFxDisplayLastTickAt/);
  assert.match(main, /effectiveLastWsTickAt/);
  assert.match(main, /__amyFxDisplayLastTickAt/);
});

test('Market Outlook has no stale hard gate or autonomous polling', () => {
  const outlook = read(paths.outlook);
  assert.doesNotMatch(outlook, /DATA USANG|DATA_STALE|isOutlookStale|intervalStale/);
  assert.doesNotMatch(outlook, /setInterval/);
  assert.doesNotMatch(outlook, /visibilitychange/);
  assert.doesNotMatch(outlook, /setTimeout\(\(\) => refresh\(\), 30\)/);
  assert.match(outlook, /sourceSignature/);
  assert.match(outlook, /AmyFXDomStableRender\?\.patch/);
  assert.match(outlook, /Harga live bergerak terpisah/);
  assert.doesNotMatch(outlook, /scrollTo|scrollBy/);
});

test('Market Outlook always translates Mapping into practical fields', () => {
  const outlook = read(paths.outlook);
  for (const label of [
    'Kondisi market',
    'Status sekarang',
    'Fokus',
    'Posisi harga',
    'Area pantauan',
    'Yang ditunggu',
    'Konfirmasi',
    'Invalidasi',
    'Target',
    'Sumber analisis'
  ]) assert.match(outlook, new RegExp(label));
  assert.match(outlook, /Arah perjalanan/);
  assert.match(outlook, /bukan perintah BUY\/SELL/);
});

test('closed-candle coordinator schedules exact boundaries without polling', () => {
  const candles = read(paths.candles);
  assert.doesNotMatch(candles, /setInterval/);
  assert.match(candles, /scheduleNextClosedCandle/);
  assert.match(candles, /nextBoundaryMs/);
  assert.match(candles, /sourceSignature/);
  assert.match(candles, /after !== before/);
  assert.match(candles, /amyfx:candles-updated/);
});

test('Scalper authority computes real Mapping alignment and is event-driven', () => {
  const authority = read(paths.authority);
  assert.match(authority, /function alignmentFor/);
  assert.match(authority, /mappingDirection/);
  assert.match(authority, /alignedWithForecast: alignment\.aligned/);
  assert.match(authority, /MAPPING ALIGNMENT/);
  assert.doesNotMatch(authority, /alignedWithForecast: true/);
  assert.doesNotMatch(authority, /setInterval/);
  assert.doesNotMatch(authority, /visibilitychange/);
  assert.doesNotMatch(authority, /amyfx:market-update/);
});
