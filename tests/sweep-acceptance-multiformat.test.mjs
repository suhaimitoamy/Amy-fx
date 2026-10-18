import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySweepAcceptance,
  createThrottledStatePersister
} from '../app/src/main/assets/apps/mapping/js/engine/sweep-acceptance.js';

test('Item 2.15: Multiformat Liquidity Normalization (PDH, PWH, EQH, PDL, PWL, EQL)', () => {
  // 1. PDH sweep rejection: price swept PDH (2660.00) and closed back below (2658.00)
  const pdhResult = classifySweepAcceptance({
    amySmcD: {
      sourceCandle: { close: 2658.00 },
      descriptive: {
        liquidity: {
          rawSweep: { side: 'PDH', level: 2660.00 }
        }
      }
    }
  });
  assert.equal(pdhResult.state, 'SWEEP_REJECTION', 'PDH sweep with close < level must be SWEEP_REJECTION');
  assert.equal(pdhResult.direction, 'BEARISH', 'BSL rejection defaults to BEARISH reaction');

  // 2. PDL sweep rejection: price swept PDL (2640.00) and closed back above (2642.50)
  const pdlResult = classifySweepAcceptance({
    amySmcD: {
      sourceCandle: { close: 2642.50 },
      descriptive: {
        liquidity: {
          rawSweep: { side: 'PDL', level: 2640.00 }
        }
      }
    }
  });
  assert.equal(pdlResult.state, 'SWEEP_REJECTION', 'PDL sweep with close > level must be SWEEP_REJECTION');
  assert.equal(pdlResult.direction, 'BULLISH', 'SSL rejection defaults to BULLISH reaction');

  // 3. PWH (Previous Week High) sweep rejection
  const pwhResult = classifySweepAcceptance({
    amySmcD: {
      sourceCandle: { close: 2680.00 },
      descriptive: {
        liquidity: {
          rawSweep: { type: 'PWH', level: 2685.00 }
        }
      }
    }
  });
  assert.equal(pwhResult.state, 'SWEEP_REJECTION');
  assert.equal(pwhResult.direction, 'BEARISH');

  // 4. PWL (Previous Week Low) sweep rejection
  const pwlResult = classifySweepAcceptance({
    amySmcD: {
      sourceCandle: { close: 2615.00 },
      descriptive: {
        liquidity: {
          rawSweep: { kind: 'PWL', level: 2610.00 }
        }
      }
    }
  });
  assert.equal(pwlResult.state, 'SWEEP_REJECTION');
  assert.equal(pwlResult.direction, 'BULLISH');

  // 5. EQH (Equal Highs) sweep rejection
  const eqhResult = classifySweepAcceptance({
    amySmcD: {
      sourceCandle: { close: 2670.00 },
      descriptive: {
        liquidity: {
          rawSweep: { label: 'EQH', level: 2672.00 }
        }
      }
    }
  });
  assert.equal(eqhResult.state, 'SWEEP_REJECTION');
  assert.equal(eqhResult.direction, 'BEARISH');

  // 6. EQL (Equal Lows) sweep rejection
  const eqlResult = classifySweepAcceptance({
    amySmcD: {
      sourceCandle: { close: 2630.00 },
      descriptive: {
        liquidity: {
          rawSweep: { pool: 'EQL', level: 2628.00 }
        }
      }
    }
  });
  assert.equal(eqlResult.state, 'SWEEP_REJECTION');
  assert.equal(eqlResult.direction, 'BULLISH');
});

test('Item 2.15: createThrottledStatePersister reduces flash storage writes', async () => {
  const store = {};
  const mockStorage = {
    setItem: (key, val) => {
      store[key] = val;
    },
    getItem: (key) => store[key] || null
  };

  const persister = createThrottledStatePersister('test_watch_state', 300, mockStorage);

  // 1. Initial write
  const saved1 = persister.save({ id: 'W1', status: 'WAIT' }, 'sig1', true);
  assert.equal(saved1, true);
  assert.equal(JSON.parse(store['test_watch_state']).status, 'WAIT');

  // 2. Duplicate signature within any timeframe -> ignored
  const savedDup = persister.save({ id: 'W1', status: 'WAIT' }, 'sig1');
  assert.equal(savedDup, false, 'Identical signature must be ignored');

  // 3. Changed signature within minInterval -> throttled
  const savedThrottled = persister.save({ id: 'W1', status: 'TESTING' }, 'sig2', false);
  assert.equal(savedThrottled, false, 'Rapid change should be buffered');

  // Flush writes the pending update
  persister.flush();
  assert.equal(JSON.parse(store['test_watch_state']).status, 'TESTING');
});
