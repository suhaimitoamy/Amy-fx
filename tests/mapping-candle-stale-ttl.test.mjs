import assert from 'node:assert/strict';
import test from 'node:test';

// Setup browser globals before importing modules
const store = new Map();
globalThis.localStorage = {
  getItem: key => store.get(key) || null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: key => store.delete(key),
  clear: () => store.clear()
};

globalThis.window = {
  location: { href: 'http://localhost/' },
  localStorage: globalThis.localStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  AmyFXIntel: { read: () => ({}), write: () => {}, mountStrip: () => {}, mountBriefing: () => {} }
};
globalThis.location = globalThis.window.location;

const createDummyElement = () => ({
  textContent: '',
  innerHTML: '',
  style: {},
  dataset: {},
  classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} },
  querySelector: () => createDummyElement(),
  querySelectorAll: () => [createDummyElement()],
  addEventListener: () => {},
  removeEventListener: () => {},
  setAttribute: () => {},
  getAttribute: () => null
});

globalThis.document = {
  hidden: false,
  querySelector: () => createDummyElement(),
  querySelectorAll: () => [createDummyElement()],
  getElementById: () => createDummyElement(),
  addEventListener: () => {},
  removeEventListener: () => {}
};

const {
  buildSetupExecution,
  buildSetupId,
  isCandleStale,
  setCandleFetchedAt
} = await import('../app/src/main/assets/apps/mapping/js/api/market-data.js');
const {
  notifyImportant,
  sendTargetsToNative
} = await import('../app/src/main/assets/apps/mapping/js/bridge/android-bridge.js');
const { state: appState } = await import('../app/src/main/assets/apps/mapping/js/main.js');
const { entryMapDisplayState } = await import('../app/src/main/assets/apps/mapping/js/ui/entry-map-status.js');

function terminalCausalResult(lifecycleStatus, {
  tp1Hit = false,
  sl = 95,
  endIndex = 120
} = {}) {
  const forecast = {
    active: true,
    invalidated: false,
    expired: false,
    direction: 'BULLISH',
    directionValue: 1,
    startTime: 1_700_000_000,
    startIndex: 90
  };
  const setup = {
    executionMode: 'CAUSAL_ENTRY_MAP_ALL_TF',
    live: false,
    lifecycleStatus,
    tf: 'M5',
    type: 'M5 CAUSAL ENTRY MAP',
    dir: 'BUY',
    direction: 'BULLISH',
    entry: 100,
    entryLow: 100,
    entryHigh: 100,
    initialSl: 95,
    sl,
    tp1: 105,
    tp2: 112,
    tp1Hit,
    tp1Time: tp1Hit ? 1_700_003_600_000 : null,
    timestamp: 1_700_000_000_000,
    endIndex,
    endTime: 1_700_007_200_000,
    targetType: 'BSL',
    singleTarget: false
  };
  return {
    tf: 'M5',
    price: 100,
    validatedMarketContext: { directionForecast: forecast },
    entryMap: { setup, activeSetup: null },
    bestSetup: null
  };
}

test('isCandleStale returns false for valid cache within TTL thresholds', () => {
  const now = Date.now();
  setCandleFetchedAt('M1', now - 1 * 60 * 1000); // 1 min ago (< 2 min)
  setCandleFetchedAt('M15', now - 3 * 60 * 1000); // 3 min ago (< 5 min)
  setCandleFetchedAt('H1', now - 10 * 60 * 1000); // 10 min ago (< 15 min)
  setCandleFetchedAt('D1', now - 120 * 60 * 1000); // 2 hours ago (< 4 hours)

  assert.equal(isCandleStale('M1'), false);
  assert.equal(isCandleStale('1min'), false);
  assert.equal(isCandleStale('M15'), false);
  assert.equal(isCandleStale('15min'), false);
  assert.equal(isCandleStale('H1'), false);
  assert.equal(isCandleStale('1h'), false);
  assert.equal(isCandleStale('D1'), false);
  assert.equal(isCandleStale('1day'), false);
});

test('isCandleStale returns true when cache exceeds TTL limits', () => {
  const now = Date.now();
  setCandleFetchedAt('M1', now - 3 * 60 * 1000); // 3 min ago (> 2 min)
  setCandleFetchedAt('M15', now - 6 * 60 * 1000); // 6 min ago (> 5 min)
  setCandleFetchedAt('H1', now - 16 * 60 * 1000); // 16 min ago (> 15 min)
  setCandleFetchedAt('D1', now - 250 * 60 * 1000); // 250 min ago (> 240 min)

  assert.equal(isCandleStale('M1'), true);
  assert.equal(isCandleStale('1min'), true);
  assert.equal(isCandleStale('M15'), true);
  assert.equal(isCandleStale('15min'), true);
  assert.equal(isCandleStale('H1'), true);
  assert.equal(isCandleStale('1h'), true);
  assert.equal(isCandleStale('D1'), true);
  assert.equal(isCandleStale('1day'), true);
});

