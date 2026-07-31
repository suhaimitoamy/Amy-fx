import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const readme = read('README.md');
const index = read('app/src/main/assets/apps/mapping/index.html');
const fixes = read('app/src/main/assets/apps/mapping/js/analysis-ui-stability-v4.js');
const css = read('app/src/main/assets/apps/mapping/css/five-issues-fix.css');
const report = read('docs/backtests/AMY_FX_MARKET_OUTLOOK_MAPPING_2022_2025.md');
const backtest = JSON.parse(read('docs/backtests/amy-fx-market-outlook-mapping-2022-2025.json'));
const appVersion = read('app/src/main/assets/app-version.js');
const update = JSON.parse(read('update.json'));

test('Mapping UI stability runtime remains syntactically valid', () => {
  execFileSync(process.execPath, ['--check', 'app/src/main/assets/apps/mapping/js/analysis-ui-stability-v4.js'], { stdio: 'pipe' });
});

test('README documents one unified Amy FX production product', () => {
  assert.match(readme, /Amy FX/);
  assert.match(readme, /com\.amyelitesuite/);
  assert.match(readme, /main\/update\.json/);
  assert.match(readme, /`main` merupakan sumber aplikasi dan rilis produksi/);
  assert.match(readme, /personal\/amyfx-private.*riwayat pengembangan privat/s);
  assert.doesNotMatch(readme, /Application ID:\*\* `com\.amyelitesuite\.learningpreview`/);
});

test('Mapping loads stable UI coordination and no obsolete scroll restoration', () => {
  assert.ok(index.includes('css/five-issues-fix.css'));
  assert.ok(index.includes('js/analysis-ui-stability-v4.js'));
  assert.equal(index.includes('js/analysis-ui-fixes.js'), false);
  assert.equal(index.includes('js/view-stability.js'), false);
});

test('dashboard duplicate Preview and price cards remain removed', () => {
  assert.match(fixes, /querySelector\('\.mapping-hero'\)/);
  assert.match(fixes, /\.remove\(\)/);
  assert.equal(fixes.includes('fetch('), false);
  assert.equal(fixes.includes('startBackgroundScanner'), false);
});

test('stale M15 never keeps a LIVE analysis badge', () => {
  assert.match(fixes, /M15 STALE/);
  assert.match(fixes, /result\?\.dataStale/);
  assert.match(fixes, /freshness === 'STALE' \|\| freshness === 'EXPIRED'/);
  assert.match(css, /\.regime-badge\.stale/);
});

test('historical reliability stays out of the live Mapping display', () => {
  assert.match(fixes, /removeHistoricalReliability/);
  assert.match(fixes, /RELIABILITAS HISTORIS/);
  assert.doesNotMatch(fixes, /tracker success/);
});

test('Analyze view keeps keyed accordions without forced scroll movement', () => {
  for (const key of ['market-context', 'market-outlook', 'valid-break', 'mapping-all-timeframes', 'mapping-explanation', 'active-setup']) assert.ok(fixes.includes(key));
  assert.match(fixes, /MutationObserver/);
  assert.doesNotMatch(fixes, /window\.scrollTo|window\.scrollBy|anchorKey/);
});

test('issue-5 audit remains available as documentation only', () => {
  assert.equal(backtest.status, 'FINAL_AUDITED_BACKTEST_FOR_ISSUE_5');
  assert.equal(backtest.marketOutlook.overall.samples, 25223);
  assert.equal(backtest.marketOutlook.overall.trackerDefinedSuccess.accuracy, 42.78);
  assert.match(report, /Akurasi arah murni pada close horizon/);
});

test('source is Amy FX 2.1.1 while published metadata never points above an available APK', () => {
  assert.match(appVersion, /name: '2\.1\.1', code: 55/);
  assert.match(appVersion, /main\/update\.json/);
  assert.doesNotMatch(appVersion, /Preview|personal\/amyfx-private|preview-update\.json/);
  assert.ok(Number(update.latest_version_code) <= 55);
  assert.match(update.apk_url || update.downloadUrl || '', /AmyFX-latest\.apk/);
  assert.doesNotMatch(update.apk_url || update.downloadUrl || '', /AmyFX-Preview-latest\.apk/);
});
