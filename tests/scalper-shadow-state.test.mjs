import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newestScalperSetup,
  reconcileScalperPayload,
  scalperFreshness,
  scalperPayloadSignature
} from '../app/src/main/assets/apps/mapping/js/scalper-shadow-state.js';

function setup(id, status, updatedAt, sequence) {
  return {
    id,
    status,
    updatedAt,
    lifecycleSequence: sequence,
    signalCandleCloseTime: 1_700_000_000
  };
}

test('terminal Scalper state cannot revert to an active state from a late response', () => {
  const terminal = setup('setup-a', 'SL_HIT', '2026-07-30T01:05:00.000Z', 4);
  const lateActive = setup('setup-a', 'ACTIVE', '2026-07-30T01:06:00.000Z', 2);
  assert.equal(newestScalperSetup(terminal, lateActive), terminal);
});

test('older payload cannot overwrite a newer payload', () => {
  const current = {
    ok: true,
    generatedAt: '2026-07-30T01:10:00.000Z',
    primary: setup('setup-a', 'TP_HIT', '2026-07-30T01:09:00.000Z', 4),
    active: [],
    recent: [setup('setup-a', 'TP_HIT', '2026-07-30T01:09:00.000Z', 4)]
  };
  const stale = {
    ok: true,
    generatedAt: '2026-07-30T01:08:00.000Z',
    primary: setup('setup-a', 'ACTIVE', '2026-07-30T01:08:00.000Z', 2),
    active: [setup('setup-a', 'ACTIVE', '2026-07-30T01:08:00.000Z', 2)],
    recent: []
  };
  assert.equal(reconcileScalperPayload(current, stale), current);
});

test('two setups remain separate when direction and prices are similar', () => {
  const payload = reconcileScalperPayload(null, {
    ok: true,
    generatedAt: '2026-07-30T01:10:00.000Z',
    primary: setup('setup-a', 'ACTIVE', '2026-07-30T01:09:00.000Z', 2),
    active: [
      { ...setup('setup-a', 'ACTIVE', '2026-07-30T01:09:00.000Z', 2), direction: 'BUY', entry: 3300 },
      { ...setup('setup-b', 'ACTIVE', '2026-07-30T01:09:30.000Z', 2), direction: 'BUY', entry: 3300.01 }
    ],
    recent: []
  });
  assert.deepEqual(payload.active.map(item => item.id), ['setup-a', 'setup-b']);
});

test('availability distinguishes waiting, stale, and backend failure without clearing valid data', () => {
  const now = Date.parse('2026-07-30T01:10:00.000Z');
  const waiting = {
    ok: true,
    generatedAt: '2026-07-30T01:09:30.000Z',
    engine: { status: 'COMPLETED', completed_at: '2026-07-30T01:09:30.000Z' },
    primary: null,
    active: [],
    recent: []
  };
  assert.equal(scalperFreshness(waiting, '', now), 'MENUNGGU SETUP');
  assert.equal(scalperFreshness(waiting, '', now + 151_000), 'STALE');
  assert.equal(scalperFreshness(waiting, 'network failed', now), 'DATA BELUM TERSEDIA');
  assert.notEqual(scalperPayloadSignature(waiting, 'MENUNGGU SETUP'), scalperPayloadSignature(waiting, 'DATA BELUM TERSEDIA'));
});
