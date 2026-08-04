import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const path = relative => new URL(relative, root);
const source = relative => readFileSync(path(relative), 'utf8');

test('Amy FX 2.3.1 keeps the public Android identity and updater channel', () => {
  const gradle = source('app/build.gradle.kts');
  const version = source('app/src/main/assets/app-version.js');
  const checker = source('app/src/main/assets/update-checker.js');
  const workflow = source('.github/workflows/build-apk.yml');

  assert.match(gradle, /com\.amyelitesuite/);
  assert.match(gradle, /\?: 59\)/);
  assert.match(gradle, /\?: "2\.3\.1"/);
  assert.match(gradle, /main\/update\.json/);
  assert.doesNotMatch(gradle, /learningpreview|Amy FX Preview|amyfxpreview|preview-update\.json/);

  assert.match(version, /name: '2\.3\.1', code: 59/);
  assert.match(version, /main\/update\.json/);
  assert.doesNotMatch(version, /personal\/amyfx-private|preview-update\.json|learningpreview|amyfxpreview/);

  assert.match(checker, /main\/update\.json/);
  assert.doesNotMatch(checker, /Amy FX Preview|personal\/amyfx-private|preview-update\.json/);

  assert.match(workflow, /AMYFX_VERSION_NAME: "2\.3\.1"/);
  assert.match(workflow, /AMYFX_VERSION_CODE: "59"/);
  assert.match(workflow, /latest_version_code=59/);
  assert.match(workflow, /Verify public update manifest/);
  assert.match(workflow, /TWELVEDATA_API_KEY: \$\{\{ secrets\.TWELVEDATA_API_KEY \}\}/);

  assert.equal(existsSync(path('preview-update.json')), false);
  assert.equal(existsSync(path('AmyFX-Preview-latest.apk')), false);
  assert.equal(existsSync(path('app/src/main/assets/apps/market-intel/private-market-api-router.js')), false);
});

test('Mapping presents a clean public interface without visible Preview badges', () => {
  const html = source('app/src/main/assets/apps/mapping/index.html');
  const main = source('app/src/main/assets/apps/mapping/js/main.js');
  const branding = source('app/src/main/assets/apps/mapping/js/production-branding.js');
  const scalper = source('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');

  execFileSync(process.execPath, ['--check', fileURLToPath(path('app/src/main/assets/apps/mapping/js/production-branding.js'))], { stdio: 'pipe' });
  assert.match(html, /<title>Amy FX · Market Intelligence<\/title>/);
  assert.doesNotMatch(html, /Amy FX Preview/);
  assert.match(html, /js\/production-branding\.js/);
  assert.ok(html.indexOf('js/production-branding.js') < html.indexOf('js/main.js'));
  assert.doesNotMatch(main, /mountPreviewUpdateBadge/);
  assert.match(branding, /card\?\.remove\(\)/);
  assert.doesNotMatch(scalper, /aktif dalam simulasi Preview/);
  assert.match(scalper, /aktif dalam simulasi Amy FX/);
});

test('public Mapping keeps persistent candle freshness and quota guards', () => {
  const coordinator = source('app/src/main/assets/apps/mapping/js/api-request-coordinator.js');
  const runtime = source('app/src/main/assets/apps/mapping/js/mapping-runtime-repair-v3.js');

  execFileSync(process.execPath, ['--check', fileURLToPath(path('app/src/main/assets/apps/mapping/js/api-request-coordinator.js'))], { stdio: 'pipe' });
  assert.match(coordinator, /PERSISTENT_CACHE_KEY = 'amyfx_market_response_cache_v3'/);
  assert.match(coordinator, /BACKGROUND_M1_REFRESH_SECONDS = 300/);
  assert.match(coordinator, /SUPABASE_VERIFIED_CURRENT/);
  assert.match(coordinator, /RETRY_COOLDOWN_MS = 60_000/);
  assert.match(runtime, /version: '6\.0\.0'/);
  assert.match(runtime, /markCachedSeriesUsable/);
  assert.match(runtime, /closed-candle-update/);
});

test('public Mapping loads final Pattern v3 Scalper modules', () => {
  const html = source('app/src/main/assets/apps/mapping/index.html');
  const panel = source('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');
  const authority = source('app/src/main/assets/apps/mapping/js/scalper-execution-authority.js');
  const patterns = source('supabase/functions/scalper-engine/pattern-gates.mjs');
  const drivers = source('supabase/functions/scalper-engine/drivers.mjs');

  assert.match(html, /js\/scalper-entry-watch-v1\.js/);
  assert.match(html, /js\/scalper-execution-authority\.js/);
  assert.match(html, /js\/scalper-execution-decision-bridge\.js/);
  assert.match(panel, /SCALPER ENGINE · SHADOW MODE/);
  assert.match(panel, /TP1 \+10/);
  assert.match(panel, /TP2 \+20/);
  assert.match(panel, /data-scalper-select-id/);
  assert.match(panel, /amyfx\.production\.scalper\.permanent-history\.v1/);
  assert.match(authority, /amyfx-preview-scalper-pattern-v3\.0/);
  assert.match(authority, /let applyQueued = false/);
  assert.match(patterns, /BT6-2025-V1/);
  assert.match(patterns, /AMD-2025-V1/);
  assert.match(drivers, /id:\s*'AMD'/);
});
