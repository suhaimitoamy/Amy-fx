import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');

test('provider loader installs conversation, customer service, then universal access', async () => {
  const source = await read('app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js');
  assert.match(source, /amyfx-mentor-conversation-v1\.js/);
  assert.match(source, /amyfx-mentor-customer-service-v1\.js/);
  assert.match(source, /amyfx-mentor-universal-access-v1\.js/);
  assert.match(source, /script\.addEventListener\("load", loadCustomerServiceRuntime/);
  assert.match(source, /script\.addEventListener\("load", loadUniversalAccessRuntime/);
  assert.ok(source.indexOf('amyfx-mentor-customer-service-v1.js') < source.indexOf('function loadMentorConversationRuntime'));
});

test('customer service is local-first and calls AI only for explicit complex intents', async () => {
  const source = await read('app/src/main/assets/apps/shared/amyfx-mentor-customer-service-v1.js');
  assert.match(source, /target:\s*Object\.freeze\(\{ bot: 90, ai: 10 \}\)/);
  assert.match(source, /provider:\s*"amy-bot"/);
  assert.match(source, /model:\s*"customer-service-90-v1"/);
  assert.match(source, /function needsAi\(question\)/);
  assert.match(source, /\^\(ai\|pakai ai\|gunakan ai\|tanya ai\)/);
  assert.match(source, /recordRoute\("ai"\)/);
  assert.match(source, /recordRoute\("bot"\)/);
  assert.match(source, /return originalAsk\(stripAiPrefix\(question\)/);
  assert.match(source, /customerServiceAnswer\(question, context\) \|\| fallbackAnswer\(\)/);
});

test('bot covers customer-service menus and all major Amy FX modules', async () => {
  const source = await read('app/src/main/assets/apps/shared/amyfx-mentor-customer-service-v1.js');
  for (const marker of [
    'Status semua modul',
    'Buka Mapping',
    'Cek statistik jurnal',
    'Progres Academy',
    'Status API',
    'Versi Amy FX Preview',
    'secure vault',
    'Trading Library',
    'Market Intel'
  ]) assert.ok(source.toLowerCase().includes(marker.toLowerCase()), `missing ${marker}`);
  assert.match(source, /Akses customer-service Amy bersifat read-only/);
});

test('customer-service UI clearly exposes bot and AI modes', async () => {
  const source = await read('app/src/main/assets/apps/shared/amyfx-mentor-customer-service-v1.js');
  assert.match(source, /BOT 90% \/ AI 10%/);
  assert.match(source, /Pilih bantuan atau ketik AI: untuk analisis/);
  assert.match(source, /AI: analisis kondisi yang tersedia/);
  assert.match(source, /data-starter/);
});
