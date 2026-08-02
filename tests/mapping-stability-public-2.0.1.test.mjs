import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('unchanged Mapping state skips full root publication', async () => {
  const ui = await read('app/src/main/assets/apps/mapping/js/ui/ui-render.js');
  const dom = await read('app/src/main/assets/apps/mapping/js/ui/dom-stable-render.js');
  assert.match(ui, /export function mappingRenderSignature/);
  assert.match(ui, /signature===lastRenderSignature/);
  assert.match(ui, /nextSignature===lastMarketSnapshotSignature/);
  assert.match(dom, /patchSameViewApp\(this, parseFragment\(markup\)\)/);
  assert.doesNotMatch(dom, /window\.scrollTo|window\.scrollBy/);
});

test('Mapping listeners, timers, and observers install once', async () => {
  const scalper = await read('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');
  const panels = await read('app/src/main/assets/apps/mapping/js/dashboard-only-panels-v1.js');
  const analysis = await read('app/src/main/assets/apps/mapping/js/analysis-ui-stability-v4.js');
  assert.match(scalper, /if\s*\(\s*started\s*\)\s*return/);
  assert.equal((scalper.match(/setInterval\s*\(\s*sync\s*,\s*30_000\s*\)/g) || []).length, 1);
  assert.doesNotMatch(scalper, /MutationObserver/);
  assert.match(panels, /if \(window\.__amyFxDashboardOnlyPanelsV1Installed\) return/);
  assert.match(panels, /if \(started\) return/);
  assert.equal((panels.match(/new MutationObserver/g) || []).length, 1);
  assert.match(analysis, /if \(window\.__amyFxStableAnalysisUiV4Installed\) return/);
});

test('ordinary refresh preserves scroll and disclosure state', async () => {
  const ui = await read('app/src/main/assets/apps/mapping/js/ui/ui-render.js');
  const scalper = await read('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');
  const renderBlock = scalper.slice(scalper.indexOf('function render('), scalper.indexOf('async function sync('));
  assert.doesNotMatch(ui, /scrollIntoView|window\.scrollTo|window\.scrollBy/);
  assert.doesNotMatch(renderBlock, /scrollIntoView|scrollTo|scrollBy/);
  assert.match(ui, /details\[data-stability-key\]/);
  assert.match(ui, /disclosureState\.get\(key\)/);
});

test('Scalper Shadow keeps one persistent shell and last valid payload', async () => {
  const ui = await read('app/src/main/assets/apps/mapping/js/ui/ui-render.js');
  const scalper = await read('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');
  assert.equal((ui.match(/function scalperShadowPlaceholder\(\)/g) || []).length, 1);
  assert.match(ui, /data-dom-persistent="true" data-stability-key="scalper-shadow"/);
  assert.match(scalper, /lastValidPayload\s*=\s*reconcileScalperPayload/);
  assert.match(scalper, /AmyFXDomStableRender\?\.patch[\s\S]*AmyFXDomStableRender\.patch\(existing,\s*next\)/);
  assert.doesNotMatch(scalper, /outerHTML|\.remove\(\)/);
});

test('overlapping Mapping and Scalper requests reject stale work', async () => {
  const market = await read('app/src/main/assets/apps/mapping/js/api/market-data.js');
  const coordinator = await read('app/src/main/assets/apps/mapping/js/api-request-coordinator.js');
  const scalper = await read('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');
  assert.match(market, /analysisController\?\.abort\(\)/);
  assert.match(market, /requestId === analysisSequence/);
  assert.match(coordinator, /active\?\.signal\?\.aborted/);
  assert.match(scalper, /requestController\?\.abort\(\)/);
  assert.match(scalper, /sequence\s*!==\s*requestSequence/);
});

test('Mapping header remains one fixed-size status dot', async () => {
  const html = await read('app/src/main/assets/apps/mapping/index.html');
  const css = await read('app/src/main/assets/apps/mapping/css/style.css');
  const mappingCss = await read('app/src/main/assets/apps/mapping/css/mapping-v2.css');
  const integrity = await read('app/src/main/assets/apps/mapping/js/mapping-integrity.js');
  const ui = await read('app/src/main/assets/apps/mapping/js/ui/ui-render.js');
  const syncFix = await read('app/src/main/assets/apps/mapping/js/bridge/sync-fix.js');
  const clock = await read('app/src/main/assets/apps/mapping/js/clock-sync.js');
  assert.match(html, /id="conn"[^>]*>●<\/div>/);
  assert.match(css, /#conn\{[^}]*width:18px;min-width:18px;max-width:18px;flex:0 0 18px;height:18px;padding:0!important;overflow:hidden;white-space:nowrap/);
  assert.match(mappingCss, /\.status\.on::before\{content:none;display:none\}/);
  for (const source of [integrity, ui]) assert.match(source, /(?:conn|connection)\.textContent\s*=\s*['"]●['"]/);
  assert.match(syncFix, /mappingDot\.textContent='●'/);
  assert.match(clock, /setText\(top, ''\)[\s\S]*top\.style\.display = 'none'/);
});
