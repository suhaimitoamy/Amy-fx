import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { classifySwingSequence, resolveMappingBias } from '../app/src/main/assets/apps/mapping/js/engine/structural-bias.js';
import { reconcileScalperPayload } from '../app/src/main/assets/apps/mapping/js/scalper-shadow-state.js';

function resultWith({ final = 'NEUTRAL', highs, lows, close = 100, trend = 'NEUTRAL', major = null } = {}) {
  return {
    tf: 'M15',
    final,
    sourceCandleClose: close,
    structureSwings: { highs, lows },
    st: { confirmedTrend: trend, lastMajorBreak: major }
  };
}

test('bias memakai bias Mapping yang sudah tersedia sebelum fallback struktur', () => {
  const result = resultWith({
    final: 'BULLISH',
    highs: [{ index: 1, high: 110 }, { index: 2, high: 105 }],
    lows: [{ index: 1, low: 100 }, { index: 2, low: 95 }],
    trend: 'BEARISH'
  });
  const decision = resolveMappingBias(result);
  assert.equal(decision.bias, 'BUY');
  assert.equal(decision.source, 'EXISTING_MAPPING_BIAS');
});

test('fallback struktur membentuk BUY dari HH + HL dan SELL dari LH + LL', () => {
  const bullish = resultWith({
    highs: [{ index: 1, high: 100 }, { index: 2, high: 110 }],
    lows: [{ index: 1, low: 90 }, { index: 2, low: 95 }]
  });
  const bearish = resultWith({
    highs: [{ index: 1, high: 110 }, { index: 2, high: 105 }],
    lows: [{ index: 1, low: 100 }, { index: 2, low: 90 }]
  });
  assert.deepEqual(classifySwingSequence(bullish).bias, 'BUY');
  assert.deepEqual(classifySwingSequence(bearish).bias, 'SELL');
  assert.equal(resolveMappingBias(bullish).source, 'HH_HL_LH_LL');
  assert.equal(resolveMappingBias(bearish).source, 'HH_HL_LH_LL');
});

test('bias lama baru berbalik setelah level invalidasi dan struktur lawan terkonfirmasi', () => {
  const bearishBreak = resultWith({
    highs: [{ index: 1, high: 110 }, { index: 2, high: 105 }],
    lows: [{ index: 1, low: 100 }, { index: 2, low: 95 }],
    close: 94,
    trend: 'BEARISH',
    major: { dir: 'BEARISH', valid: true, failed: false }
  });
  const decision = resolveMappingBias(bearishBreak, { bias: 'BUY' });
  assert.equal(decision.bias, 'SELL');
  assert.equal(decision.source, 'BULLISH_HL_INVALIDATED');
  assert.equal(decision.previousInvalidated, true);
});

test('riwayat terminal lama tidak hilang saat payload backend berikutnya hanya membawa setup baru', () => {
  const oldSetup = { id: 'old', status: 'TP_HIT', updatedAt: '2026-08-01T00:00:00Z' };
  const newestSetup = { id: 'new', status: 'SL_HIT', updatedAt: '2026-08-02T00:00:00Z' };
  const previous = { ok: true, generatedAt: '2026-08-02T00:00:00Z', active: [], history: [oldSetup], recent: [oldSetup] };
  const incoming = { ok: true, generatedAt: '2026-08-03T00:00:00Z', active: [], history: [newestSetup], recent: [newestSetup] };
  const merged = reconcileScalperPayload(previous, incoming);
  assert.deepEqual(merged.history.map(item => item.id), ['new', 'old']);
  assert.deepEqual(merged.recent.map(item => item.id), ['new', 'old']);
});

test('deep link, endpoint, dan Scalper Vault menjaga seluruh riwayat', () => {
  const ui = fs.readFileSync(new URL('../app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js', import.meta.url), 'utf8');
  const vault = fs.readFileSync(new URL('../app/src/main/assets/apps/mapping/js/scalper-vault.js', import.meta.url), 'utf8');
  const api = fs.readFileSync(new URL('../supabase/functions/scalper-setups/index.ts', import.meta.url), 'utf8');
  assert.match(ui, /setupIdFromLocation/);
  assert.match(ui, /history:\s*'all'/);
  assert.match(ui, /setup_id/);
  assert.match(ui, /SCALPER VAULT · ALL TIME/);
  assert.match(ui, /persistScalperVault/);
  assert.match(ui, /data-scalper-vault-export/);
  assert.match(ui, /data-scalper-vault-import/);
  assert.match(ui, /HISTORY_PAGE_SIZE = 100/);
  assert.match(ui, /Riwayat permanen/);
  assert.match(vault, /amyfx\.preview\.scalper\.permanent-history\.v1/);
  assert.match(vault, /amyfx\.pro\.scalper\.vault\.v1/);
  assert.match(api, /historyPermanent/);
  assert.match(api, /setup_id/);
  assert.match(api, /history_limit/);
});