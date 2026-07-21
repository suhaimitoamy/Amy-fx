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
  /Market Regime • Strategy Router • Market Shift/
];

test('user-facing Preview copy does not expose internal audit wording', () => {
  const visibleSources = `${ui}\n${html}`;
  for (const pattern of forbiddenVisibleCopy) {
    assert.doesNotMatch(visibleSources, pattern);
  }
});

test('Preview uses a consistent product-facing navigation and header', () => {
  assert.match(html, /Market Intelligence/);
  assert.match(html, /Struktur • Arah • Likuiditas/);
  assert.match(html, />Analisis</);
  assert.match(html, />Skenario</);
  assert.match(html, />Riwayat</);
  assert.match(html, />Pengaturan</);
});

test('long historical and advanced sections are collapsed by default', () => {
  assert.match(ui, /<details class="professional-disclosure">/);
  assert.doesNotMatch(ui, /<details class="professional-disclosure" open>/);
  assert.match(ui, /Performa Historis Model/);
  assert.match(ui, /Konteks Market Lanjutan/);
  assert.match(ui, /Target & Skenario Harga/);
});
