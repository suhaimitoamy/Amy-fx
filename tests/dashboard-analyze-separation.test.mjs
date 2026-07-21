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

test('Dashboard contains only the three primary market outputs', () => {
  const dashboard = section('function renderDashboardCard(', 'function renderAnalyzeCard(');
  assert.match(dashboard, /AMY FX · MARKET INTELLIGENCE/);
  assert.match(dashboard, /Kondisi market saat ini/);
  assert.match(dashboard, /marketOverviewMarkup\(validated, liquidity\)/);
  assert.doesNotMatch(dashboard, /Konteks Market Lanjutan/);
  assert.doesNotMatch(dashboard, /Performa Historis Model/);
  assert.doesNotMatch(dashboard, /strategy-engine-grid/);
  assert.doesNotMatch(dashboard, /regime-probability-list/);
});

test('Analyze presents performance and advanced context in compact disclosures', () => {
  const helper = section('function marketOverviewMarkup(', 'function waitingMarkup(');
  const analyze = section('function renderAnalyzeCard(', 'function renderCard(');
  assert.match(helper, /RINGKASAN MARKET/);
  assert.match(analyze, /RELIABILITAS HISTORIS/);
  assert.match(analyze, /Performa Historis Model/);
  assert.match(analyze, /Konteks Market Lanjutan/);
  assert.match(analyze, /Target & Skenario Harga/);
  assert.match(analyze, /professional-disclosure/);
  assert.match(analyze, /scenarioMarkup\(result, router\)/);
  assert.doesNotMatch(analyze, /<details class="professional-disclosure" open>/);
});

test('Legacy focus mode no longer hides the rest of Dashboard', () => {
  const viewMode = section('function applyViewMode(', 'function bindCard(');
  assert.match(viewMode, /classList\.remove\('regime-router-focus-mode', 'regime-router-detail-mode'\)/);
  assert.doesNotMatch(viewMode, /classList\.toggle/);
});
