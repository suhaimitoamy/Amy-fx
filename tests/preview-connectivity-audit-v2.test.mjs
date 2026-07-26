import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const exists = async relative => {
  try { await access(path.join(root, relative), constants.F_OK); return true; } catch { return false; }
};

const connectivityPath = 'app/src/main/assets/apps/shared/amyfx-connectivity-audit-v2.js';
const providerPath = 'app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js';

const modulePages = [
  'app/src/main/assets/index.html',
  'app/src/main/assets/apps/mapping/index.html',
  'app/src/main/assets/apps/market-intel/index.html',
  'app/src/main/assets/apps/journal/index.html',
  'app/src/main/assets/apps/academy/index.html'
];

test('final connectivity runtime exists and is loaded after universal Mentor access', async () => {
  assert.equal(await exists(connectivityPath), true);
  const provider = await read(providerPath);
  assert.match(provider, /amyfx-connectivity-audit-v2\.js/);
  assert.match(provider, /data-amyfx-connectivity-audit/);
  assert.match(provider, /loadUniversalAccessRuntime[\s\S]*loadConnectivityRuntime/);
  assert.match(provider, /script\.addEventListener\("load", loadConnectivityRuntime/);
});

test('all primary modules install the shared provider/bootstrap chain', async () => {
  for (const page of modulePages) {
    const html = await read(page);
    const count = html.split('data-amyfx-provider-detection="v1"').length - 1;
    assert.equal(count, 1, `${page} provider runtime count`);
  }
});

test('bot data adapter matches customer-service contracts for version, providers and secure vault', async () => {
  const source = await read(connectivityPath);
  assert.match(source, /system:\s*\{[\s\S]*app_version:\s*version/);
  assert.match(source, /ai,\s*provider_status:\s*ai/);
  assert.match(source, /secure_vault:\s*\{\s*available:\s*ai\.secure_vault_available/);
  assert.match(source, /key_refs:\s*refs/);
  assert.match(source, /providers:\s*refs/);
  assert.match(source, /masked_tail:\s*clean\(ref\.masked_tail\)\.slice\(-4\)/);
  assert.doesNotMatch(source, /apiKey\s*:/);
  assert.doesNotMatch(source, /secret\s*:\s*ref/);
});

test('IndexedDB reads never create an empty database or overwrite Journal schema', async () => {
  const source = await read(connectivityPath);
  assert.match(source, /indexedDB\.databases/);
  assert.match(source, /request\.onupgradeneeded\s*=\s*\(\)\s*=>\s*\{[\s\S]*abort\(\)/);
  assert.match(source, /tradingLibraryManager\.files/);
  assert.match(source, /journals\.v2/);
  assert.match(source, /items\.v2/);
  assert.match(source, /transaction\(META_STORE,\s*"readonly"\)/);
});

test('market status requires a real price and fresh Mapping, Liquidity or Heatmap storage', async () => {
  const source = await read(connectivityPath);
  assert.match(source, /MARKET_MAX_AGE\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
  assert.match(source, /shared\.mapping,\s*shared\.liquidity,\s*shared\.heatmap/);
  assert.match(source, /ageMs\s*<=\s*MARKET_MAX_AGE\s*&&\s*hasPrice/);
  assert.match(source, /captured_at:\s*fresh\s*\?\s*capturedAt\s*:\s*null/);
  assert.doesNotMatch(source, /shared\.news[^\n]*newestStoredAt/);
});

test('90 percent bot route avoids universal AI context and escalates only explicit complex requests', async () => {
  const source = await read(connectivityPath);
  assert.match(source, /if\s*\(customer\.needsAi\(normalized\)\)\s*\{\s*return originalAsk/);
  assert.match(source, /const workspace = await buildBotWorkspace\(normalized\)/);
  assert.match(source, /provider:\s*"amy-bot"/);
  assert.match(source, /model:\s*"customer-service-connectivity-v2"/);
  assert.match(source, /recordRoute\("bot"\)/);
});

test('customer-service numeric menu and module navigation are connected', async () => {
  const source = await read(connectivityPath);
  for (const prompt of ['status market', 'buka mapping', 'cek statistik jurnal', 'progres academy', 'status api', 'versi aplikasi']) {
    assert.ok(source.includes(prompt), `missing numeric route: ${prompt}`);
  }
  assert.match(source, /apps\/mapping\/index\.html/);
  assert.match(source, /apps\/market-intel\/index\.html/);
  assert.match(source, /apps\/journal\/index\.html/);
  assert.match(source, /apps\/academy\/index\.html/);
});

test('Journal deep links connect Library, Media, Journal, Notes, Assistant and Statistics views', async () => {
  const source = await read(connectivityPath);
  const journal = await read('app/src/main/assets/apps/journal/index.html');
  for (const view of ['library', 'media', 'journal', 'notes', 'assistant', 'statistics']) {
    assert.match(source, new RegExp(`"${view}"`));
    assert.match(journal, new RegExp(`data-view="${view}"`));
    assert.match(journal, new RegExp(`id="${view}View"`));
  }
  assert.match(source, /window\.addEventListener\("hashchange", applyJournalDeepLink\)/);
  assert.match(source, /button\.click\(\)/);
});

test('bot workspace supports nested Journal v2 outcomes and accurate completed win rate', async () => {
  const source = await read(connectivityPath);
  assert.match(source, /row\.result\s*\|\|\s*row\.outcome\?\.result/);
  assert.match(source, /row\.profit\s*\?\?\s*row\.outcome\?\.profit/);
  assert.match(source, /row\.loss\s*\?\?\s*row\.outcome\?\.loss/);
  assert.match(source, /const completed = win \+ loss \+ be/);
  assert.match(source, /win_rate:\s*completed\s*\?/);
});
