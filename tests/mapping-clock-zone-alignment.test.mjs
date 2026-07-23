import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const zonesUrl = new URL('../app/src/main/assets/apps/mapping/js/zones/indicator-zones.js', import.meta.url);
const zoneUiUrl = new URL('../app/src/main/assets/apps/mapping/js/mapping-zone-sync.js', import.meta.url);
const clockUrl = new URL('../app/src/main/assets/apps/mapping/js/clock-sync.js', import.meta.url);
const indexUrl = new URL('../app/src/main/assets/apps/mapping/index.html', import.meta.url);

const source = readFileSync(zonesUrl, 'utf8');
const zones = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function assertSyntax(url) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(url)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function candle(open, high, low, close, index) {
  return { open, high, low, close, time: 1_700_000_000 + index * 900 };
}

test('new mapping modules are syntactically valid and loaded by the page', () => {
  assertSyntax(zonesUrl);
  assertSyntax(zoneUiUrl);
  assertSyntax(clockUrl);
  const html = readFileSync(indexUrl, 'utf8');
  assert.match(html, /css\/mapping-zones\.css/);
  assert.match(html, /js\/mapping-zone-sync\.js/);
  assert.match(html, /js\/clock-sync\.js/);
});

test('WIB clock paints dashboard and session from one timestamp without observer loop', () => {
  const clock = readFileSync(clockUrl, 'utf8');
  assert.match(clock, /const time = wibClockText\(timestamp\)/);
  assert.match(clock, /setText\(top, `\$\{connection\} • WIB \$\{time\}`\)/);
  assert.match(clock, /setText\(document\.getElementById\('kz-wib'\), `WIB \$\{time\}`\)/);
  assert.match(clock, /element\.textContent !== text/);
  assert.doesNotMatch(clock, /wibClockText\(Date\.now\(\)\).*wibClockText\(Date\.now\(\)\)/s);
});

test('Pine-aligned FVG remains visible while price has not retested it', () => {
  const candles = [
    candle(100, 101, 99, 100.5, 0),
    candle(100.5, 101.2, 100, 101, 1),
    candle(101, 101.5, 100.5, 101.2, 2),
    candle(101.2, 101.8, 100.9, 101.5, 3),
    candle(101.5, 102, 101, 101.7, 4),
    candle(101.7, 106.2, 101.5, 105.7, 5),
    candle(106, 107, 105, 106.5, 6),
    candle(106.5, 107.2, 106, 106.8, 7)
  ];
  const result = zones.detectIndicatorFvgs(candles, { bodyLength: 5, wickBodyRatio: 0.36 });
  const bullish = result.find(item => item.type === 'BULLISH');
  assert.ok(bullish, 'bullish FVG should be detected');
  assert.equal(bullish.bottom, 102);
  assert.equal(bullish.top, 105);
  assert.equal(bullish.active, true);
  assert.equal(zones.zoneLiveStatus(bullish, 108), 'BELUM RETEST · DI BAWAH HARGA');
});

test('Order Block display adapter uses validated body zone and keeps it available above price', () => {
  const validatedOrderBlocks = [{
    id: 'OB:BEARISH:4:104.00000:105.00000',
    kind: 'ORDER_BLOCK',
    direction: 'BEARISH',
    type: 'BEARISH',
    bottom: 104,
    top: 105,
    mid: 104.5,
    originIndex: 4,
    availableIndex: 7,
    structureBreakIndex: 7,
    status: 'DETECTED',
    active: true
  }];
  const result = zones.detectIndicatorOrderBlocks([], {
    validatedOrderBlocks,
    visiblePerDirection: 1
  });
  const bearish = result.find(item => item.type === 'BEARISH');
  assert.ok(bearish, 'validated bearish OB should be displayed');
  assert.equal(bearish.bottom, 104);
  assert.equal(bearish.top, 105);
  assert.equal(bearish.active, true);
  assert.equal(zones.zoneLiveStatus(bearish, 90), 'BELUM RETEST · DI ATAS HARGA');
});

test('zone UI uses nearest active zones instead of requiring live price inside zone', () => {
  const ui = readFileSync(zoneUiUrl, 'utf8');
  assert.match(ui, /nearestOrderBlocks/);
  assert.match(ui, /nearestFairValueGaps/);
  assert.match(ui, /Belum ada zona yang lolos filter konfirmasi Amy Concept Engine/);
  assert.match(ui, /AMY_CONCEPT_ENGINE_V2/);
  assert.doesNotMatch(ui, /price\s*>=\s*[^\n]+bottom\s*&&\s*price\s*<=\s*[^\n]+top/);
});
