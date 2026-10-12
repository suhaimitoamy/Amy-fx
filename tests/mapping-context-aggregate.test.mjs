import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMappingContextAggregate } from '../app/src/main/assets/apps/mapping/js/engine/mapping-context-aggregator.js';
import { classifySweepAcceptance } from '../app/src/main/assets/apps/mapping/js/engine/sweep-acceptance.js';
import { classifyXauDxySmt } from '../app/src/main/assets/apps/mapping/js/engine/smt-selector.js';

function m15(time, open, high, low, close) {
  return { open_time: time, close_time: time + 900, open, high, low, close, is_closed: true };
}

function baseResult() {
  return {
    tf: 'M15',
    sourceCandleTime: 1_700_000_900,
    sourceCandle: { time: 1_700_000_000, open: 100, high: 103, low: 96, close: 101 },
    bsl: 110,
    ssl: 95,
    liquidityHierarchy: { drawTarget: { type: 'BSL', level: 110 } },
    amySmcD: {
      ready: true,
      tf: 'M15',
      sourceCandle: { time: 1_700_000_000, open: 100, high: 103, low: 96, close: 101 },
      descriptive: {
        htfSwing: { direction: 'BULLISH' },
        swingStructure: { direction: 'BULLISH' },
        internalStructure: { direction: 'BEARISH' },
        liquidity: { active: true, direction: 'BULLISH', side: 'SSL', level: 95, rawSweep: null },
        dealingRange: { location: 'DISCOUNT' },
        pattern: { name: 'NONE', direction: 'NEUTRAL' },
        finalBias: { direction: 'BULLISH', directionValue: 1 },
        eventHistory: [{ kind: 'BOS BULL', direction: 1, level: 102 }]
      },
      predictive: {
        nextMove: { direction: 'BULLISH', signal: 'BUY' },
        sweepContinuation: { active: false, direction: 'NEUTRAL' },
        rawValidBreak: null,
        qualifiedValidBreak: null,
        qualifiedChoch: null,
        qualifiedBos: null,
        rawPattern: { active: false, name: 'NONE', direction: 'NEUTRAL' },
        qualifiedPattern: { active: false, name: 'NONE', direction: 'NEUTRAL' }
      },
      levels: { bsl: 110, ssl: 95, bullishInvalidation: 93, bearishInvalidation: 112 },
      raw: { predictiveEvents: [], structureEvents: [{ kind: 'BOS', direction: 1, level: 102 }] }
    },
    executionSupport: {
      nearestFairValueGaps: [{ direction: 'BULLISH', bottom: 97, top: 99, status: 'DETECTED' }],
      nearestOrderBlocks: [{ direction: 'BULLISH', bottom: 95.5, top: 97, status: 'DETECTED' }],
      previousPeriods: { pdh: 108, pdl: 94, pwh: 115, pwl: 90 },
      contextEnhancements: {
        strongWeak: { summary: 'Strong Low 93.00 bertahan; Weak High 110.00 menjadi draw liquidity.' },
        monthlySnapshot: { pmh: 120, pml: 88 },
        midnightOpen: { summary: 'Midnight Open 99.50 tersedia.' },
        adaptiveEqualHighLow: { eqh: [{ level: 109 }], eql: [{ level: 95 }] }
      }
    },
    entryMap: { scenario: { status: 'WAITING_CONFIRMATION', reason: 'Menunggu bullish MSS + first retest.', direction: 'BUY' }, setup: null, activeSetup: null },
    entryWatch: { status: 'WAITING_CONFIRMATION', reason: 'Menunggu bullish MSS + first retest.', entryAllowed: false }
  };
}

test('WAIT only blocks entry; continuous Mapping context remains populated', () => {
  const result = baseResult();
  const aggregate = buildMappingContextAggregate(result, {
    smt: { state: 'SMT_BEARISH', direction: 'BEARISH', authority: 'EVIDENCE_ONLY', entryAuthority: false, mayOverrideMapping: false }
  });
  assert.equal(aggregate.marketState.state, 'BULLISH_PULLBACK');
  assert.equal(aggregate.context.htfSwing, 'BULLISH');
  assert.equal(aggregate.context.dealingRange, 'DISCOUNT');
  assert.equal(aggregate.locations.fvg.status, 'DETECTED');
  assert.equal(aggregate.predictive.nextMoveSignal, 'BUY');
  assert.equal(aggregate.entryReadiness.action, 'WAIT');
  assert.match(aggregate.entryReadiness.reason, /MSS/i);
  assert.ok(Object.keys(aggregate.facts).length > 10);
  assert.ok(aggregate.evidence.length >= 15);
  assert.equal(aggregate.authorityContract.contextMayOpenEntry, false);
  assert.equal(aggregate.authorityContract.outlookMayOpenEntry, false);
});

test('SMT is evidence-only and cannot override Final Bias or Next Move', () => {
  const aggregate = buildMappingContextAggregate(baseResult(), {
    smt: { state: 'SMT_BEARISH', direction: 'BEARISH', authority: 'EVIDENCE_ONLY', entryAuthority: false, mayOverrideMapping: false }
  });
  assert.equal(aggregate.predictive.finalBias, 'BULLISH');
  assert.equal(aggregate.predictive.nextMove, 'BULLISH');
  assert.equal(aggregate.predictive.smt.state, 'SMT_BEARISH');
  assert.equal(aggregate.authorityContract.smtMayOverrideMapping, false);
});

test('Sweep vs Acceptance reports context without opening an entry', () => {
  const state = classifySweepAcceptance({
    amySmcD: {
      sourceCandle: { close: 101 },
      descriptive: { liquidity: { rawSweep: { side: 'SSL', level: 100, direction: 'BULLISH' } } },
      predictive: {}
    }
  });
  assert.equal(state.state, 'SWEEP_REJECTION');
  assert.equal(state.entryAuthority, false);
  assert.equal(state.authority, 'CONTEXT_ONLY');
});

test('same-completed-bar SMT produces bullish divergence when XAU sweeps low and DXY fails inverse high', () => {
  const base = 1_700_000_000;
  const xau = [
    m15(base + 0 * 900, 100, 101, 99, 100),
    m15(base + 1 * 900, 100, 103, 99.5, 101),
    m15(base + 2 * 900, 101, 102, 98.5, 100),
    m15(base + 3 * 900, 100, 102, 97, 98),
    m15(base + 4 * 900, 98, 101, 98, 100),
    m15(base + 5 * 900, 100, 101, 96.5, 97.5)
  ];
  const dxy = [
    m15(base + 0 * 900, 100, 101, 99, 100),
    m15(base + 1 * 900, 100, 105, 99.5, 102),
    m15(base + 2 * 900, 102, 103, 98.5, 101),
    m15(base + 3 * 900, 101, 103, 97, 99),
    m15(base + 4 * 900, 99, 102, 98, 101),
    m15(base + 5 * 900, 101, 104, 99, 102)
  ];
  const smt = classifyXauDxySmt({ xauM15: xau, dxyM15: dxy });
  assert.equal(smt.state, 'SMT_BULLISH');
  assert.equal(smt.direction, 'BULLISH');
  assert.equal(smt.entryAuthority, false);
  assert.equal(smt.mayOverrideMapping, false);
});
