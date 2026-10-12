import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedRelative = 'app/src/main/assets/apps/shared/market-intelligence.js';
const contractRelative = 'app/src/main/assets/apps/shared/amyfx-market-state-contract-v1.js';
const sharedAbsolute = path.join(root, sharedRelative);
const contractAbsolute = path.join(root, contractRelative);
const readShared = () => readFile(sharedAbsolute, 'utf8');
const readContract = () => readFile(contractAbsolute, 'utf8');

test('shared Market Intelligence and canonical contract JavaScript are syntactically valid', () => {
  for (const file of [sharedAbsolute, contractAbsolute]) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});

test('canonical shared state survives localStorage read and write failures', async () => {
  const source = await readContract();
  assert.match(source, /let memoryState = \{ schemaVersion: SCHEMA_VERSION \}/);
  assert.match(source, /catch \(_\) \{\s*return memoryState/);
  assert.match(source, /memoryState = state/);
  assert.match(source, /try \{ localStorage\.setItem\(STORE_KEY, JSON\.stringify\(state\)\); \} catch \(_\) \{\}/);
});

test('news, Mapping, Liquidity or Heatmap cannot become the official stored XAU USD quote', async () => {
  const source = await readContract();
  const priceBlock = source.slice(source.indexOf('function bestCurrentPrice'), source.indexOf('function nearestLevels'));
  const freshnessBlock = source.slice(source.indexOf('function freshness'), source.indexOf('function purgeLegacyMarketCaches'));
  assert.match(priceBlock, /const price = Number\(state\?\.quote\?\.price\)/);
  assert.doesNotMatch(priceBlock, /mapping|liquidity|heatmap|news/);
  assert.match(freshnessBlock, /assess\("quote", state\?\.quote \|\| null\)/);
  assert.match(freshnessBlock, /source: state\?\.quote\?\.source \|\| null/);
});

test('source capturedAt is preferred and storedAt never participates in freshness', async () => {
  const source = await readContract();
  const sourceTimeBlock = source.slice(source.indexOf('function sourceTime'), source.indexOf('function policy'));
  const assessBlock = source.slice(source.indexOf('function assess'), source.indexOf('function normalizeLegacyPart'));
  assert.match(sourceTimeBlock, /payload\.capturedAt/);
  assert.match(sourceTimeBlock, /payload\.sourceCandleTime/);
  assert.doesNotMatch(sourceTimeBlock, /storedAt/);
  assert.match(assessBlock, /value\?\.capturedAt/);
  assert.doesNotMatch(assessBlock, /storedAt/);
});

test('briefing and command strip use one display quote with live WebSocket priority', async () => {
  const source = await readShared();
  assert.match(source, /function freshness\(state = contract\.read\(\)\)/);
  assert.match(source, /function runtimeLiveQuote\(\)/);
  assert.match(source, /function displayQuote\(state = contract\.read\(\)\)/);
  assert.match(source, /return runtimeLiveQuote\(\) \|\| state\.quote \|\| \{\}/);
  assert.match(source, /const quoteFreshness = contract\.assess\('quote', displayQuote\(state\)\)/);
  assert.match(source, /const quote = displayQuote\(state\)/);
  assert.match(source, /const price = Number\(quote\?\.price \|\| contract\.bestCurrentPrice\(state\) \|\| 0\)/);
  assert.match(source, /amyfx:live-price-display/);
  assert.match(source, /data-live-price/);
});

test('live display quote does not mutate the canonical stored market contract', async () => {
  const source = await readShared();
  const liveBlock = source.slice(source.indexOf('function runtimeLiveQuote'), source.indexOf('function displayQuote'));
  assert.match(liveBlock, /TWELVE_DATA_WEBSOCKET_DISPLAY/);
  assert.match(liveBlock, /last_ws_tick_at/);
  assert.match(liveBlock, /last_price/);
  assert.doesNotMatch(liveBlock, /contract\.write|localStorage\.setItem\(contract\.storeKey/);
});
