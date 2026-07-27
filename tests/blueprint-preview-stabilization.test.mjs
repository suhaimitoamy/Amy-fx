import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const marketPages = [
  'app/src/main/assets/apps/mapping/index.html',
  'app/src/main/assets/apps/market-intel/index.html'
];

const otherModulePages = [
  'app/src/main/assets/index.html',
  'app/src/main/assets/apps/journal/index.html',
  'app/src/main/assets/apps/academy/index.html'
];

test('market pages load the listener guard before Blueprint while other modules retain legacy-safe order', async () => {
  for (const path of marketPages) {
    const html = await read(path);
    const contractIndex = html.indexOf('data-amyfx-market-contract="v2"');
    const hotfixIndex = html.indexOf('data-amyfx-blueprint-hotfix="v1"');
    const blueprintIndex = html.indexOf('data-amyfx-blueprint-js="v1"');
    const providerIndex = html.indexOf('data-amyfx-provider-detection="v1"');
    assert.ok(contractIndex >= 0, `${path} missing canonical market contract`);
    assert.ok(hotfixIndex > contractIndex, `${path} must load stabilization after canonical market contract`);
    assert.ok(blueprintIndex > hotfixIndex, `${path} must load listener guard before Blueprint runtime`);
    assert.ok(providerIndex > blueprintIndex, `${path} must load provider detection after Blueprint runtime`);
  }

  for (const path of otherModulePages) {
    const html = await read(path);
    const blueprintIndex = html.indexOf('data-amyfx-blueprint-js="v1"');
    const hotfixIndex = html.indexOf('data-amyfx-blueprint-hotfix="v1"');
    const providerIndex = html.indexOf('data-amyfx-provider-detection="v1"');
    assert.ok(blueprintIndex >= 0, `${path} missing Blueprint runtime`);
    assert.ok(hotfixIndex > blueprintIndex, `${path} must load stabilization after Blueprint runtime`);
    assert.ok(providerIndex > hotfixIndex, `${path} must load provider detection after stabilization`);
  }
});

test('stabilization fixes assistant recovery, secure-vault compatibility and total timeout', async () => {
  const hotfix = await read('app/src/main/assets/apps/shared/amyfx-blueprint-hotfix-v1.js');
  assert.match(hotfix, /TOTAL_AI_TIMEOUT_MS = 45_000/);
  assert.match(hotfix, /PER_KEY_TIMEOUT_MS = 8_000/);
  assert.match(hotfix, /reconcileVaultReferences/);
  assert.match(hotfix, /patchLegacyJournalAssistant/);
  assert.match(hotfix, /submitMentorSafely/);
  assert.match(hotfix, /finally \{/);
  assert.match(hotfix, /Rotasi native aktif/);
  assert.match(hotfix, /installBlueprintListenerDeduper/);
});

test('journal review belongs to Journal and market freshness comes from canonical source timestamps', async () => {
  const runtime = await read('app/src/main/assets/apps/shared/amyfx-blueprint-v1.js');
  const hotfix = await read('app/src/main/assets/apps/shared/amyfx-blueprint-hotfix-v1.js');
  const contract = await read('app/src/main/assets/apps/shared/amyfx-market-state-contract-v1.js');
  assert.match(runtime, /document\.querySelector\("#journalView, \[data-journal-view\]"\)/);
  assert.match(runtime, /return null;\n  \}\n\n  function visibleText/);
  assert.match(runtime, /capturedAt \? Time\.wita\(capturedAt\) : "Belum ada data"/);
  assert.match(hotfix, /canonicalMarketContext/);
  assert.match(hotfix, /market_freshness/);
  assert.match(hotfix, /relocateJournalReview/);
  assert.match(contract, /capturedAt/);
  assert.match(contract, /storedAt/);
  assert.match(contract, /state = "EXPIRED"/);
  assert.doesNotMatch(contract, /storedAt\s*\|\|\s*capturedAt/);
});

test('academy principal page has valid section boundary and complete final foundation link', async () => {
  const academy = await read('app/src/main/assets/apps/academy/index.html');
  assert.doesNotMatch(academy, /href="[^"]*<section/i);
  assert.match(academy, /href="bagian-15-menjadi-trader-mandiri\/index\.html">Buka Materi →<\/a><\/article><\/section>/);
});

test('release workflow validates stabilization without touching production main', async () => {
  const workflow = await read('.github/workflows/amyfx-blueprint-preview-release.yml');
  assert.match(workflow, /amyfx-blueprint-hotfix-v1\.js/);
  assert.match(workflow, /blueprint-preview-stabilization\.test\.mjs/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.doesNotMatch(workflow, /git push origin (?:HEAD:)?main/);
});
