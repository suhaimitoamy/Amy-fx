import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const relative = 'app/src/main/assets/apps/shared/amyfx-home-data-integration-v1.js';
const absolute = path.join(root, relative);
const read = () => readFile(absolute, 'utf8');

test('Home Journal integration JavaScript is syntactically valid', () => {
  const result = spawnSync(process.execPath, ['--check', absolute], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('Home reads journals.v2 without creating or upgrading the Journal database', async () => {
  const source = await read();
  assert.match(source, /indexedDB\.databases/);
  assert.match(source, /request\.onupgradeneeded\s*=\s*\(\)\s*=>\s*\{/);
  assert.match(source, /request\.transaction\?\.abort\(\)/);
  assert.match(source, /transaction\(META_STORE, "readonly"\)/);
  assert.match(source, /journals\.v2/);
});

test('Home keeps legacy fallback, closes late database handles and supports older WebViews', async () => {
  const source = await read();
  assert.match(source, /legacyJournalCount\(\)/);
  assert.match(source, /if \(settled\) \{ db\.close\(\); return; \}/);
  assert.match(source, /window\.requestAnimationFrame \|\|/);
});

test('Profile counters publish one shared Home stats event', async () => {
  const source = await read();
  assert.match(source, /AmyFXHomeStats = Object\.freeze\(\{ analyses, journals/);
  assert.match(source, /amyfx:home-stats-change/);
  assert.match(source, /Catatan Jurnal/);
  assert.match(source, /Analisis Mapping/);
});
