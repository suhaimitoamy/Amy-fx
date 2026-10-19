import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync('app/src/main/assets/home-price-chart.js', 'utf8');

test('home-price-chart.js eliminates blank screen flicker and caches H1 context (Item 1.9)', () => {
  // 1. Verify change() does not wipe raw to null or call view.reset()
  const changeMatch = code.match(/function change\(\)\s*\{([\s\S]*?)\n\s*function/);
  assert.ok(changeMatch, 'change function must exist');
  const changeBody = changeMatch[1];

  assert.doesNotMatch(changeBody, /raw\s*=\s*null/, 'change() must not set raw = null to avoid blank screen');
  assert.doesNotMatch(changeBody, /view\.reset\(\)/, 'change() must not call view.reset() to avoid wiping canvas');

  // 2. Verify change() checks localStorage for instant timeframe render
  assert.match(changeBody, /localStorage\.getItem\(`amyfx\.mapping\.candles\.\$\{newTf\}`\)/);

  // 3. Verify H1 context caching avoids redundant network requests
  assert.match(code, /let h1Cache\s*=\s*null,\s*h1CacheTime\s*=\s*0;/);
  assert.match(code, /shouldFetchH1\s*=\s*!isH1\s*&&\s*\(!h1Cache\s*\|\|\s*\(Date\.now\(\)\s*-\s*h1CacheTime\s*>\s*300000\)\)/);
});
