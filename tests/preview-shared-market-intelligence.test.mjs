import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const relative = 'app/src/main/assets/apps/shared/market-intelligence.js';
const absolute = path.join(root, relative);
const read = () => readFile(absolute, 'utf8');

test('shared Market Intelligence JavaScript is syntactically valid', () => {
  const result = spawnSync(process.execPath, ['--check', absolute], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('shared state survives localStorage read and write failures', async () => {
  const source = await read();
  assert.match(source, /let memoryState = \{\}/);
  assert.match(source, /catch \(_\) \{\s*return memoryState/);
  assert.match(source, /memoryState = state/);
  assert.match(source, /try \{ localStorage\.setItem\(STORE_KEY, JSON\.stringify\(state\)\); \} catch \(_\) \{\}/);
});

test('news alone cannot mark XAU USD market data as LIVE', async () => {
  const source = await read();
  const freshnessBlock = source.slice(source.indexOf('function freshness'), source.indexOf('function normalizeLevel'));
  assert.match(freshnessBlock, /\[state\.mapping, state\.liquidity, state\.heatmap\]/);
  assert.match(freshnessBlock, /if \(!candidates\.length \|\| !price\) return \{ label: 'WAITING'/);
  assert.doesNotMatch(freshnessBlock, /state\.news/);
  assert.match(source, /function bestCurrentPrice\(state = read\(\)\)/);
});

test('briefing and command strip use the same canonical market freshness and price', async () => {
  const source = await read();
  assert.match(source, /function briefing\(state = read\(\)\)/);
  assert.match(source, /const fresh = freshness\(state\)/);
  assert.match(source, /const price = bestCurrentPrice\(state\)/);
  assert.match(source, /if \(fresh\.className !== 'live'\)/);
});
