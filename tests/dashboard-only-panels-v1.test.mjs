import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('market summary and Causal Entry Watch are gated to Dashboard only', async () => {
  const html = await read('app/src/main/assets/apps/mapping/index.html');
  const gate = await read('app/src/main/assets/apps/mapping/js/dashboard-only-panels-v1.js');

  assert.match(html, /dashboard-only-panels-v1\.js/);
  assert.ok(html.indexOf('dashboard-only-panels-v1.js') < html.indexOf('js/main.js'));
  assert.match(gate, /amy-regime-router-v3/);
  assert.match(gate, /amy-entry-watch-card/);
  assert.match(gate, /currentView\(\) !== 'Dashboard'/);
  assert.match(gate, /blockedInsertions/);
  assert.match(gate, /details\.amy-analysis-section/);
  assert.match(gate, /Ringkasan Market/);
});

test('Dashboard-only gate changes presentation, not Mapping Engine or market requests', async () => {
  const gate = await read('app/src/main/assets/apps/mapping/js/dashboard-only-panels-v1.js');

  assert.doesNotMatch(gate, /fetch\(/);
  assert.doesNotMatch(gate, /Supabase|Vercel|TwelveData/);
  assert.doesNotMatch(gate, /mappingSnapshot\s*=/);
  assert.doesNotMatch(gate, /setupExecution\s*=/);
  assert.doesNotMatch(gate, /candles\s*=/);
});
