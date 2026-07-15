import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as zones from '../app/src/main/assets/apps/mapping/js/zones/indicator-zones.js';

const clockUrl = new URL('../app/src/main/assets/apps/mapping/js/ui/wib-clock.js', import.meta.url);
const zoneUiUrl = new URL('../app/src/main/assets/apps/mapping/js/mapping-zone-sync.js', import.meta.url);
const mappingHtmlUrl = new URL('../app/src/main/assets/apps/mapping/index.html', import.meta.url);

const candle = (open, high, low, close, time) => ({ open, high, low, close, time });

function assertSyntax(url) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(url)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('new mapping modules are syntactically valid and loaded by the page', () => {
  assertSyntax(clockUrl);
  assertSyntax(zoneUiUrl);
  const html = readFileSync(mappingHtmlUrl, 'utf8');
  assert.match(html, /js\/ui\/wib-clock\.js/);
  assert.match(html, /js\/mapping-zone-sync\.js/);
});

test('WIB clock paints dashboard and session from one timestamp without observer loop', () => {
  const source = readFileSync(clockUrl, 'utf8');
  assert.match(source, /Asia\/Jakarta/);
  assert.match(source, /setInterval\(paint,\s*1000\)/);
  assert.doesNotMatch(source, /MutationObserver/);
});

test('Pine-aligned FVG remains visible while price has not retested it', () => {
  const candles = [
    candle(100, 101, 99, 100.5, 0),
    candle(100.5, 104, 100.4, 103.8, 1),
    candle(102, 105, 102, 104.5, 2),
    candle(104.5, 106, 103.8, 105.5, 3)
  ];
  const result = zones.detectIndicatorFvgs(candles, {
    bodyLength: 2,
    wickBodyRatio: 0.36,
    visiblePerDirection: 2
  });
  const bullish = result.find(item => item.type === 'BULLISH');
  assert.ok(bullish, 'bullish FVG should be detected');
  assert.equal(bullish.bottom, 101);
  assert.equal(bullish.top, 102);
  assert.equal(bullish.active, true);
  assert.equal(zones.zoneLiveStatus(bullish, 106), 'BELUM RETEST · DI BAWAH HARGA');
});

test('Pine-aligned bearish OB uses candle body and remains available above price', () => {
  const candles = [
    candle(100, 101, 99, 100, 0),
    candle(101, 102, 100, 101, 1),
    candle(103, 104, 102, 103, 2),
    candle(104, 106, 103, 105, 3),
    candle(105, 106, 103, 104, 4),
    candle(104, 105, 101, 102, 5),
    candle(102, 103, 100, 101, 6),
    candle(98, 99, 94, 95, 7),
    candle(92, 93, 88, 89, 8),
    candle(89, 91, 87, 90, 9)
  ];
  const result = zones.detectIndicatorOrderBlocks(candles, {
    swingLength: 3,
    useBody: true,
    visiblePerDirection: 1
  });
  const bearish = result.find(item => item.type === 'BEARISH');
  assert.ok(bearish, 'bearish OB should be detected');
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
