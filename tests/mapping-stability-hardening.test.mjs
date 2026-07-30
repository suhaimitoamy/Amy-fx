import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('unchanged Mapping state skips the root render and market-state publication', async () => {
  const ui = await read('app/src/main/assets/apps/mapping/js/ui/ui-render.js');
  const dom = await read('app/src/main/assets/apps/mapping/js/ui/dom-stable-render.js');

  assert.match(ui, /export function mappingRenderSignature/);
  assert.match(ui, /signature===lastRenderSignature/);
  assert.match(ui, /nextSignature===lastMarketSnapshotSignature/);
  assert.match(ui, /return false/);
  assert.match(dom, /patchSameViewApp\(this, parseFragment\(markup\)\)/);
  assert.doesNotMatch(dom, /window\.scrollTo|window\.scrollBy/);
});

test('Mapping listeners, timers, and observers are installed once and do not call the root renderer', async () => {
  const scalper = await read('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');
  const panels = await read('app/src/main/assets/apps/mapping/js/dashboard-only-panels-v1.js');
  const analysis = await read('app/src/main/assets/apps/mapping/js/analysis-ui-stability-v4.js');

  assert.match(scalper, /if \(started\) return/);
  assert.equal((scalper.match(/setInterval\(sync, 30_000\)/g) || []).length, 1);
  assert.equal((scalper.match(/addEventListener\('hashchange', focusHash\)/g) || []).length, 1);
  assert.doesNotMatch(scalper, /MutationObserver/);

  assert.match(panels, /if \(window\.__amyFxDashboardOnlyPanelsV1Installed\) return/);
  assert.match(panels, /if \(started\) return/);
  assert.equal((panels.match(/new MutationObserver/g) || []).length, 1);
  assert.match(panels, /if \(needsCleanup\(records, app\)\) scheduleCleanup\(\)/);
  assert.doesNotMatch(panels, /\brender\s*\(/);

  assert.match(analysis, /if \(window\.__amyFxStableAnalysisUiV4Installed\) return/);
  assert.equal((analysis.match(/new MutationObserver/g) || []).length, 1);
  assert.doesNotMatch(analysis, /\brender\s*\(/);
});

test('ordinary Mapping refresh does not force scroll and accordion state uses stable keys', async () => {
  const ui = await read('app/src/main/assets/apps/mapping/js/ui/ui-render.js');
  const scalper = await read('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');
  const panels = await read('app/src/main/assets/apps/mapping/js/dashboard-only-panels-v1.js');
  const renderBlock = scalper.slice(scalper.indexOf('function render('), scalper.indexOf('async function sync('));

  assert.doesNotMatch(ui, /scrollIntoView|window\.scrollTo|window\.scrollBy/);
  assert.doesNotMatch(renderBlock, /scrollIntoView|scrollTo|scrollBy/);
  assert.match(scalper, /if \(!hash \|\| hash === lastFocusedHash\) return/);
  assert.match(ui, /details\[data-stability-key\]/);
  assert.match(ui, /new Map\(/);
  assert.match(ui, /disclosureState\.get\(key\)/);
  [
    "{ selector: '.mapping-hero' }",
    "{ selector: '[data-stability-key=\"market-outlook\"]' }",
    "{ id: 'amy-regime-router-v3' }",
    "{ selector: '[data-execution-plan-card=\"detail\"]' }",
    "{ summary: 'Penjelasan Mapping' }",
    "{ selector: '[data-asia-range-analyze]' }",
    "{ summary: 'Valid Break' }",
    "{ summary: 'Mapping Semua Timeframe' }",
    "{ summary: 'Setup Aktif' }",
    "{ id: 'amy-scalper-entry-watch' }"
  ].reduce((lastIndex, token) => {
    const index = panels.indexOf(token, lastIndex + 1);
    assert.ok(index > lastIndex, `Analyze source-order guard missing ${token}`);
    return index;
  }, -1);
});

test('Scalper Shadow has one persistent shell and preserves valid data on refresh failure', async () => {
  const ui = await read('app/src/main/assets/apps/mapping/js/ui/ui-render.js');
  const scalper = await read('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');

  assert.equal((ui.match(/function scalperShadowPlaceholder\(\)/g) || []).length, 1);
  assert.match(ui, /data-dom-persistent="true" data-stability-key="scalper-shadow"/);
  assert.match(ui, /MENUNGGU SETUP/);
  assert.ok(ui.indexOf('${scalperShadowPlaceholder()}') < ui.indexOf('${executionPlan}'));
  assert.match(ui, /analyzeView[\s\S]*\$\{scalperShadowPlaceholder\(\)\}/);

  assert.match(scalper, /document\.getElementById\(CARD_ID\)/);
  assert.match(scalper, /lastValidPayload = reconcileScalperPayload/);
  assert.match(scalper, /render\(lastValidPayload, scalperFreshness\(lastValidPayload, message\), message\)/);
  assert.match(scalper, /AmyFXDomStableRender\?\.patch\?\.\(existing, next\)/);
  assert.doesNotMatch(scalper, /outerHTML|\.remove\(\)/);
});

test('overlapping Mapping and Scalper requests abort stale work', async () => {
  const market = await read('app/src/main/assets/apps/mapping/js/api/market-data.js');
  const coordinator = await read('app/src/main/assets/apps/mapping/js/api-request-coordinator.js');
  const scalper = await read('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');

  assert.match(market, /analysisController\?\.abort\(\)/);
  assert.match(market, /requestId === analysisSequence/);
  assert.match(market, /analysisInFlight\?\.tf === tf/);
  assert.match(coordinator, /active\?\.signal\?\.aborted/);
  assert.match(coordinator, /if \(inFlight\.get\(info\.key\) === entry\) inFlight\.delete\(info\.key\)/);
  assert.match(scalper, /requestController\?\.abort\(\)/);
  assert.match(scalper, /sequence !== requestSequence/);
});

test('Mapping header is one fixed-size dot and legacy header fields stay hidden', async () => {
  const html = await read('app/src/main/assets/apps/mapping/index.html');
  const css = await read('app/src/main/assets/apps/mapping/css/style.css');
  const mappingCss = await read('app/src/main/assets/apps/mapping/css/mapping-v2.css');
  const live = await read('app/src/main/assets/apps/mapping/js/mapping-live-consistency-v1.js');
  const integrity = await read('app/src/main/assets/apps/mapping/js/mapping-integrity.js');
  const ui = await read('app/src/main/assets/apps/mapping/js/ui/ui-render.js');
  const syncFix = await read('app/src/main/assets/apps/mapping/js/bridge/sync-fix.js');
  const clock = await read('app/src/main/assets/apps/mapping/js/clock-sync.js');

  assert.match(html, /id="conn"[^>]*>●<\/div>/);
  assert.match(css, /#conn\{[^}]*width:18px;min-width:18px;max-width:18px;flex:0 0 18px;height:18px;padding:0!important;overflow:hidden;white-space:nowrap/);
  assert.match(css, /#conn::before,#conn::after\{content:none!important;display:none!important\}/);
  assert.match(mappingCss, /\.status\.on::before\{content:none;display:none\}/);

  for (const source of [live, integrity, ui]) {
    assert.match(source, /(?:conn|connection)\.textContent\s*=\s*['"]●['"]/);
  }
  assert.match(syncFix, /mappingDot\.textContent='●'/);
  assert.match(live, /topTime\.textContent = ""[\s\S]*topTime\.style\.display = "none"/);
  assert.match(ui, /tw\.textContent='';tw\.style\.display='none'/);
  assert.match(clock, /setText\(top, ''\)[\s\S]*top\.style\.display = 'none'/);
  assert.doesNotMatch(html, /id="top-wib"|id="top-wita"/);
});

test('Scalper backend persists entry before lifecycle evaluation and uses optimistic state writes', async () => {
  const engine = await read('supabase/functions/scalper-engine/index.ts');
  const signals = await read('supabase/functions/scalper-engine/signals.mjs');
  const lifecycle = await read('supabase/functions/scalper-engine/lifecycle.mjs');
  const api = await read('supabase/functions/scalper-setups/index.ts');

  assert.match(engine, /Entry must be durably locked before any M1 high\/low/);
  assert.match(engine, /updated_at: `eq\.\$\{expected\.updated_at\}`/);
  assert.match(engine, /status: `eq\.\$\{expected\.status\}`/);
  assert.match(engine, /if \(!saved\) continue/);
  assert.match(signals, /stop_basis_label: 'Structural Wick \+ ATR Buffer'/);
  assert.match(signals, /bufferAtr: 0\.20/);
  assert.match(lifecycle, /setup\.quality\.entry_locked !== true/);
  assert.match(lifecycle, /\.filter\(candle => candle\.open_time >= entryOpenTime\)/);
  assert.match(api, /lifecycleSequence/);
  assert.match(api, /sourceCandleTimestamp/);
  assert.match(api, /stopBasis/);
});
