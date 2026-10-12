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
  assert.match(source, /tab === 'Dashboard'\s*\? renderDashboardCard\(result\)\s*:\s*renderAnalyzeCard\(result\)/);
});

test('Dashboard contains only the three primary market outputs', () => {
  const dashboard = section('function renderDashboardCard(', 'function renderAnalyzeCard(');
  assert.match(dashboard, /Mapping candle tertutup/);
  assert.match(dashboard, /marketOverviewMarkup\(d\)/);
  assert.match(dashboard, /CLOSED CANDLE/);
  assert.doesNotMatch(dashboard, /contextMarkup\(d\)/);
  assert.doesNotMatch(dashboard, /freshMarkup\(d\)/);
  assert.doesNotMatch(dashboard, /predictiveMarkup\(d\)/);
  assert.doesNotMatch(dashboard, /confidence|probability/i);
});

test('Analyze separates D descriptive, fresh evidence, and predictive signals', () => {
  const helper = section('function marketOverviewMarkup(', 'function renderDashboardCard(');
  const analyze = section('function renderAnalyzeCard(', 'function renderCard(');
  assert.match(helper, /Final Bias/);
  assert.match(helper, /d\.predictive\.nextMove\.signal/);
  assert.match(helper, /Dealing Range/);
  assert.match(analyze, /contextMarkup\(d\)/);
  assert.match(analyze, /freshMarkup\(d\)/);
  assert.match(analyze, /predictiveMarkup\(d\)/);
  assert.match(analyze, /execution.status/);
  assert.doesNotMatch(analyze, /accuracy|confidence|probability/i);
});

test('Legacy focus and detail modes are not applied by Market Intent', () => {
  assert.doesNotMatch(source, /regime-router-focus-mode/);
  assert.doesNotMatch(source, /regime-router-detail-mode/);
  assert.doesNotMatch(source, /function applyViewMode/);
  assert.doesNotMatch(source, /classList\.toggle\([^)]*focus-mode/);
});