test('entryMapDisplayState suppresses signals and returns DATA USANG when cache is stale or API fails', () => {
  const staleSetup = {
    status: 'DATA USANG',
    dataStale: true,
    statusText: 'DATA USANG'
  };

  const state = entryMapDisplayState(staleSetup);
  assert.equal(state.status, 'DATA USANG');
  assert.equal(state.terminal, true);
  assert.equal(state.dataStale, true);
  assert.match(state.note, /DATA USANG/);
  assert.match(state.note, /dinonaktifkan/);
});

test('entryMapDisplayState returns DATA USANG when no setup is available and stale flag is set', () => {
  const state = entryMapDisplayState({ dataStale: true });
  assert.equal(state.status, 'DATA USANG');
  assert.equal(state.terminal, true);
  assert.equal(state.dataStale, true);
});

test('causal runner keeps closed-candle break-even geometry despite stale live lifecycle storage', () => {
  const forecast = {
    active: true,
    invalidated: false,
    expired: false,
    direction: 'BULLISH',
    directionValue: 1,
    startTime: 1_700_000_000
  };
  const bestSetup = {
    executionMode: 'CAUSAL_ENTRY_MAP_ALL_TF',
    live: true,
    tf: 'H4',
    dir: 'BUY',
    direction: 'BULLISH',
    entryLow: 100,
    entryHigh: 100,
    initialSl: 95,
    sl: 100,
    tp1: 105,
    tp2: 112,
    tp1Hit: true,
    tp1Time: 1_700_014_400_000,
    timestamp: 1_700_000_000_000,
    targetType: 'BSL',
    singleTarget: false
  };
  const setupId = buildSetupId(bestSetup, forecast, 'H4');
  localStorage.setItem('amy_mapping_lifecycle_v4', JSON.stringify({
    [setupId]: {
      setupId,
      terminal: true,
      lifecycleStage: 'STOPPED',
      status: 'SL HIT'
    }
  }));

  const execution = buildSetupExecution({
    tf: 'H4',
    price: 104,
    directionDecision: {
      signal: 'BUY',
      source: 'AMY_SMC_D_NEXT_MOVE',
      invalidated: false
    },
    validatedMarketContext: { directionForecast: forecast },
    bestSetup
  }, { persist: false });

  assert.equal(execution.active, true);
  assert.equal(execution.terminal, false);
  assert.equal(execution.lifecycleStage, 'RUNNER_ACTIVE');
  assert.equal(execution.status, 'TP1 HIT / BE');
  assert.equal(execution.initialStopLoss, 95);
  assert.equal(execution.stopLoss, 100);
  assert.equal(execution.authority, 'CLOSED_CANDLE_CAUSAL_ENGINE');
});

test('terminal Causal V3 outcomes pass intact into setupExecution', () => {
  const cases = [
    ['SL HIT', 'STOPPED', false, 95],
    ['TP2 HIT', 'TARGET_HIT', true, 100],
    ['TP1 / BE', 'STOPPED', true, 100],
    ['EXPIRED', 'EXPIRED', false, 95]
  ];

  for (const [status, stage, tp1Hit, sl] of cases) {
    const execution = buildSetupExecution(
      terminalCausalResult(status, { tp1Hit, sl }),
      { persist: false }
    );
    assert.equal(execution.status, status);
    assert.equal(execution.outcome, status);
    assert.equal(execution.lifecycleStage, stage);
    assert.equal(execution.active, false);
    assert.equal(execution.terminal, true);
    assert.equal(execution.entryTouched, true);
    assert.equal(execution.target1Secured, tp1Hit);
    assert.equal(execution.stopLoss, sl);
    assert.equal(execution.initialStopLoss, 95);
    assert.equal(execution.endIndex, 120);
    assert.equal(execution.endTime, 1_700_007_200_000);
    assert.equal(execution.authority, 'CLOSED_CANDLE_CAUSAL_ENGINE');
  }
});

test('terminal Causal V3 outcome reaches notification and stops scanner activation', () => {
  const result = terminalCausalResult('TP1 / BE', {
    tp1Hit: true,
    sl: 100
  });
  result.directionDecision = {
    signal: 'BUY',
    source: 'VALIDATED_DIRECTION_FORECAST',
    invalidated: false
  };
  result.setupExecution = buildSetupExecution(result, { persist: false });
  result.mappingExplanation = { reason: 'Closed-candle lifecycle terminal.' };

  const notifications = [];
  let scannerStarts = 0;
  let scannerStops = 0;
  window.Android = {
    showNotificationWithUrl: (...args) => notifications.push(args),
    startBackgroundScanner: () => { scannerStarts += 1; },
    stopBackgroundScanner: () => { scannerStops += 1; }
  };
  appState.notified = {};
  appState.result = result;

  notifyImportant(result);
  sendTargetsToNative();

  assert.equal(notifications.length, 1);
  assert.match(notifications[0][0], /SETUP BERHENTI/);
  assert.match(notifications[0][1], /TP1 \/ BE/);
  assert.equal(scannerStarts, 0);
  assert.equal(scannerStops, 1);
});
