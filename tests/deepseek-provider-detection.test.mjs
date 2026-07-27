import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const modulePages = [
  'app/src/main/assets/index.html',
  'app/src/main/assets/apps/mapping/index.html',
  'app/src/main/assets/apps/market-intel/index.html',
  'app/src/main/assets/apps/journal/index.html',
  'app/src/main/assets/apps/academy/index.html'
];

test('provider detection recognizes Gemini, OpenRouter and DeepSeek key prefixes', async () => {
  const source = await read('app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js');
  assert.match(source, /\^AIza/);
  assert.match(source, /\^sk-or-v1-/);
  assert.match(source, /\^sk-/);
  assert.match(source, /return "deepseek"/);
  assert.match(source, /normalizePool/);
  assert.match(source, /data-amy-provider-select/);
});

test('plain DeepSeek key is normalized before the original save handler runs', async () => {
  const source = await read('app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js');
  assert.match(source, /document\.addEventListener\("click"[\s\S]*\}, true\);/);
  assert.match(source, /normalizeBeforeSave\(\)/);
  assert.match(source, /provider \? `\$\{provider\}:\$\{value\}`/);
});

test('native provider repair never exposes secret values to WebView', async () => {
  const bridge = await read('app/src/main/java/com/amyelitesuite/AmyFxAiProviderRepairBridge.kt');
  assert.match(bridge, /fun repairProviders\(\): String/);
  assert.match(bridge, /SecurePrefs\.getString/);
  assert.match(bridge, /startsWith\("sk-"/);
  assert.match(bridge, /record\.put\("provider", inferred\)/);
  assert.doesNotMatch(bridge, /rows\.put\(secret\)/);
  assert.doesNotMatch(bridge, /return secret/);
});

test('provider repair bridge and detector are installed in every Preview module', async () => {
  const installer = await read('tools/apply-blueprint-preview.py');
  assert.match(installer, /AmyFxAiProviderRepairBridge\(this\)/);
  assert.match(installer, /"AmyNativeAIRepair"/);
  assert.match(installer, /data-amyfx-provider-detection/);
  for (const path of modulePages) {
    const html = await read(path);
    assert.match(html, /data-amyfx-provider-detection="v1"/, `${path} missing provider detector`);
  }
});

test('DeepSeek remains explicit about paid fallback usage', async () => {
  const source = await read('app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js');
  assert.match(source, /DeepSeek (?:sudah )?dikenali, tetapi belum (?:digunakan|dipakai)/);
  assert.match(source, /fallback berbayar/);
  assert.match(source, /paid_fallback/);
  assert.doesNotMatch(source, /paid_fallback:\s*true/);
});
