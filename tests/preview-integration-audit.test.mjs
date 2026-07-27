import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const exists = async relative => {
  try { await access(path.join(root, relative), constants.F_OK); return true; } catch { return false; }
};

async function walk(relative) {
  const base = path.join(root, relative);
  const entries = await readdir(base, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) output.push(...await walk(child));
    else output.push(child.split(path.sep).join('/'));
  }
  return output;
}

const modules = [
  'app/src/main/assets/index.html',
  'app/src/main/assets/apps/mapping/index.html',
  'app/src/main/assets/apps/market-intel/index.html',
  'app/src/main/assets/apps/journal/index.html',
  'app/src/main/assets/apps/academy/index.html'
];
const canonicalMarketModules = new Set([
  'app/src/main/assets/apps/mapping/index.html',
  'app/src/main/assets/apps/market-intel/index.html'
]);

function localReferences(html) {
  const refs = [];
  const pattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const value = match[1].trim();
    if (!value || /^(?:https?:|data:|javascript:|mailto:|tel:|#)/i.test(value)) continue;
    refs.push(value.split(/[?#]/, 1)[0]);
  }
  return refs;
}

function count(source, token) {
  return source.split(token).length - 1;
}

test('all Preview module documents are standards-mode and their local assets exist', async () => {
  const failures = [];
  for (const file of modules) {
    const html = await read(file);
    const first = html.replace(/^\uFEFF/, '').trimStart();
    if (!/^<!doctype html>/i.test(first)) failures.push(`${file}: <!doctype html> is not first`);
    const headClose = html.search(/<\/head\s*>/i);
    const bodyOpen = html.search(/<body\b/i);
    if (headClose < 0 || bodyOpen < 0 || headClose > bodyOpen) failures.push(`${file}: invalid head/body boundary`);

    const base = path.posix.dirname(file);
    for (const ref of localReferences(html)) {
      const resolved = path.posix.normalize(path.posix.join(base, ref));
      if (!await exists(resolved)) failures.push(`${file}: missing local reference ${ref} -> ${resolved}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('Blueprint runtime is installed exactly once with canonical guard order on market modules', async () => {
  for (const file of modules) {
    const html = await read(file);
    assert.equal(count(html, 'data-amyfx-blueprint-css="v1"'), 1, `${file}: blueprint CSS count`);
    assert.equal(count(html, 'data-amyfx-blueprint-js="v1"'), 1, `${file}: blueprint JS count`);
    assert.equal(count(html, 'data-amyfx-blueprint-hotfix="v1"'), 1, `${file}: hotfix count`);
    assert.equal(count(html, 'data-amyfx-provider-detection="v1"'), 1, `${file}: provider runtime count`);

    const blueprintIndex = html.indexOf('data-amyfx-blueprint-js="v1"');
    const hotfixIndex = html.indexOf('data-amyfx-blueprint-hotfix="v1"');
    const providerIndex = html.indexOf('data-amyfx-provider-detection="v1"');
    if (canonicalMarketModules.has(file)) {
      assert.equal(count(html, 'data-amyfx-market-contract="v2"'), 1, `${file}: canonical market contract count`);
      const contractIndex = html.indexOf('data-amyfx-market-contract="v2"');
      assert.ok(contractIndex < hotfixIndex, `${file}: canonical market contract must load before guard`);
      assert.ok(hotfixIndex < blueprintIndex, `${file}: listener guard must load before Blueprint`);
    } else {
      assert.ok(blueprintIndex < hotfixIndex, `${file}: Blueprint must load before compatibility hotfix`);
    }
    assert.ok(Math.max(blueprintIndex, hotfixIndex) < providerIndex, `${file}: provider runtime must load last`);
  }
});

test('home project routing points only to real local modules', async () => {
  const app = await read('app/src/main/assets/app.js');
  const targets = [...app.matchAll(/target:\s*['"]([^'"]+)['"]/g)].map(match => match[1]).filter(value => value !== 'internal');
  assert.ok(targets.length >= 4, 'expected project routes');
  for (const target of targets) assert.equal(await exists(`app/src/main/assets/${target}`), true, `missing project route ${target}`);
});

test('Journal navigation, storage and Blueprint context share one authoritative state', async () => {
  const html = await read('app/src/main/assets/apps/journal/index.html');
  const app = await read('app/src/main/assets/apps/journal/app.js');
  const blueprint = await read('app/src/main/assets/apps/shared/amyfx-blueprint-v1.js');

  const views = [...html.matchAll(/data-view="([^"]+)"/g)].map(match => match[1]);
  for (const view of views) assert.match(html, new RegExp(`id=["']${view}View["']`), `missing view for ${view}`);

  assert.match(app, /window\.AmyFXJournalState\s*=/, 'journal app must publish its loaded IndexedDB-backed state');
  assert.match(app, /amyfx:journal-state-change/, 'journal app must notify context consumers after mutations');
  assert.match(blueprint, /AmyFXJournalState/, 'Blueprint must consume the authoritative journal bridge');
  assert.doesNotMatch(blueprint, /window\.state\?\.journals/, 'Blueprint must not depend on another module global named state');
});

test('home profile reads actual Mapping and IndexedDB Journal counts', async () => {
  const home = await read('app/src/main/assets/index.html');
  const integration = await read('app/src/main/assets/apps/shared/amyfx-home-data-integration-v1.js');
  assert.match(home, /amyfx-home-data-integration-v1\.js/);
  assert.match(integration, /tradingLibraryManager\.files/);
  assert.match(integration, /journals\.v2/);
  assert.match(integration, /amy_mapping_analyses/);
  assert.match(integration, /Catatan Jurnal/);
  assert.match(integration, /Analisis Mapping/);
});

test('Mapping publishes a live context contract consumed by Amy Mentor', async () => {
  const mappingFiles = (await walk('app/src/main/assets/apps/mapping/js')).filter(file => file.endsWith('.js'));
  const mappingSource = (await Promise.all(mappingFiles.map(read))).join('\n');
  const blueprint = await read('app/src/main/assets/apps/shared/amyfx-blueprint-v1.js');
  const bridge = await read('app/src/main/assets/apps/mapping/js/blueprint-context-bridge.js');
  assert.match(mappingSource, /window\.(?:AmyFXMarketState|lastMappingResult)\s*=/, 'Mapping must publish result, timeframe and capture time');
  assert.match(mappingSource, /amyfx:mapping-state-change/);
  assert.match(bridge, /quoteCapturedAt/);
  assert.match(bridge, /mappingCapturedAt/);
  assert.match(bridge, /liquidityCapturedAt/);
  assert.match(bridge, /heatmapCapturedAt/);
  assert.match(blueprint, /AmyFXMarketState|lastMappingResult/, 'Blueprint must consume Mapping contract');
});

test('Market Intel publishes news, liquidity and heatmap through canonical WITA contracts', async () => {
  const intelFiles = (await walk('app/src/main/assets/apps/market-intel')).filter(file => file.endsWith('.js'));
  const shared = await read('app/src/main/assets/apps/shared/market-intelligence.js');
  const contract = await read('app/src/main/assets/apps/shared/amyfx-market-state-contract-v1.js');
  const source = (await Promise.all(intelFiles.map(read))).join('\n') + '\n' + shared + '\n' + contract;
  assert.match(source, /window\.AmyFXIntel/);
  assert.match(source, /window\.AmyFXIntelState/);
  assert.match(source, /window\.AmyFXHeatmapState/);
  assert.match(source, /AmyFXIntel\?\.write\('news'/);
  assert.match(source, /AmyFXIntel\?\.write\('liquidity'/);
  assert.match(source, /AmyFXIntel\?\.write\('heatmap'/);
  assert.match(source, /sourceCandleTime/);
  assert.match(source, /Asia\/Makassar/);
  assert.doesNotMatch(source, /Asia\/Jakarta/);
  assert.doesNotMatch(source, /\bWIB\b/);
});

test('AI secure vault, provider repair and concise conversation runtime are connected end-to-end', async () => {
  const activity = await read('app/src/main/java/com/amyelitesuite/MainActivity.kt');
  const bridge = await read('app/src/main/java/com/amyelitesuite/AmyFxAiBridge.kt');
  const repair = await read('app/src/main/java/com/amyelitesuite/AmyFxAiProviderRepairBridge.kt');
  const provider = await read('app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js');
  const mentor = await read('app/src/main/assets/apps/shared/amyfx-mentor-conversation-v1.js');

  assert.match(activity, /AmyFxAiBridge\(this, webView\).*"AmyNativeAI"/s);
  assert.match(activity, /AmyFxAiProviderRepairBridge\(this\).*"AmyNativeAIRepair"/s);
  assert.match(bridge, /storeSecret/);
  assert.match(bridge, /listSecrets/);
  assert.match(bridge, /send\(/);
  assert.match(repair, /repairProviders/);
  assert.match(provider, /amyfx-mentor-conversation-v1\.js/);
  assert.match(provider, /\^AIza/);
  assert.match(provider, /\^sk-or-v1-/);
  assert.match(provider, /\^sk-/);
  assert.match(mentor, /Amy sedang berpikir/);
  assert.match(mentor, /finally\s*\{\s*removeThinkingIndicator/);
});

test('only one Preview release workflow owns the active branch and update channel', async () => {
  const workflowFiles = (await walk('.github/workflows')).filter(file => /\.ya?ml$/i.test(file));
  const owners = [];
  for (const file of workflowFiles) {
    const source = await read(file);
    if (/push:[\s\S]{0,220}branches:[\s\S]{0,120}experiment\/heatmap-news-20260722/.test(source)) owners.push(file);
  }
  assert.deepEqual(owners, ['.github/workflows/amyfx-blueprint-preview-release.yml']);

  const workflow = await read(owners[0]);
  assert.match(workflow, /com\.amyelitesuite\.learningpreview/);
  assert.match(workflow, /Amy FX Preview/);
  assert.match(workflow, /amyfxpreview/);
  assert.match(workflow, /preview-update\.json/);
  assert.doesNotMatch(workflow, /branches:\s*\n\s*-\s*main/);
});

test('Preview update manifest is active and points to an immutable Preview APK', async () => {
  const manifest = JSON.parse(await read('preview-update.json'));
  assert.equal(manifest.enabled, true);
  assert.ok(Number(manifest.latest_version_code || manifest.versionCode) > 920011);
  assert.match(String(manifest.latest_version_name || manifest.version), /^2\.0\.0-preview\.\d+$/);
  assert.match(String(manifest.apk_url || manifest.downloadUrl), /releases\/download\/amyfx-blueprint-preview-2\.0\.0-preview\.\d+\/AmyFX-Preview-latest\.apk$/);
});
