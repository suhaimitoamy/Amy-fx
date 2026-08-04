import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const runtimePath = 'app/src/main/assets/apps/shared/amyfx-mentor-universal-access-v1.js';
const providerPath = 'app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js';

test('universal Mentor runtime is valid JavaScript and loaded after the conversation runtime', async () => {
  await execFileAsync(process.execPath, ['--check', path.join(root, runtimePath)]);
  await execFileAsync(process.execPath, ['--check', path.join(root, providerPath)]);
  const provider = await read(providerPath);
  assert.match(provider, /amyfx-mentor-conversation-v1\.js/);
  assert.match(provider, /amyfx-mentor-universal-access-v1\.js/);
  assert.match(provider, /loadScriptOnce\("amyfx-mentor-conversation-v1\.js"[\s\S]*loadCustomerServiceRuntime/);
  assert.match(provider, /function loadCustomerServiceRuntime\(\) \{ loadUniversalAccessRuntime\(\); \}/);
  assert.match(provider, /loadScriptOnce\("amyfx-mentor-universal-access-v1\.js"[\s\S]*loadSafeRuleChatRuntime/);
  assert.match(provider, /data-amyfx-mentor-universal/);
});

test('Amy Mentor can retrieve every Amy FX workspace domain', async () => {
  const runtime = await read(runtimePath);
  for (const module of ['home', 'mapping', 'intel', 'journal', 'academy', 'indicators']) {
    assert.match(runtime, new RegExp(`id: ["']${module}["']`), `missing ${module} module`);
  }
  assert.match(runtime, /tradingLibraryManager\.files/);
  assert.match(runtime, /items\.v2/);
  assert.match(runtime, /journals\.v2/);
  assert.match(runtime, /tradingLibraryManager\.notes\.v1/);
  assert.match(runtime, /amy_mapping_analyses/);
  assert.match(runtime, /amy_mapping_setups/);
  assert.match(runtime, /amy_mapping_lifecycle_v4/);
  assert.match(runtime, /amyfx\.market\.intel\.v1/);
  assert.match(runtime, /apps\/academy\/index\.html/);
  assert.match(runtime, /apps\/indikator\/manifest\.json/);
  assert.match(runtime, /update\.json/);
  assert.match(runtime, /amyfx_os_v1/);
  assert.match(runtime, /mentor_history/);
});

test('universal context is query-aware, bounded and blocks raw credentials', async () => {
  const runtime = await read(runtimePath);
  assert.match(runtime, /query_aware_full_catalog/);
  assert.match(runtime, /MAX_CONTEXT_CHARS\s*=\s*90_000/);
  assert.match(runtime, /SECRET_FIELD/);
  assert.match(runtime, /SECRET_STORAGE/);
  assert.match(runtime, /secrets:\s*["']blocked["']/);
  assert.match(runtime, /masked_tail/);
  assert.doesNotMatch(runtime, /apiKey\s*:\s*localStorage|getItem\([^)]*api.?key/i);
  assert.doesNotMatch(runtime, /listSecrets\?\.\(\).*secret\s*:/s);
});

test('universal context enriches the existing Context Envelope instead of bypassing safety rules', async () => {
  const runtime = await read(runtimePath);
  assert.match(runtime, /privacy_scope:\s*["']all_modules_read_only_no_secrets["']/);
  assert.match(runtime, /access_scope:\s*["']all_amy_fx_modules["']/);
  assert.match(runtime, /payload:\s*\{\s*\.\.\.\(base\.payload \|\| \{\}\), workspace \}/);
  assert.match(runtime, /const originalAsk = os\.ask\.bind\(os\)/);
  assert.match(runtime, /const originalBuild = os\.buildContext\.bind\(os\)/);
  assert.match(runtime, /__amyUniversalAccessV1/);
});

test('Mentor UI always sends through universal access without duplicate legacy submission', async () => {
  const runtime = await read(runtimePath);
  assert.match(runtime, /\[data-amy-send\]/);
  assert.match(runtime, /\[data-amy-input\]/);
  assert.match(runtime, /\[data-starter\]/);
  assert.match(runtime, /stopImmediatePropagation\(\)/);
  assert.match(runtime, /document\.addEventListener\("click"[\s\S]*true\)/);
  assert.match(runtime, /document\.addEventListener\("keydown"[\s\S]*true\)/);
  assert.match(runtime, /Tanya seluruh data Amy FX/);
  assert.match(runtime, /SEMUA MODUL/);
  assert.match(runtime, /Amy sedang membaca seluruh data Amy FX/);
});

test('workspace access includes full catalogs but only query-relevant heavy content', async () => {
  const runtime = await read(runtimePath);
  assert.match(runtime, /catalog:\s*itemCatalog\(items\)/);
  assert.match(runtime, /relevant:\s*relevantItems/);
  assert.match(runtime, /relevant_lessons:\s*relevantLessons/);
  assert.match(runtime, /shouldLoadCode\s*=\s*CODE_QUERY\.test\(question\)/);
  assert.match(runtime, /source:\s*clip\(source,\s*18_000\)/);
  assert.match(runtime, /recent_analyses/);
  assert.match(runtime, /active_and_recent_setups/);
});
