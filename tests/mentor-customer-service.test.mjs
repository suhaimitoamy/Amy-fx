import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const safePath = 'app/src/main/assets/apps/shared/amyfx-mentor-rule-chat-safe-v3.js';
const providerPath = 'app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js';

test('provider loader skips freeze-prone mentor observer chain', async () => {
  const source = await read(providerPath);
  assert.match(source, /amyfx-mentor-conversation-v1\.js/);
  assert.match(source, /amyfx-mentor-universal-access-v1\.js/);
  assert.match(source, /amyfx-mentor-rule-chat-safe-v3\.js/);
  assert.doesNotMatch(source, /script\.src\s*=\s*runtimeUrl\("amyfx-mentor-customer-service-v1\.js"\)/);
  assert.doesNotMatch(source, /script\.src\s*=\s*runtimeUrl\("amyfx-connectivity-audit-v2\.js"\)/);
  assert.doesNotMatch(source, /script\.src\s*=\s*runtimeUrl\("amyfx-connectivity-final-v3\.js"\)/);
  assert.doesNotMatch(source, /script\.src\s*=\s*runtimeUrl\("amyfx-mentor-rule-chat-final-v2\.js"\)/);
});

test('safe rule chat runtime is syntactically valid', () => {
  const result = spawnSync(process.execPath, ['--check', path.join(root, safePath)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('safe rule chat has no unbounded DOM observer or recurring UI repaint loop', async () => {
  const source = await read(safePath);
  assert.doesNotMatch(source, /new MutationObserver/);
  assert.doesNotMatch(source, /setInterval\([^]*applyUi[^]*1200/);
  assert.match(source, /attempts >= 120/);
  assert.match(source, /if \(header && header\.innerHTML !== headerHtml\)/);
  assert.match(source, /health\.textContent !== "● Amy online • siap membantu"/);
});

test('safe chat remains local-first and escalates only complex intents', async () => {
  const source = await read(safePath);
  assert.match(source, /provider:\s*"amy-bot"/);
  assert.match(source, /model:\s*"rule-chat-safe-v3"/);
  assert.match(source, /function needsAi\(question\)/);
  assert.match(source, /return originalAsk\(stripAiPrefix\(question\)/);
  assert.match(source, /function localAnswer\(question, context\)/);
});

test('safe chat supports natural issue clarification and major modules', async () => {
  const source = await read(safePath);
  assert.match(source, /awaiting:\s*"issue_area"/);
  assert.match(source, /Masalahnya ada di Mapping, Market Intel, Jurnal, Academy, Amy, atau update aplikasi/);
  for (const marker of [
    'Cek kondisi sekarang',
    'Buka Mapping',
    'Cek statistik jurnal',
    'Progres Academy',
    'Secure vault',
    'Trading Library',
    'Market Intel',
    'Ada fitur yang bermasalah'
  ]) assert.ok(source.toLowerCase().includes(marker.toLowerCase()), `missing ${marker}`);
});

test('safe chat UI keeps Amy visible and hides technical metadata', async () => {
  const source = await read(safePath);
  assert.match(source, /Amy Assistant/);
  assert.match(source, /Customer Service Amy FX/);
  assert.match(source, /Amy online • siap membantu/);
  assert.match(source, /\.amy-os-message--amy small \{ display:none !important; \}/);
  assert.match(source, /if \(panel\.hidden && fab\?\.hidden\) fab\.hidden = false/);
});
