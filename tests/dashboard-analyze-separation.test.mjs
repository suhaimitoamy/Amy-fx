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
  assert.match(source, /renderAnalyzeCard\(validated, regime, router, liquidity\)/);
});

test('Dashboard contains compact decision context only', () => {
  const dashboard = section('function renderDashboardCard(', 'function renderAnalyzeCard(');
  assert.match(dashboard, /DASHBOARD · MARKET CONTEXT RINGKAS/);
  assert.match(dashboard, /Market State/);
  assert.match(dashboard, /Direction Forecast/);
  assert.match(dashboard, /Nearest Liquidity/);
  assert.match(dashboard, /Market Shift Advisory/);
  assert.match(dashboard, /Strategy Context/);
  assert.doesNotMatch(dashboard, /ENGINE DIAGNOSTICS/);
  assert.doesNotMatch(dashboard, /regime-probability-list/);
  assert.doesNotMatch(dashboard, /strategy-engine-grid/);
  assert.doesNotMatch(dashboard, /router-reasons/);
});

test('Analyze keeps complete technical context and labels raw scores honestly', () => {
  const helper = section('function validatedContextMarkup(', 'function waitingMarkup(');
  const analyze = section('function renderAnalyzeCard(', 'function renderCard(');
  assert.match(helper, /VALIDATED MARKET CONTEXT/);
  assert.match(analyze, /ANALYZE · VALIDATED CONTEXT \+ TECHNICAL SUPPORT/);
  assert.match(analyze, /validatedContextMarkup\(validated\)/);
  assert.match(analyze, /REGIME CONTEXT/);
  assert.match(analyze, /ENGINE DIAGNOSTICS/);
  assert.match(analyze, /STRATEGY ROUTER/);
  assert.match(analyze, /LIQUIDITY CONTEXT/);
  assert.match(analyze, /router-reasons/);
  assert.match(analyze, /belum terkalibrasi sebagai probabilitas/);
});

test('Legacy focus mode no longer hides the rest of Dashboard', () => {
  const viewMode = section('function applyViewMode(', 'function bindCard(');
  assert.match(viewMode, /classList\.remove\('regime-router-focus-mode', 'regime-router-detail-mode'\)/);
  assert.doesNotMatch(viewMode, /classList\.toggle/);
});
