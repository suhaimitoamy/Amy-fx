import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const readmePath = 'README.md';
const indexPath = 'app/src/main/assets/apps/mapping/index.html';
const fixScriptPath = 'app/src/main/assets/apps/mapping/js/analysis-ui-stability-v4.js';
const fixCssPath = 'app/src/main/assets/apps/mapping/css/five-issues-fix.css';
const reportPath = 'docs/backtests/AMY_FX_MARKET_OUTLOOK_MAPPING_2022_2025.md';
const dataPath = 'docs/backtests/amy-fx-market-outlook-mapping-2022-2025.json';
const appVersionPath = 'app/src/main/assets/app-version.js';
const updatePath = 'update.json';

const readme = read(readmePath);
const index = read(indexPath);
const fixes = read(fixScriptPath);
const css = read(fixCssPath);
const report = read(reportPath);
const backtest = JSON.parse(read(dataPath));
const appVersion = read(appVersionPath);
const update = JSON.parse(read(updatePath));

test('Mapping UI stability runtime remains syntactically valid', () => {
  execFileSync(process.execPath, ['--check', fixScriptPath], { stdio: 'pipe' });
});

test('README documents the public Amy FX identity and keeps Preview separate', () => {
  assert.match(readme, /Amy FX/);
  assert.match(readme, /Versi publik:\*\* `2\.0\.2`/);
  assert.match(readme, /com\.amyelitesuite/);
  assert.match(readme, /main\/update\.json/);
  assert.match(readme, /personal\/amyfx-private/);
  assert.match(readme, /tidak menghapus atau mengubah branch/);
  assert.doesNotMatch(readme, /Application ID:\*\* `com\.amyelitesuite\.learningpreview`/);
});

test('Mapping loads stable UI coordination and no longer loads scroll restoration', () => {
  assert.ok(index.includes('css/five-issues-fix.css'));
  assert.ok(index.includes('js/analysis-ui-stability-v4.js'));
  assert.equal(index.includes('js/analysis-ui-fixes.js'), false);
  assert.equal(index.includes('js/view-stability.js'), false);
  assert.ok(index.indexOf('css/five-issues-fix.css') > index.indexOf('css/analysis-compact.css'));
  assert.ok(index.indexOf('js/analysis-ui-stability-v4.js') > index.indexOf('js/mapping-v2.js'));
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
  assert.match(fixes, /analysisFreshness/);
  assert.match(fixes, /freshness === 'STALE' \|\| freshness === 'EXPIRED'/);
  assert.match(fixes, /status\.includes\('STALE'\)/);
  assert.match(css, /\.regime-badge\.stale/);
});

test('historical reliability is removed from the live Mapping display', () => {
  assert.match(fixes, /removeHistoricalReliability/);
  assert.match(fixes, /RELIABILITAS HISTORIS/);
  assert.match(fixes, /Performa Historis Model/);
  assert.match(fixes, /amy-outlook-backtest-note/);
  assert.match(fixes, /amy-outlook-historical-rate/);
});

test('Analyze view keeps keyed accordions without forced scroll movement', () => {
  for (const key of ['market-context', 'market-outlook', 'valid-break', 'mapping-all-timeframes', 'mapping-explanation', 'active-setup']) {
    assert.ok(fixes.includes(key));
  }
  assert.match(fixes, /MutationObserver/);
  assert.doesNotMatch(fixes, /window\.scrollTo/);
  assert.doesNotMatch(fixes, /window\.scrollBy/);
  assert.doesNotMatch(fixes, /anchorKey/);
});

test('issue-5 audit remains available in documentation but not injected into live UI', () => {
  assert.equal(backtest.status, 'FINAL_AUDITED_BACKTEST_FOR_ISSUE_5');
  assert.equal(backtest.marketOutlook.overall.samples, 25223);
  assert.equal(backtest.marketOutlook.overall.trackerDefinedSuccess.accuracy, 42.78);
  assert.equal(backtest.marketOutlook.overall.closeDirectionAccuracy.accuracy, 35.3);
  assert.equal(backtest.marketOutlook.outOfSample2025.closeAccuracy, 37.03);
  assert.match(report, /Akurasi arah murni pada close horizon/);
  assert.match(report, /2025 dipisahkan sebagai out-of-sample/);
  assert.doesNotMatch(fixes, /tracker success/);
  assert.doesNotMatch(fixes, /Akurasi arah close historis/);
});

test('source version uses public 2.0.2 while metadata stays on last published APK until release', () => {
  assert.match(appVersion, /name: '2\.0\.2', code: 53/);
  assert.match(appVersion, /main\/update\.json/);
  assert.doesNotMatch(appVersion, /Preview|personal\/amyfx-private|preview-update\.json/);
  assert.ok(update.latest_version_code <= 53);
  assert.match(update.latest_version_name, /^(?:1\.\d+\.\d+|2\.0\.[01])$/);
  assert.match(update.apk_url || update.downloadUrl || '', /AmyFX-latest\.apk/);
  assert.doesNotMatch(update.apk_url || update.downloadUrl || '', /AmyFX-Preview-latest\.apk/);
});
