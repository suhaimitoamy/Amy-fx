import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');

const readmePath = 'README.md';
const indexPath = 'app/src/main/assets/apps/mapping/index.html';
const fixScriptPath = 'app/src/main/assets/apps/mapping/js/analysis-ui-fixes.js';
const stabilityPath = 'app/src/main/assets/apps/mapping/js/view-stability.js';
const fixCssPath = 'app/src/main/assets/apps/mapping/css/five-issues-fix.css';
const reportPath = 'docs/backtests/AMY_FX_MARKET_OUTLOOK_MAPPING_2022_2025.md';
const dataPath = 'docs/backtests/amy-fx-market-outlook-mapping-2022-2025.json';
const appVersionPath = 'app/src/main/assets/app-version.js';
const updatePath = 'update.json';

const readme = read(readmePath);
const index = read(indexPath);
const fixes = read(fixScriptPath);
const stability = read(stabilityPath);
const css = read(fixCssPath);
const report = read(reportPath);
const backtest = JSON.parse(read(dataPath));
const appVersion = read(appVersionPath);
const update = JSON.parse(read(updatePath));

test('Mapping UI hardening files remain syntactically valid', () => {
  for (const path of [fixScriptPath, stabilityPath]) {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
  }
});

test('README reflects Amy FX 1.5.4 release identity', () => {
  assert.match(readme, /\*\*Versi:\*\* `1\.5\.4`/);
  assert.match(readme, /\*\*Version code:\*\* `45`/);
  assert.equal(readme.includes('**Versi:** `1.4.6`'), false);
  assert.equal(readme.includes('**Version code:** `29`'), false);
});

test('Mapping loads the five-issue UI hardening after existing styles and modules', () => {
  assert.ok(index.includes('css/five-issues-fix.css'));
  assert.ok(index.includes('js/analysis-ui-fixes.js'));
  assert.ok(index.indexOf('css/five-issues-fix.css') > index.indexOf('css/analysis-compact.css'));
  assert.ok(index.indexOf('js/analysis-ui-fixes.js') > index.indexOf('js/mapping-v2.js'));
});

test('dashboard duplicate Preview and price cards are removed without changing data services', () => {
  assert.match(fixes, /AMY FX v1\.5 PREVIEW AKTIF/);
  assert.match(fixes, /querySelector\('\.mapping-hero'\)/);
  assert.match(fixes, /\.remove\(\)/);
  assert.equal(fixes.includes('fetch('), false);
  assert.equal(fixes.includes('startBackgroundScanner'), false);
});

test('stale M15 never keeps a LIVE analysis badge', () => {
  assert.match(fixes, /M15 STALE/);
  assert.match(fixes, /M15 LIVE/);
  assert.match(fixes, /result\?\.dataStale/);
  assert.match(fixes, /connection\.includes\('STALE'\)/);
  assert.match(css, /\.regime-badge\.stale/);
});

test('historical reliability is a muted closed disclosure rather than a live signal block', () => {
  assert.match(fixes, /amy-reliability-disclosure/);
  assert.match(fixes, /Definisi fitur berbeda · bukan sinyal live/);
  assert.match(fixes, /bindDisclosure\(details, false\)/);
  assert.match(fixes, /tidak boleh dibaca sebagai akurasi sinyal saat ini/);
  assert.match(css, /opacity:\.76/);
});

test('Analyze view uses stable keyed accordions and anchor-based scroll restoration', () => {
  for (const key of ['market-context', 'market-outlook', 'valid-break', 'mapping-m1-h4', 'mapping-explanation', 'active-setup']) {
    assert.ok(fixes.includes(key));
  }
  assert.match(stability, /anchorKey/);
  assert.match(stability, /getBoundingClientRect/);
  assert.match(stability, /MutationObserver/);
  assert.match(stability, /window\.scrollTo/);
  assert.match(stability, /window\.scrollBy/);
});

test('final issue-5 audit separates tracker success from close-direction accuracy', () => {
  assert.equal(backtest.status, 'FINAL_AUDITED_BACKTEST_FOR_ISSUE_5');
  assert.equal(backtest.marketOutlook.overall.samples, 25223);
  assert.equal(backtest.marketOutlook.overall.trackerDefinedSuccess.accuracy, 42.78);
  assert.equal(backtest.marketOutlook.overall.closeDirectionAccuracy.accuracy, 35.3);
  assert.equal(backtest.marketOutlook.outOfSample2025.closeAccuracy, 37.03);
  assert.match(report, /Akurasi arah murni pada close horizon/);
  assert.match(report, /2025 dipisahkan sebagai out-of-sample/);
  assert.match(fixes, /Skor skenario rule-based/);
  assert.match(fixes, /tracker success/);
  assert.match(fixes, /Akurasi arah close historis/);
  assert.match(fixes, /Skor skenario bukan probabilitas kemenangan/);
});

test('source version is 1.5.4 while publication stays safe during release', () => {
  assert.match(appVersion, /name: '1\.5\.4', code: 45/);
  assert.ok([42, 43, 44, 45].includes(update.latest_version_code));
  const expected = update.latest_version_code === 45
    ? '1.5.4'
    : update.latest_version_code === 44
      ? '1.5.3'
      : update.latest_version_code === 43
        ? '1.5.2'
        : '1.5.1';
  assert.equal(update.latest_version_name, expected);
});
