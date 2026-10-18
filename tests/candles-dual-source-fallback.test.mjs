import test from 'node:test';
import assert from 'node:assert/strict';
import { DATASET_RELEASE_BASES, fetchDualSource } from '../api/candles.js';

test('Item 1.2: DATASET_RELEASE_BASES prioritizes Amy-fx over Amy-fx-pro', () => {
  assert.equal(DATASET_RELEASE_BASES.length, 2, 'Must have exactly 2 dataset release sources');
  assert.ok(
    DATASET_RELEASE_BASES[0].includes('suhaimitoamy/Amy-fx/'),
    'Primary release base must be suhaimitoamy/Amy-fx (Rule 9 invariant)'
  );
  assert.ok(
    DATASET_RELEASE_BASES[1].includes('suhaimitoamy/Amy-fx-pro/'),
    'Secondary release base must be suhaimitoamy/Amy-fx-pro fallback'
  );
});

test('Item 1.2: fetchDualSource tries primary and gracefully falls back to secondary on 404', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  try {
    globalThis.fetch = async (url, options) => {
      calls.push(url);
      if (url.includes('suhaimitoamy/Amy-fx/')) {
        // Simulate primary returning 404
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found'
        };
      }
      if (url.includes('suhaimitoamy/Amy-fx-pro/')) {
        // Secondary succeeds
        return {
          ok: true,
          status: 200,
          json: async () => ({ manifest: 'sample' }),
          arrayBuffer: async () => new ArrayBuffer(8)
        };
      }
      return { ok: false, status: 500 };
    };

    const result = await fetchDualSource('manifest_months.json');
    assert.equal(result.response.ok, true, 'Result must be ok');
    assert.equal(result.response.status, 200);
    assert.equal(result.sourceBase, DATASET_RELEASE_BASES[1], 'sourceBase must point to secondary fallback');
    assert.equal(calls.length, 2, 'Must have attempted primary first, then secondary');
    assert.ok(calls[0].startsWith(DATASET_RELEASE_BASES[0]), 'First call must target primary');
    assert.ok(calls[1].startsWith(DATASET_RELEASE_BASES[1]), 'Second call must target secondary');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Item 1.2: fetchDualSource succeeds immediately on primary if primary returns 200', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  try {
    globalThis.fetch = async (url, options) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ manifest: 'primary-ok' })
      };
    };

    const result = await fetchDualSource('manifest_months.json');
    assert.equal(result.response.ok, true);
    assert.equal(result.sourceBase, DATASET_RELEASE_BASES[0]);
    assert.equal(calls.length, 1, 'Must not call secondary if primary succeeds');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
