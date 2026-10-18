import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CACHE_TTL_SECONDS } from '../api/twelvedata.js';

test('Item 1.23 & 2.11: CACHE_TTL_SECONDS contains intended multi-tier caching durations', () => {
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

test('Item 2.11: Multi-Tiered Intelligent Caching di api/twelvedata.js (Hemat Kuota 90%)', () => {
  // Verifikasi tier durasi spesifik sesuai Item 2.11
  assert.equal(CACHE_TTL_SECONDS['15min'], 600, 'M15: Cache 10 menit (600s)');
  assert.equal(CACHE_TTL_SECONDS['1h'], 1800, 'H1: Cache 30 menit (1800s)');
  assert.equal(CACHE_TTL_SECONDS['1day'], 14400, 'D1: Cache 4 jam (14400s)');
  assert.equal(CACHE_TTL_SECONDS['1week'], 43200, 'W1: Cache 12 jam (43200s)');

  // Verifikasi bahwa M15 dan H1 tidak terjebak clamping 30 detik
  const source = fs.readFileSync('api/twelvedata.js', 'utf8');
  assert.ok(
    source.includes("const ttl = interval === '1min' || interval === '5min' ? ttlSeconds(interval) : configuredTtl;"),
    'M15 dan H1 harus menggunakan configuredTtl tanpa dibatasi Math.min(30)'
  );
  assert.ok(
    source.includes("setCacheHeaders(res, ttl, 'MEMORY_HIT', fresh.source || 'memory');"),
    'Response cache harus mengembalikan header MEMORY_HIT untuk efisiensi instan 5ms'
  );
});
