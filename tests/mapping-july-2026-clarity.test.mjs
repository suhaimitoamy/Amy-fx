// Release gate for Amy FX Preview Mapping clarity.
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
const asiaRangeUi = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/session/asia-range-ui.js', import.meta.url),
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

test('Asia Range, Asia Liquidity, and Outlook share one DST-aware New York session source', () => {
  assert.match(asiaRange, /SESSION_ZONE = 'America\/New_York'/);
  assert.match(asiaRange, /SESSION_START_HOUR = 18/);
  assert.match(asiaRange, /SESSION_END_HOUR = 2/);
  assert.match(asiaRange, /sourceSeason/);
  assert.match(clarity, /calculateAsiaRange/);
  assert.match(clarity, /setupType !== 'ASIA_ENTRY'/);
  assert.match(clarity, /canonicalAsia/);
  assert.match(asiaRangeUi, /syncClarityAsiaWindow/);
  assert.match(asiaRangeUi, /canonicalAsia\.window = label/);
  assert.match(asiaRangeUi, /Asia Session Context · \$\{label\}/);
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

test('Market Summary explains current scalping authority without historical win-rate claims', () => {
  assert.match(clarity, /SCALPER_AUTHORITY_TFS = Object\.freeze\(\['M15', 'M5', 'M1', 'M30', 'H1'\]\)/);
  assert.match(clarity, /SCALPER_WEIGHTS = Object\.freeze\(\{ M15: 45, M5: 25, M1: 20, M30: 5, H1: 5 \}\)/);
  assert.match(clarity, /M15 menjadi arah utama scalping/);
  assert.match(clarity, /M30\/H1 hanya fallback/);
  assert.match(clarity, /H4\/D1 tidak ikut menentukan arah scalping/);
  assert.doesNotMatch(clarity, /14\.353 snapshot|42,86%|78,79%|win rate/i);
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
