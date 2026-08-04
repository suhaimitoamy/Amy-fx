import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');

const readmePath = 'README.md';
const indexPath = 'app/src/main/assets/apps/mapping/index.html';
const fixScriptPath = 'app/src/main/assets/apps/mapping/js/analysis-ui-stability-v4.js';
const marketIntentPath = 'app/src/main/assets/apps/mapping/js/market-intent-ui.js';
const fixCssPath = 'app/src/main/assets/apps/mapping/css/five-issues-fix.css';
const reportPath = 'docs/backtests/AMY_FX_MARKET_OUTLOOK_MAPPING_2022_2025.md';
const dataPath = 'docs/backtests/amy-fx-market-outlook-mapping-2022-2025.json';
const appVersionPath = 'app/src/main/assets/app-version.js';
const updatePath = 'preview-update.json';

const readme = read(readmePath);
const index = read(indexPath);
const fixes = read(fixScriptPath);
const marketIntent = read(marketIntentPath);
const css = read(fixCssPath);
const report = read(reportPath);
const backtest = JSON.parse(read(dataPath));
const appVersion = read(appVersionPath);
const update = JSON.parse(read(updatePath));

test('Mapping UI stability runtimes remain syntactically valid', () => {
  for (const path of [fixScriptPath, marketIntentPath]) {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
  }
});

test('README retains the private Preview identity and APK route', () => {
  assert.match(readme, /personal\/amyfx-private/);
  assert.match(readme, /Amy FX Preview/);
  assert.match(readme, /com\.amyelitesuite\.learningpreview/);
  assert.match(readme, /AmyFX-Preview-latest\.apk/);
});

test('Mapping loads stable UI coordination and no longer loads scroll restoration', () => {
  assert.ok(index.includes('css/five-issues-fix.css'));
  assert.ok(index.includes('js/analysis-ui-stability-v4.js'));
  assert.equal(index.includes('js/analysis-ui-fixes.js'), false);
  assert.equal(index.includes('js/view-stability.js'), false);
  assert.ok(index.indexOf('css/five-issues-fix.css') > index.indexOf('css/analysis-compact.css'));
  assert.ok(index.indexOf('js/analysis-ui-stability-v4.js') > index.indexOf('js/mapping-v2.js'));
});

test('stability layer coordinates Analyze without deleting dashboard or market cards after render', () => {
  assert.match(fixes, /ensureMarketContextDisclosure/);
  assert.match(fixes, /makeAnalyzeStatic/);
  assert.equal(fixes.includes('fetch('), false);
  assert.equal(fixes.includes('startBackgroundScanner'), false);
  assert.doesNotMatch(fixes, /querySelector\('\.mapping-hero'\)\?\.remove/);
  assert.doesNotMatch(fixes, /removeDashboardDuplicates/);
  assert.doesNotMatch(fixes, /removeHistoricalReliability/);
});

test('analysis badge reports both closed-candle availability and provider delay truthfully', () => {
  assert.match(fixes, /function latestClosedCandle/);
  assert.match(fixes, /CANDLE TERTUTUP/);
  assert.match(fixes, /CACHE · PROVIDER TERTUNDA/);
  assert.match(fixes, /MENUNGGU DATA/);
  assert.match(fixes, /Analisis memakai candle/);
  assert.match(fixes, /freshness\.providerDelayed/);
  assert.match(fixes, /badge\.classList\.toggle\('stale', providerDelayed\)/);
  assert.match(fixes, /entry diblokir sampai provider diperbarui/);
  assert.doesNotMatch(fixes, /M15 STALE/);
  assert.doesNotMatch(fixes, /M15 LIVE/);
  assert.doesNotMatch(fixes, /result\?\.dataStale/);
  assert.match(css, /\.regime-badge\.stale/);
});

test('historical reliability is excluded at the Market Intent source instead of removed after render', () => {
  assert.match(marketIntent, /Konteks Market Lanjutan/);
  assert.match(marketIntent, /Target & Skenario Harga/);
  assert.doesNotMatch(marketIntent, /RELIABILITAS HISTORIS/);
  assert.doesNotMatch(marketIntent, /Performa Historis Model/);
  assert.doesNotMatch(fixes, /amy-outlook-backtest-note/);
  assert.doesNotMatch(fixes, /amy-outlook-historical-rate/);
  assert.doesNotMatch(fixes, /\.remove\(\)/);
});

test('Analyze view keeps keyed accordions without forced scroll movement', () => {
  for (const key of ['market-context', 'market-outlook', 'valid-break', 'mapping-all-timeframes', 'mapping-explanation', 'active-setup']) {
    assert.ok(fixes.includes(key));
  }
  assert.match(fixes, /MutationObserver/);
  assert.match(fixes, /observer\.observe\(app, \{ childList: true, subtree: false \}\)/);
  assert.match(fixes, /observer\?\.disconnect\(\)/);
  assert.match(fixes, /AbortController/);
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
  assert.doesNotMatch(marketIntent, /tracker success/);
  assert.doesNotMatch(marketIntent, /Akurasi arah close historis/);
});

test('source version and updater stay on the private Preview channel', () => {
  const identity = appVersion.match(/name: '(2\.0\.0-preview\.(\d+))', code: (94\d{4})/);
  assert.ok(identity, 'Preview source identity is missing');
  const [, sourceName, sourceSequence, sourceCode] = identity;

  assert.equal(Number(sourceCode), 940000 + Number(sourceSequence));
  assert.match(appVersion, /personal\/amyfx-private\/preview-update\.json/);
  assert.ok(Number(sourceCode) >= Number(update.latest_version_code));
  assert.match(sourceName, /^2\.0\.0-preview\.\d+$/);
  assert.ok(update.latest_version_code >= 940000);
  assert.match(update.latest_version_name, /^2\.0\.0-preview\.\d+$/);
  assert.match(update.apk_url || update.downloadUrl || '', /AmyFX-Preview-latest\.apk/);
});
