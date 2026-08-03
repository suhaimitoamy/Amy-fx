import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('Dashboard presentation order is retained while Analyze DOM order stays authoritative', async () => {
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

  assert.match(gate, /const DASHBOARD_ORDER/);
  assert.match(gate, /reorderDashboardPanels/);
  assert.match(gate, /currentView\(\) === 'Dashboard'/);
  assert.match(gate, /Analyze is intentionally never reordered/);
  assert.match(gate, /reorderedAnalyze: 0/);
  assert.doesNotMatch(gate, /ANALYZE_ORDER/);
  assert.doesNotMatch(gate, /reorderAnalyzePanels/);
  assert.doesNotMatch(gate, /currentView\(\) === 'Analyze'.*reorder/s);
});

test('legacy duplicate panels are blocked without observing nested Analyze mutations', async () => {
  const gate = await read('app/src/main/assets/apps/mapping/js/dashboard-only-panels-v1.js');

  assert.match(gate, /amy-entry-watch-card/);
  assert.match(gate, /removeLegacyPanel/);
  assert.match(gate, /blockedInsertions/);
  assert.match(gate, /observer\.observe\(app, \{ childList: true, subtree: false \}\)/);
  assert.match(gate, /if \(currentView\(\) !== 'Dashboard'\) return/);
  assert.doesNotMatch(gate, /visibilitychange/);
  assert.doesNotMatch(gate, /amyfx:market-update/);
});

test('panel presentation does not alter Mapping Engine or market requests', async () => {
  const gate = await read('app/src/main/assets/apps/mapping/js/dashboard-only-panels-v1.js');

  assert.doesNotMatch(gate, /fetch\(/);
  assert.doesNotMatch(gate, /Supabase|Vercel|TwelveData/);
  assert.doesNotMatch(gate, /mappingSnapshot\s*=/);
  assert.doesNotMatch(gate, /setupExecution\s*=/);
  assert.doesNotMatch(gate, /candles\s*=/);
  assert.doesNotMatch(gate, /scrollIntoView|scrollTo\(|scrollBy\(/);
});
