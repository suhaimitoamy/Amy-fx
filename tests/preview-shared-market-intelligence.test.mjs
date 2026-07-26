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

test('news or timestamp-only state cannot mark XAU USD market data as LIVE', async () => {
  const source = await read();
  const candidatesBlock = source.slice(source.indexOf('function marketPriceCandidates'), source.indexOf('function bestCurrentPrice'));
  const freshnessBlock = source.slice(source.indexOf('function freshness'), source.indexOf('function normalizeLevel'));
  assert.match(candidatesBlock, /priceCandidate\(state\.mapping, state\.mapping\?\.price, 'mapping'\)/);
  assert.match(candidatesBlock, /priceCandidate\(state\.liquidity, state\.liquidity\?\.currentPrice, 'liquidity'\)/);
  assert.match(candidatesBlock, /priceCandidate\(state\.heatmap, state\.heatmap\?\.currentPrice, 'heatmap'\)/);
  assert.doesNotMatch(candidatesBlock, /state\.news/);
  assert.match(freshnessBlock, /const candidates = marketPriceCandidates\(state\)/);
  assert.match(freshnessBlock, /if \(!candidates\.length\) return \{ label: 'WAITING'/);
  assert.match(freshnessBlock, /if \(!latest\.fresh\) return \{ label: 'STALE'/);
  assert.match(source, /function bestCurrentPrice\(state = read\(\)\)/);
});

test('explicit source timestamp is preferred over storage time', async () => {
  const source = await read();
  assert.match(source, /function explicitPartTimestamp\(part\)/);
  assert.match(source, /return explicitPartTimestamp\(part\) \|\| timestamp\(part\?\.storedAt\)/);
});

test('briefing and command strip use the same canonical market freshness and price', async () => {
  const source = await read();
  assert.match(source, /function briefing\(state = read\(\)\)/);
  assert.match(source, /const fresh = freshness\(state\)/);
  assert.match(source, /const price = bestCurrentPrice\(state\)/);
  assert.match(source, /if \(fresh\.className !== 'live'\)/);
});
