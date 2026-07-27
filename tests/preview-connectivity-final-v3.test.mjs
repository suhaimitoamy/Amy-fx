import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const exists = async relative => { try { await access(path.join(root, relative), constants.F_OK); return true; } catch { return false; } };
const files = {
  final: 'app/src/main/assets/apps/shared/amyfx-connectivity-final-v3.js',
  audit: 'app/src/main/assets/apps/shared/amyfx-connectivity-audit-v2.js',
  provider: 'app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js',
  customer: 'app/src/main/assets/apps/shared/amyfx-mentor-customer-service-v1.js',
  universal: 'app/src/main/assets/apps/shared/amyfx-mentor-universal-access-v1.js',
  safe: 'app/src/main/assets/apps/shared/amyfx-mentor-rule-chat-safe-v3.js',
  intel: 'app/src/main/assets/apps/shared/market-intelligence.js',
  academyAuth: 'app/src/main/assets/apps/academy/assets/js/auth.js',
  academyLesson: 'app/src/main/assets/apps/academy/bagian-15-menjadi-trader-mandiri/dari-belajar-ke-eksekusi.html',
  journal: 'app/src/main/assets/apps/journal/app.js',
  mapping: 'app/src/main/assets/apps/mapping/js/api/market-data.js',
  updater: 'app/src/main/assets/update-checker.js'
};

test('connectivity files exist and parse', async () => {
  for (const file of Object.values(files)) assert.equal(await exists(file), true, `missing ${file}`);
  for (const file of [files.final, files.audit, files.provider, files.customer, files.universal, files.safe, files.intel, files.academyAuth]) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr || result.stdout}`);
  }
});

test('provider loads safe rule chat after universal access and excludes deprecated coordinators', async () => {
  const source = await read(files.provider);
  for (const token of ['amyfx-mentor-conversation-v1.js', 'amyfx-mentor-universal-access-v1.js', 'amyfx-mentor-rule-chat-safe-v3.js']) {
    assert.match(source, new RegExp(token.replaceAll('.', '\\.')));
  }
  assert.match(source, /loadScriptOnce\("amyfx-mentor-conversation-v1\.js"[\s\S]*loadCustomerServiceRuntime/);
  assert.match(source, /function loadCustomerServiceRuntime\(\) \{ loadUniversalAccessRuntime\(\); \}/);
  assert.match(source, /loadScriptOnce\("amyfx-mentor-universal-access-v1\.js"[\s\S]*loadSafeRuleChatRuntime/);
  assert.doesNotMatch(source, /script\.src\s*=\s*runtimeUrl\("amyfx-connectivity-audit-v2\.js"\)/);
  assert.doesNotMatch(source, /script\.src\s*=\s*runtimeUrl\("amyfx-connectivity-final-v3\.js"\)/);
  assert.doesNotMatch(source, /script\.src\s*=\s*runtimeUrl\("amyfx-mentor-customer-service-v1\.js"\)/);
});

test('final coordinator routes exact views across five modules', async () => {
  const source = await read(files.final);
  for (const module of ['home', 'mapping', 'intel', 'journal', 'academy']) assert.match(source, new RegExp(`${module}: \\[`));
  for (const token of ['view: "heatmap"', 'view: "liquidity"', 'view: "statistics"', 'view: "assistant"', 'view: "notes"', 'view: "library"', 'view: "profil"', '"Analyze"', '"Setups"', '"History"']) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, /amyfx\.navigation\.intent\.v3/);
  assert.match(source, /amyfx\.module\.registry\.v3/);
  assert.doesNotMatch(source, /CSS\.escape/);
});

test('nested Academy lessons load Amy shared runtime', async () => {
  const auth = await read(files.academyAuth);
  const lesson = await read(files.academyLesson);
  assert.match(lesson, /assets\/js\/auth\.js/);
  for (const token of ['amyfx-blueprint-v1.css', 'amyfx-blueprint-v1.js', 'amyfx-blueprint-hotfix-v1.js', 'amyfx-provider-detection-v1.js']) assert.match(auth, new RegExp(token.replaceAll('.', '\\.')));
  assert.match(auth, /new URL\('\.\.\/shared\/',academyRoot\)/);
});

test('Market Intel normalizes timestamps and propagates stale state', async () => {
  const source = await read(files.intel);
  for (const token of ['updated', 'capturedAt', 'captured_at', 'analyzedAt', 'storedAt']) assert.match(source, new RegExp(`timestamp\\(part\\?\\.${token}\\)`));
  assert.match(source, /partExplicitlyStale/);
  assert.match(source, /DATA USANG\|EXPIRED\|INVALID/);
  assert.match(source, /syncGlobals/);
  assert.match(source, /window\.addEventListener\('storage'/);
});

test('Home update and cache actions use real services and preserve primary data', async () => {
  const source = await read(files.final);
  const updater = await read(files.updater);
  assert.match(source, /AmyFXUpdate\?\.checkNow/);
  assert.match(updater, /checkNow: options => checkUpdate/);
  assert.match(source, /Jurnal, Library, riwayat Mapping, lisensi, dan API key tidak akan dihapus/);
  assert.doesNotMatch(source, /sessionStorage\.clear/);
  assert.doesNotMatch(source, /removeItem\("tradingLibraryManager/);
  assert.doesNotMatch(source, /removeItem\("amy_mapping_analyses/);
  assert.doesNotMatch(source, /removeItem\("amyfx\.globalAiSettings/);
});

test('Journal and Mapping publish events consumed across modules', async () => {
  const journal = await read(files.journal);
  const mapping = await read(files.mapping);
  const final = await read(files.final);
  assert.match(journal, /window\.AmyFXJournalState\s*=/);
  assert.match(journal, /amyfx:journal-state-change/);
  assert.match(mapping, /intel\.write\('mapping'/);
  assert.match(mapping, /publishMappingSnapshot\(result\)/);
  assert.match(final, /window\.addEventListener\("storage"/);
  assert.match(final, /window\.addEventListener\("amyfx:market-update"/);
});

test('deprecated final router remains internally guarded', async () => {
  const source = await read(files.final);
  assert.match(source, /!os\.__amyConnectivityAuditV2/);
  assert.match(source, /__amyConnectivityFinalV3: true/);
  assert.match(source, /model: "connectivity-final-v3"/);
});
