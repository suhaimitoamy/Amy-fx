import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Preview loads the production execution authority after its detailed Scalper panel', () => {
  const html = read('app/src/main/assets/apps/mapping/index.html');
  const panel = html.indexOf('js/scalper-entry-watch-v1.js');
  const authority = html.indexOf('js/scalper-execution-authority.js');
  const decision = html.indexOf('js/scalper-execution-decision-bridge.js');

  assert.ok(panel >= 0, 'detailed Preview Scalper panel must remain loaded');
  assert.ok(authority > panel, 'execution authority must load after the Preview panel state exists');
  assert.ok(decision > authority, 'execution decision bridge must load after authority');
});

test('Preview keeps its richer multi-setup Scalper detail', () => {
  const source = read('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');
  for (const marker of [
    'displaySelectedSetupId',
    'data-scalper-select-id',
    'Kembali ke setup utama',
    'Alasan driver',
    'TP1 +10',
    'TP2 +20',
    'Setup aktif lainnya',
    'Riwayat setup permanen'
  ]) {
    assert.ok(source.includes(marker), `Preview detail marker missing: ${marker}`);
  }
  assert.doesNotMatch(source, /setInterval|visibilitychange|focusHash|scrollIntoView/);
});

test('Scalper engine registry contains ten current drivers including AMD', () => {
  const source = read('supabase/functions/scalper-engine/drivers.mjs');
  const registry = source.match(/DRIVER_REGISTRY = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || '';
  const ids = [...registry.matchAll(/id:\s*'([^']+)'/g)].map(match => match[1]);

  assert.equal(ids.length, 10);
  assert.ok(ids.includes('AMD'));
  assert.ok(ids.includes('FVG'));
  assert.ok(ids.includes('ORDER_BLOCK'));
  assert.ok(ids.includes('FALSE_BREAKOUT'));
  assert.match(source, /ENGINE_VERSION = 'amyfx-preview-scalper-pattern-v3\.0'/);
});

test('Scalper authority uses only the current primary pattern-v3 setup', () => {
  const source = read('app/src/main/assets/apps/mapping/js/scalper-execution-authority.js');
  assert.ok(source.includes("CURRENT_ENGINE_VERSION = 'amyfx-preview-scalper-pattern-v3.0'"));
  assert.ok(source.includes('payload.primary'));
  assert.ok(source.includes('setup.isLegacy !== true'));
  assert.ok(source.includes('result.setupExecution = authority.setupExecution'));
  assert.ok(source.includes("authority: 'SCALPER_ENGINE_EXECUTION_AUTHORITY'"));
});

test('Academy reading history is available on home and nested lessons', () => {
  const auth = read('app/src/main/assets/apps/academy/assets/js/auth.js');
  const history = read('app/src/main/assets/apps/academy/assets/js/reading-history-v2.js');

  assert.ok(auth.includes("root+'assets/js/reading-history-v2.js'"));
  for (const marker of [
    'amy_academy_last_read_v2',
    'amy_academy_reading_history_v2',
    'amy_academy_reading_positions_v2',
    'Lanjutkan dari posisi terakhir',
    "timeZone: 'Asia/Makassar'"
  ]) {
    assert.ok(history.includes(marker), `Academy history marker missing: ${marker}`);
  }
});
