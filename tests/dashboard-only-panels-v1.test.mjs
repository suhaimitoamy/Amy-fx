import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('Dashboard and Analyze panel order is kept by presentation runtime', async () => {
  const html = await read('app/src/main/assets/apps/mapping/index.html');
  const gate = await read('app/src/main/assets/apps/mapping/js/dashboard-only-panels-v1.js');

  assert.match(html, /dashboard-only-panels-v1\.js/);
  assert.ok(html.indexOf('dashboard-only-panels-v1.js') < html.indexOf('js/main.js'));

  const dashboardOrder = [
    '.tf-card',
    '.session-card',
    '#amy-regime-router-v3',
    '.setup-focus',
    '#amy-scalper-entry-watch',
    '[data-execution-plan-card="compact"]'
  ];
  dashboardOrder.reduce((lastIndex, token) => {
    const index = gate.indexOf(token, lastIndex + 1);
    assert.ok(index > lastIndex, `Dashboard order missing or incorrect for ${token}`);
    return index;
  }, -1);

  const analyzeOrder = [
    "{ selector: '.mapping-hero' }",
    "{ selector: '[data-stability-key=\"market-outlook\"]' }",
    "{ id: 'amy-regime-router-v3' }",
    "{ selector: '[data-execution-plan-card=\"detail\"]' }",
    "{ summary: 'Penjelasan Mapping' }",
    "{ selector: '[data-asia-range-analyze]' }",
    "{ summary: 'Valid Break' }",
    "{ summary: 'Mapping Semua Timeframe' }",
    "{ summary: 'Setup Aktif' }",
    "{ id: 'amy-scalper-entry-watch' }"
  ];
  analyzeOrder.reduce((lastIndex, token) => {
    const index = gate.indexOf(token, lastIndex + 1);
    assert.ok(index > lastIndex, `Analyze order missing or incorrect for ${token}`);
    return index;
  }, -1);

  assert.match(gate, /reorderAnalyzePanels/);
  assert.match(gate, /currentView\(\) === 'Analyze'/);
  assert.match(gate, /amy-entry-watch-card/);
});

test('panel ordering changes presentation, not Mapping Engine or market requests', async () => {
  const gate = await read('app/src/main/assets/apps/mapping/js/dashboard-only-panels-v1.js');

  assert.doesNotMatch(gate, /fetch\(/);
  assert.doesNotMatch(gate, /Supabase|Vercel|TwelveData/);
  assert.doesNotMatch(gate, /mappingSnapshot\s*=/);
  assert.doesNotMatch(gate, /setupExecution\s*=/);
  assert.doesNotMatch(gate, /candles\s*=/);
});
