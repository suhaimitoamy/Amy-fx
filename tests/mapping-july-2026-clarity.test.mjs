import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const clarity = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/mapping-clarity-v1.js', import.meta.url),
  'utf8'
);
const mappingV2 = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/mapping-v2.js', import.meta.url),
  'utf8'
);
const asiaRange = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/session/asia-range.js', import.meta.url),
  'utf8'
);
const uiRender = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/ui/ui-render.js', import.meta.url),
  'utf8'
);

test('July 2026 clarity layer is loaded after Mapping runtime', () => {
  assert.match(mappingV2, /mapping-clarity-v1\.js/);
  assert.match(clarity, /AmyFXMappingClarity/);
});

test('Asia Range, Asia Liquidity, and Outlook use one canonical WITA window', () => {
  assert.match(asiaRange, /ASIA_START_HOUR = 6/);
  assert.match(asiaRange, /ASIA_END_HOUR = 14/);
  assert.match(clarity, /06:00–14:00 WITA/);
  assert.match(clarity, /calculateAsiaRange/);
  assert.match(clarity, /setupType !== 'ASIA_ENTRY'/);
  assert.match(clarity, /canonicalAsia/);
});

test('structural invalidation is exposed even when entry is WAIT', () => {
  assert.match(clarity, /protectedLow/);
  assert.match(clarity, /protectedHigh/);
  assert.match(clarity, /Invalidasi Struktur/);
  assert.match(clarity, /close di bawah/);
  assert.match(clarity, /close di atas/);
});

test('all-timeframe Mapping separates structure, forecast, and entry permission', () => {
  assert.match(clarity, /Struktur Saat Ini/);
  assert.match(clarity, /Forecast/);
  assert.match(clarity, /Entry Permission/);
  assert.match(clarity, /WAIT pada Forecast atau Entry Permission tidak menghapus struktur/);
});

test('WAITING_EVENT is explicitly different from neutral structure', () => {
  assert.match(clarity, /Belum ada event khusus/);
  assert.match(clarity, /WAIT berarti belum ada izin entry, bukan market netral/);
  assert.match(clarity, /status = scenarios\.length \? 'ACTIVE' : 'WAITING_EVENT'/);
});

test('Market Summary claims are scoped to July evidence and not sold as win rate', () => {
  assert.match(clarity, /14\.353 snapshot/);
  assert.match(clarity, /42,86% dari 7 event/);
  assert.match(clarity, /78,79% dari 66 event/);
  assert.match(clarity, /bukan win rate/);
});

test('Valid Break keeps INTERNAL, MAJOR, AT RISK, and FAILED meanings', () => {
  assert.match(uiRender, /INTERNAL CHOCH/);
  assert.match(uiRender, /AT RISK/);
  assert.match(uiRender, /BREAK FAILED/);
  assert.match(clarity, /<b>MAJOR:<\/b>/);
  assert.match(clarity, /<b>FAILED:<\/b>/);
});

test('Setup Aktif panel is removed from Analyze without deleting setup engines or history', () => {
  assert.match(clarity, /details\[data-stability-key="active-setup"\]/);
  assert.match(clarity, /startsWith\('Setup Aktif'\)/);
  assert.doesNotMatch(clarity, /state\.setups\s*=\s*\[\]/);
  assert.doesNotMatch(clarity, /delete.*setupExecution/i);
});
