import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const enginePath = new URL('../app/src/main/assets/apps/mapping/js/engine/ict-core.js', import.meta.url);
const source = fs.readFileSync(enginePath, 'utf8');
const engine = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const candle = (open, high, low, close) => ({ open, high, low, close });

test('liquidity yang pernah disapu tidak aktif kembali setelah harga berbalik', () => {
  const candles = [
    candle(100, 101, 99, 100),
    candle(100, 105, 99.5, 101),
    candle(101, 106, 100, 104),
    candle(104, 104.5, 98, 99),
    candle(99, 101, 97, 100)
  ];
  const result = engine.buildLiquidityHierarchy(candles, {
    highs: [{ high: 105, index: 1 }], lows: []
  }, { price: 100, htfNarrative: { htfBias: 'NEUTRAL' } });

  assert.equal(result.activeTargets.some(x => x.type === 'BSL' && x.level === 105), false);
  assert.equal(result.swept.some(x => x.type === 'BSL' && x.level === 105), true);
});

test('break historis memakai ATR lokal sebelum candle breakout', () => {
  const candles = [
    candle(100, 101, 99.5, 100.2),
    candle(100.2, 102, 100, 101),
    candle(101, 101.5, 100.2, 101.1),
    candle(101.5, 105, 100, 103.2),
    ...Array.from({ length: 16 }, () => candle(103, 112, 102.5, 103.1))
  ];
  const result = engine.detectStructure(candles, {
    highs: [{ high: 102, index: 1 }], lows: []
  });

  assert.equal(result.last?.breakType, 'VALID_BREAK');
  assert.ok(result.last?.localAtr < 3);
});

test('sweep wajib menutup kembali di dalam level', () => {
  assert.equal(engine.isValidLiquiditySweep(candle(100.2, 101, 99, 99.5), 'SSL', 100), false);
  assert.equal(engine.isValidLiquiditySweep(candle(100.2, 101, 99, 100.4), 'SSL', 100), true);
  assert.equal(engine.isValidLiquiditySweep(candle(99.8, 101, 99, 100.5), 'BSL', 100), false);
  assert.equal(engine.isValidLiquiditySweep(candle(99.8, 101, 99, 99.6), 'BSL', 100), true);
});

function conflictContext() {
  return {
    htfNarrative: { htfBias: 'NEUTRAL' },
    dealingRange: { currentZone: 'DISCOUNT' },
    liquidityHierarchy: { drawTarget: { type: 'BSL' } },
    st: { last: { breakType: 'VALID_BREAK', hasDisplacement: true } },
    sessionContext: { session: 'LONDON' }
  };
}

test('setup RR di bawah 1:2 ditolak sebagai konflik fatal', () => {
  const setup = { dir: 'BUY WATCH', entryLow: 100, entryHigh: 101, sl: 99, tp1: 102.5, status: 'FRESH', qualityLabel: 'MEDIUM' };
  const result = engine.detectSetupConflicts(setup, conflictContext());
  assert.equal(result.hasFatalConflict, true);
  assert.equal(result.recommendation, 'INVALID');
  assert.equal(result.conflicts.some(x => x.type === 'RR_CONFLICT'), true);
  setup.conflictCheck = result;
  assert.equal(engine.assignChecklist(setup, conflictContext()).status, 'INVALID');
});

test('setup RR tepat 1:2 tidak terkena konflik RR', () => {
  const setup = { dir: 'BUY WATCH', entryLow: 100, entryHigh: 101, sl: 99, tp1: 103, status: 'FRESH', qualityLabel: 'MEDIUM' };
  const result = engine.detectSetupConflicts(setup, conflictContext());
  assert.equal(result.conflicts.some(x => x.type === 'RR_CONFLICT'), false);
});

test('struktur HTF lebih dominan daripada lokasi discount/premium', () => {
  assert.deepEqual(engine.resolveHtfBias('DISCOUNT', 'BEARISH'), { bias: 'BEARISH', draw: 'SSL', aligned: false });
  assert.deepEqual(engine.resolveHtfBias('PREMIUM', 'BULLISH'), { bias: 'BULLISH', draw: 'BSL', aligned: false });
  assert.deepEqual(engine.resolveHtfBias('DISCOUNT', 'BULLISH'), { bias: 'BULLISH', draw: 'BSL', aligned: true });
});

test('Silver Bullet aktif pada pukul 10:30 New York', () => {
  const newYork1030Winter = Date.UTC(2026, 0, 15, 15, 30, 0);
  const result = engine.buildSessionContext(newYork1030Winter);
  assert.equal(result.session, 'NEW_YORK');
  assert.equal(result.killzone, 'SILVER_BULLET');
  assert.equal(result.sessionQuality, 'ACTIVE');
});
