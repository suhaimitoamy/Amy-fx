// Legacy Mapping contract retained for the archived Pro336 page.
// Production ICT workspace is covered by ict-workspace.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../app/src/main/assets/apps/mapping/js/market-intent-ui.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../app/src/main/assets/apps/mapping/legacy-index.html', import.meta.url), 'utf8');

const forbiddenVisibleCopy = [
  /REFERENSI KLAIM PINE TERKUNCI/,
  /Threshold Pine terkunci/,
  /tidak dituning ulang/,
  /REGIME EKSPERIMENTAL/,
  /ENTRY MAP EKSPERIMENTAL/,
  /NO AUTO TRADE/,
  /CONTEXT ONLY/,
  /Raw Trend Score/,
  /Raw Stability Score/,
  /untuk audit/,
  /otoritas keputusan/,
  /bukan win rate/,
  /Market Regime • Strategy Router • Market Shift/,
  /Performa Historis Model/,
  /RELIABILITAS HISTORIS/
];

test('user-facing Preview copy does not expose internal audit wording or historical claims', () => {
  const visibleSources = `${ui}\n${html}`;
  for (const pattern of forbiddenVisibleCopy) {
    assert.doesNotMatch(visibleSources, pattern);
  }
});

test('Preview uses the approved three-navigation Mapping header', () => {
  assert.match(html, /Market Intelligence/);
  assert.match(html, /Struktur • Arah • Likuiditas/);
  assert.match(html, />Dashboard</);
  assert.match(html, />Analisis</);
  assert.match(html, />Riwayat</);
  assert.match(html, /href="scalper-stats\.html"/);
  assert.doesNotMatch(html, />Skenario</);
  assert.doesNotMatch(html, />Pengaturan</);
});

test('advanced closed-candle sections remain collapsed by default and avoid automatic entry claims', () => {
  assert.match(ui, /<details class="professional-disclosure">/);
  assert.doesNotMatch(ui, /<details class="professional-disclosure" open>/);
  assert.match(ui, /Context & Fresh Evidence/);
  assert.match(ui, /Predictive \/ Event Signals/);
  assert.match(ui, /CLOSED CANDLE/);
  assert.match(ui, /Diperbarui setelah candle berikutnya ditutup/);
  assert.doesNotMatch(ui, /consumer\/read-only/);
  assert.doesNotMatch(ui, /AUTO ENTRY|ENTRY SEKARANG|PASTI BUY|PASTI SELL/i);
});