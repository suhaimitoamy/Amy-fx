// Legacy Mapping contract retained for the archived Pro336 page.
// Production ICT workspace is covered by ict-workspace.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Mapping exposes Dashboard, Analisis, and Riwayat as three primary navigations', () => {
  const html = read('app/src/main/assets/apps/mapping/legacy-index.html');
  assert.match(html, /data-tab="Dashboard"/);
  assert.match(html, /data-tab="Analyze"/);
  assert.match(html, /href="scalper-stats\.html"/);
  assert.match(html, />Dashboard<\/span>/);
  assert.match(html, />Analisis<\/span>/);
  assert.match(html, />Riwayat<\/span>/);
});

test('three-item Mapping navigation is locked to one row across legacy shared overrides', () => {
  const css = read('app/src/main/assets/apps/mapping/css/scalper-navigation-separation.css');
  assert.match(css, /body\.amyfx-module--mapping > \.nav/);
  assert.match(css, /display:\s*grid\s*!important/);
  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*!important/);
  assert.match(css, /grid-column:\s*auto\s*!important/);
  assert.match(css, /grid-row:\s*auto\s*!important/);
});

test('Dashboard and Analysis no longer render Scalper Vault statistics or permanent history', () => {
  const css = read('app/src/main/assets/apps/mapping/css/scalper-navigation-separation.css');
  assert.match(css, /#app \.scalper-vault/);
  assert.match(css, /#app \.scalper-watch__recent/);
  assert.match(css, /display:\s*none\s*!important/);
});

test('Dedicated Scalper statistics page reads the same persistent Vault', () => {
  const html = read('app/src/main/assets/apps/mapping/scalper-stats.html');
  const source = read('app/src/main/assets/apps/mapping/js/scalper-stats-page.js');
  for (const marker of ['Dashboard', 'Analisis', 'Riwayat & Statistik', 'Scalper Vault · All Time']) {
    assert.ok(html.includes(marker), `stats page marker missing: ${marker}`);
  }
  for (const marker of [
    "from './scalper-vault.js'",
    'loadScalperVault',
    'mergeScalperHistory',
    'persistScalperVault',
    'scalperVaultStats',
    "history_limit: '2000'",
    'Backup JSON',
    'Pulihkan Backup',
    'Perbarui dari Backend'
  ]) {
    assert.ok(source.includes(marker), `stats page source marker missing: ${marker}`);
  }
});

test('Scalper history reports active-method performance and prioritizes loss count', () => {
  const source = read('app/src/main/assets/apps/mapping/js/scalper-stats-page.js');
  const css = read('app/src/main/assets/apps/mapping/css/scalper-stats.css');
  for (const marker of [
    'function methodPerformance(history)',
    'setup?.driverName',
    'b.losses - a.losses',
    'PERFORMA PER METODE',
    'Metode yang Perlu Dievaluasi',
    'PRIORITAS EVALUASI',
    'Loss rate',
    'R hasil model',
    'function isLegacyIfvg(setup)',
    "model === 'IFVG_SCALPER'",
    'function visibleArchive()',
    'expandedMethod',
    'data-method-card',
    'SEMUA TRADE METODE',
    'Ketuk untuk lihat semua trade',
    'function methodTradeItem(setup, index)'
  ]) {
    assert.ok(source.includes(marker), `per-method stats marker missing: ${marker}`);
  }
  assert.doesNotMatch(source, /\? 'IFVG LEGACY'/);
  assert.match(css, /\.stats-method-card/);
  assert.match(css, /\.stats-method-grid/);
  assert.match(css, /\.stats-method-card\.is-priority/);
  assert.match(css, /\.stats-method-card\.is-open/);
  assert.match(css, /\.stats-method-trades/);
  assert.match(css, /\.stats-method-trade-grid/);
});
