import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CACHE_TTL_SECONDS } from '../api/twelvedata.js';

test('Item 1.23: CACHE_TTL_SECONDS contains intended multi-tier caching durations', () => {
  assert.equal(CACHE_TTL_SECONDS['15min'], 600, '15min TTL must be 10 minutes (600s)');
  assert.equal(CACHE_TTL_SECONDS['30min'], 900, '30min TTL must be 15 minutes (900s)');
  assert.equal(CACHE_TTL_SECONDS['1h'], 1800, '1h TTL must be 30 minutes (1800s)');
  assert.equal(CACHE_TTL_SECONDS['4h'], 7200, '4h TTL must be 2 hours (7200s)');
  assert.equal(CACHE_TTL_SECONDS['1day'], 14400, '1day TTL must be 4 hours (14400s)');
  assert.equal(CACHE_TTL_SECONDS['1week'], 43200, '1week TTL must be 12 hours (43200s)');
});

test('Item 1.23: api/twelvedata.js uses CACHE_TTL_SECONDS for non-scalping intervals without 30s clamping', () => {
  const source = fs.readFileSync('api/twelvedata.js', 'utf8');

  // Must define configuredTtl from CACHE_TTL_SECONDS
  assert.ok(
    source.includes("const configuredTtl = CACHE_TTL_SECONDS[interval] || 60;"),
    'Must resolve configuredTtl from CACHE_TTL_SECONDS'
  );

  // Must only use ttlSeconds for 1min and 5min, and configuredTtl for larger intervals
  assert.ok(
    source.includes("const ttl = interval === '1min' || interval === '5min' ? ttlSeconds(interval) : configuredTtl;"),
    'Must only apply live candle boundary clamp to 1min and 5min'
  );
});
