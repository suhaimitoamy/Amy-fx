import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ASIA_SESSION_CONFIG,
  asiaSessionWindows,
  calculateAsiaRange,
  nextAsiaSessionBoundary
} from '../app/src/main/assets/apps/mapping/js/session/asia-range.js';

const candle = (iso, high, low, close) => ({
  time: Date.parse(iso) / 1000,
  high,
  low,
  close,
  open: close
});

test('Asia Range follows New York 18:00-02:00 and reports wick sweep during EDT', () => {
  const now = Date.parse('2026-07-13T10:00:00Z');
  const candles = [
    candle('2026-07-12T21:45:00Z', 4999, 3000, 4100),
    candle('2026-07-12T22:00:00Z', 4102, 4099, 4101),
    candle('2026-07-12T22:15:00Z', 4106, 4100, 4105),
    candle('2026-07-12T22:30:00Z', 4110, 4103, 4108),
    candle('2026-07-13T01:00:00Z', 4108, 4096, 4098),
    candle('2026-07-13T02:00:00Z', 4104, 4094, 4097),
    candle('2026-07-13T05:45:00Z', 4103, 4095, 4100),
    candle('2026-07-13T06:00:00Z', 4100, 4098, 4099),
    candle('2026-07-13T07:00:00Z', 4112, 4105, 4108)
  ];
  const result = calculateAsiaRange(candles, 4107, now);
  assert.equal(result.valid, true);
  assert.equal(result.high, 4110);
  assert.equal(result.low, 4094);
  assert.equal(result.range, 16);
  assert.equal(result.highStatus, 'TERSAPU WICK');
  assert.equal(result.lowStatus, 'BELUM DISAPU');
  assert.equal(result.sourceSeason, 'EDT');
  assert.match(result.windowLabel, /06:00–14:00 WITA · EDT/);
});

test('closed candle beyond Asia High has priority over wick sweep', () => {
  const now = Date.parse('2026-07-13T10:00:00Z');
  const candles = [
    candle('2026-07-12T22:00:00Z', 4105, 4098, 4102),
    candle('2026-07-13T01:00:00Z', 4110, 4095, 4100),
    candle('2026-07-13T05:45:00Z', 4108, 4097, 4104),
    candle('2026-07-13T07:00:00Z', 4113, 4107, 4112)
  ];
  assert.equal(calculateAsiaRange(candles, 4112, now).highStatus, 'CLOSE BREAK');
});

test('active Asia session remains developing', () => {
  const now = Date.parse('2026-07-13T23:00:00Z');
  const candles = [
    candle('2026-07-13T22:00:00Z', 4072, 4068, 4070),
    candle('2026-07-13T22:15:00Z', 4075, 4069, 4074),
    candle('2026-07-13T22:30:00Z', 4076, 4071, 4073)
  ];
  const result = calculateAsiaRange(candles, 4073, now);
  assert.equal(result.active, true);
  assert.equal(result.highStatus, 'BERKEMBANG');
  assert.equal(result.lowStatus, 'BERKEMBANG');
  assert.equal(result.sourceSeason, 'EDT');
});

test('first closed M15 candle starts the active Asia Range instead of falling back to yesterday', () => {
  const now = Date.parse('2026-07-13T22:20:00Z');
  const candles = [
    candle('2026-07-12T22:00:00Z', 4200, 4190, 4195),
    candle('2026-07-12T22:15:00Z', 4205, 4188, 4198),
    candle('2026-07-13T22:00:00Z', 4072, 4068, 4070)
  ];
  const result = calculateAsiaRange(candles, 4070, now);
  assert.equal(result.active, true);
  assert.equal(result.candleCount, 1);
  assert.equal(result.high, 4072);
  assert.equal(result.low, 4068);
});

test('before the current New York session starts, the latest completed Asia Range remains selected', () => {
  const now = Date.parse('2026-07-13T21:00:00Z');
  const candles = [
    candle('2026-07-12T22:00:00Z', 4105, 4098, 4102),
    candle('2026-07-13T05:45:00Z', 4110, 4095, 4100)
  ];
  const result = calculateAsiaRange(candles, 4100, now);
  assert.equal(result.valid, true);
  assert.equal(result.active, false);
  assert.equal(result.complete, true);
  assert.match(result.windowLabel, /06:00–14:00 WITA · EDT/);
});

test('summer session windows convert EDT to 06:00-14:00 WITA', () => {
  const now = Date.parse('2026-07-13T23:00:00Z');
  const [window] = asiaSessionWindows(now, 1);
  assert.equal(new Date(window.start).toISOString(), '2026-07-13T22:00:00.000Z');
  assert.equal(new Date(window.end).toISOString(), '2026-07-14T06:00:00.000Z');
  assert.equal(window.active, true);
  assert.equal(window.sourceSeason, 'EDT');
  assert.match(window.label, /06:00–14:00 WITA · EDT/);
});

test('winter session windows shift automatically to 07:00-15:00 WITA under EST', () => {
  const now = Date.parse('2026-12-15T12:00:00Z');
  const [window] = asiaSessionWindows(now, 1);
  assert.equal(new Date(window.start).toISOString(), '2026-12-14T23:00:00.000Z');
  assert.equal(new Date(window.end).toISOString(), '2026-12-15T07:00:00.000Z');
  assert.equal(window.active, false);
  assert.equal(window.complete, true);
  assert.equal(window.sourceSeason, 'EST');
  assert.match(window.label, /07:00–15:00 WITA · EST/);
});

test('next boundary returns the active session end instead of polling', () => {
  const now = Date.parse('2026-07-13T23:00:00Z');
  assert.equal(
    new Date(nextAsiaSessionBoundary(now)).toISOString(),
    '2026-07-14T06:00:00.000Z'
  );
});

test('Asia Range configuration is anchored to New York and displayed in WITA', () => {
  assert.deepEqual(ASIA_SESSION_CONFIG, {
    sourceZone: 'America/New_York',
    displayZone: 'Asia/Makassar',
    sourceStartHour: 18,
    sourceEndHour: 2
  });
});

test('shared candle store requests UTC and normalizes provider timestamps', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const store = readFileSync(`${root}/lib/market-candle-store.mjs`, 'utf8');
  assert.match(store, /timezone:\s*'UTC'/);
  assert.match(store, /function parseUtcSeconds/);
  assert.match(store, /replace\(' ', 'T'\)/);
});
