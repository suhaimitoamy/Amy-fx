import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');

const customerPath = 'app/src/main/assets/apps/shared/amyfx-mentor-customer-service-v1.js';
const finalUiPath = 'app/src/main/assets/apps/shared/amyfx-mentor-rule-chat-final-v2.js';

test('provider loader installs conversation, rule customer service, universal access, connectivity and final chat UI in order', async () => {
  const source = await read('app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js');
  for (const runtime of [
    'amyfx-mentor-conversation-v1.js',
    'amyfx-mentor-customer-service-v1.js',
    'amyfx-mentor-universal-access-v1.js',
    'amyfx-connectivity-audit-v2.js',
    'amyfx-connectivity-final-v3.js',
    'amyfx-mentor-rule-chat-final-v2.js'
  ]) assert.ok(source.includes(runtime), `missing runtime ${runtime}`);
  assert.match(source, /script\.addEventListener\("load", loadRuleChatFinalRuntime/);
  assert.match(source, /loadFinalConnectivityRuntime, loadRuleChatFinalRuntime/);
});

test('rule chat runtimes are syntactically valid', () => {
  for (const relative of [customerPath, finalUiPath]) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${relative}\n${result.stderr || result.stdout}`);
  }
});

test('customer service remains local-first and escalates only complex intents to AI', async () => {
  const source = await read(customerPath);
  assert.match(source, /target:\s*Object\.freeze\(\{ bot: 90, ai: 10 \}\)/);
  assert.match(source, /provider:\s*"amy-bot"/);
  assert.match(source, /model:\s*"customer-service-rule-chat-v2"/);
  assert.match(source, /function needsAi\(question\)/);
  assert.match(source, /\^\(ai\|pakai ai\|gunakan ai\|tanya ai\)/);
  assert.match(source, /recordRoute\("ai"\)/);
  assert.match(source, /recordRoute\("bot"\)/);
  assert.match(source, /return originalAsk\(stripAiPrefix\(question\)/);
  assert.match(source, /function customerServiceResponse\(question, context\)/);
});

test('rule chat supports natural multi-turn issue clarification without requiring Context Envelope', async () => {
  const source = await read(customerPath);
  assert.match(source, /SESSION_KEY = "amyfx\.mentor\.ruleChat\.v2"/);
  assert.match(source, /awaiting:\s*"issue_area"/);
  assert.match(source, /Masalahnya ada di Mapping, Market Intel, Jurnal, Academy, Amy, atau update aplikasi/);
  assert.match(source, /if \(session\.awaiting === "issue_area" && detectedArea\)/);
  assert.doesNotMatch(source, /if \(!ws\) return null/);
  assert.match(source, /Aku belum menangkap bagian yang kamu maksud/);
});

test('bot covers major Amy FX modules with conversational quick replies', async () => {
  const source = await read(customerPath);
  for (const marker of [
    'Cek kondisi sekarang',
    'Buka Mapping',
    'Cek statistik jurnal',
    'Progres Academy',
    'Status API',
    'Amy FX Preview',
    'Secure vault',
    'Trading Library',
    'Market Intel',
    'Ada fitur yang bermasalah'
  ]) assert.ok(source.toLowerCase().includes(marker.toLowerCase()), `missing ${marker}`);
  assert.match(source, /data-amy-rule-prompt/);
  assert.match(source, /Customer Service Amy FX/);
  assert.match(source, /Tulis pesan ke Amy/);
});

test('final chat UI removes technical provider metadata and overrides connectivity labels', async () => {
  const source = await read(finalUiPath);
  assert.match(source, /Amy Assistant/);
  assert.match(source, /Customer Service Amy FX/);
  assert.match(source, /Amy online • siap membantu/);
  assert.match(source, /amy-bot\|amy-local\|deterministic/);
  assert.match(source, /meta\.remove\(\)/);
  assert.match(source, /Jawaban AI/);
  assert.match(source, /Context Envelope/);
});
