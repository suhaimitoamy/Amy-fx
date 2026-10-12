import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeScalperHistory,
  scalperTradeOutcome,
  scalperVaultStats
} from '../app/src/main/assets/apps/mapping/js/scalper-vault.js';

const setup = (id, status, resultR = null, updatedAt = '2026-08-15T00:00:00Z') => ({
  id,
  status,
  resultR,
  updatedAt
});

test('Scalper Vault mempertahankan setup terminal lama dan dedupe berdasarkan id', () => {
  const old = setup('old', 'TP_HIT', 2, '2026-08-01T00:00:00Z');
  const firstNew = setup('new', 'TIME_EXIT', -0.2, '2026-08-02T00:00:00Z');
  const correctedNew = setup('new', 'TIME_EXIT', 0.3, '2026-08-03T00:00:00Z');
  const active = setup('active', 'ACTIVE');
  const merged = mergeScalperHistory([old, firstNew], [correctedNew, active]);
  assert.deepEqual(merged.map(item => item.id), ['new', 'old']);
  assert.equal(merged[0].resultR, 0.3);
});

test('outcome trade membedakan win loss BE dan setup batal', () => {
  assert.equal(scalperTradeOutcome(setup('a', 'TP_HIT', 2)), 'WIN');
  assert.equal(scalperTradeOutcome(setup('b', 'SL_HIT', -1)), 'LOSS');
  assert.equal(scalperTradeOutcome(setup('c', 'BE_HIT', 0)), 'BE');
  assert.equal(scalperTradeOutcome(setup('d', 'TIME_EXIT', 0.25)), 'WIN');
  assert.equal(scalperTradeOutcome(setup('e', 'TIME_EXIT', -0.1)), 'LOSS');
  assert.equal(scalperTradeOutcome(setup('f', 'TIME_EXIT', 0)), 'BE');
  assert.equal(scalperTradeOutcome(setup('g', 'INVALIDATED')), null);
  assert.equal(scalperTradeOutcome(setup('h', 'CANCELLED')), null);
});

test('WR all-time memakai Win dibagi Win plus Loss dan mengecualikan BE/invalid/cancelled', () => {
  const history = [
    setup('w1', 'TP_HIT', 2),
    setup('w2', 'TIME_EXIT', 0.25),
    setup('l1', 'SL_HIT', -1),
    setup('be1', 'BE_HIT', 0),
    setup('inv', 'INVALIDATED'),
    setup('cancel', 'CANCELLED')
  ];
  const stats = scalperVaultStats(history);
  assert.equal(stats.archiveCount, 6);
  assert.equal(stats.totalTrades, 4);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 1);
  assert.equal(stats.breakeven, 1);
  assert.equal(stats.excludedSetups, 2);
  assert.equal(stats.winRate, (2 / 3) * 100);
  assert.equal(stats.netR, 1.25);
});
