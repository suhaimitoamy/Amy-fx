import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourcePath = new URL('../app/src/main/assets/apps/mapping/js/market-intent-ui.js', import.meta.url);
const source = await readFile(sourcePath, 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

test('Dashboard and Analyze use separate render functions', () => {
  assert.match(source, /function renderDashboardCard\(/);
  assert.match(source, /function renderAnalyzeCard\(/);
  assert.match(source, /tab === 'Dashboard'[\s\S]*renderDashboardCard/);
  assert.match(source, /renderAnalyzeCard\(result, validated, regime, router, liquidity\)/);
});

test('Dashboard contains only the three primary claim outputs', () => {
  const dashboard = section('function renderDashboardCard(', 'function renderAnalyzeCard(');
  assert.match(dashboard, /DASHBOARD · RINGKASAN KLAIM TERVALIDASI/);
  assert.match(dashboard, /Market State/);
  assert.match(dashboard, /Direction Forecast/);
  assert.match(dashboard, /Nearest Liquidity/);
  assert.doesNotMatch(dashboard, /Market Shift Advisory/);
  assert.doesNotMatch(dashboard, /Strategy Context/);
  assert.doesNotMatch(dashboard, /ENGINE DIAGNOSTICS/);
  assert.doesNotMatch(dashboard, /regime-probability-list/);
  assert.doesNotMatch(dashboard, /strategy-engine-grid/);
  assert.doesNotMatch(dashboard, /router-reasons/);
});

test('Analyze keeps complete detail and feature claim accuracy', () => {
  const helper = section('function validatedContextMarkup(', 'function waitingMarkup(');
  const analyze = section('function renderAnalyzeCard(', 'function renderCard(');
  assert.match(helper, /VALIDATED MARKET CONTEXT/);
  assert.match(analyze, /AKURASI KLAIM FITUR/);
  assert.match(analyze, /REFERENSI KLAIM PINE TERKUNCI/);
  assert.match(analyze, /REGIME EKSPERIMENTAL/);
  assert.match(analyze, /ENGINE DIAGNOSTICS/);
  assert.match(analyze, /STRATEGY ROUTER/);
  assert.match(analyze, /LIQUIDITY CONTEXT/);
  assert.match(analyze, /experimentalEntryMapMarkup\(result\)/);
  assert.match(analyze, /router-reasons/);
});

test('Legacy focus mode no longer hides the rest of Dashboard', () => {
  const viewMode = section('function applyViewMode(', 'function bindCard(');
  assert.match(viewMode, /classList\.remove\('regime-router-focus-mode', 'regime-router-detail-mode'\)/);
  assert.doesNotMatch(viewMode, /classList\.toggle/);
});
