import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../app/src/main/assets/apps/mapping/js/market-intent-ui.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../app/src/main/assets/apps/mapping/index.html', import.meta.url), 'utf8');

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
  /RELIABILITAS HISTORIS/,
  /Performa Historis Model/
];

test('user-facing production copy does not expose internal audit wording', () => {
  const visibleSources = `${ui}\n${html}`;
  for (const pattern of forbiddenVisibleCopy) {
    assert.doesNotMatch(visibleSources, pattern);
  }
});

test('Amy FX uses the approved simplified Mapping navigation and header', () => {
  assert.match(html, /Market Intelligence/);
  assert.match(html, /Struktur • Arah • Likuiditas/);
  assert.match(html, />Dashboard</);
  assert.match(html, />Analisis</);
  assert.doesNotMatch(html, />Skenario</);
  assert.doesNotMatch(html, />Riwayat</);
  assert.doesNotMatch(html, />Pengaturan</);
  assert.doesNotMatch(html, /Amy FX Preview/);
});

test('advanced Mapping sections remain source-driven without historical reliability injection', () => {
  assert.match(ui, /Konteks Market Lanjutan/);
  assert.match(ui, /Target & Skenario Harga/);
  assert.doesNotMatch(ui, /RELIABILITAS HISTORIS/);
  assert.doesNotMatch(ui, /Performa Historis Model/);
  assert.doesNotMatch(ui, /tracker success/);
});
