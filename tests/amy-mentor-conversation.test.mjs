import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('concise mentor runtime is valid JavaScript and loaded by the installed provider runtime', async () => {
  const mentor = await read('app/src/main/assets/apps/shared/amyfx-mentor-conversation-v1.js');
  const provider = await read('app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js');
  assert.doesNotThrow(() => new Function(mentor));
  assert.doesNotThrow(() => new Function(provider));
  assert.match(provider, /amyfx-mentor-conversation-v1\.js/);
  assert.match(provider, /data\.amyfxMentorConversation = "v1"/);
});

test('simple home action question is answered locally without a trading lecture', async () => {
  const mentor = await read('app/src/main/assets/apps/shared/amyfx-mentor-conversation-v1.js');
  assert.match(mentor, /apa yang perlu \(saya\|aku\) kerjakan sekarang/);
  assert.match(mentor, /Data market live belum masuk\./);
  assert.match(mentor, /sebelum statusnya valid, jangan entry/);
  assert.match(mentor, /provider: "amy-local"/);
});

test('provider prompt forbids audit-style headings and internal metadata leakage', async () => {
  const mentor = await read('app/src/main/assets/apps/shared/amyfx-mentor-conversation-v1.js');
  assert.match(mentor, /maksimal 3 kalimat/);
  assert.match(mentor, /bukan seperti laporan audit atau ceramah/);
  assert.match(mentor, /Jangan memakai judul atau label WAIT/);
  assert.match(mentor, /Jangan menyebut Context Envelope, ageMs, schema, policy key, captured_at/);
  assert.match(mentor, /cleanProviderReply/);
});

test('epoch timestamp is replaced with Belum ada data', async () => {
  const mentor = await read('app/src/main/assets/apps/shared/amyfx-mentor-conversation-v1.js');
  assert.match(mentor, /repairEpochUi/);
  assert.match(mentor, /1970-01-01/);
  assert.match(mentor, /node\.textContent = "Belum ada data"/);
});
