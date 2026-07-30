import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildAmyExecutionContext,
  buildExecutionPlanViewModel,
  determineExecutionDisplayStatus
} from '../app/src/main/assets/apps/mapping/js/execution-plan-core.js';
import {
  buildExecutionContextEnvelope,
  renderExecutionPlanCompact,
  renderExecutionPlanDetail
} from '../app/src/main/assets/apps/mapping/js/execution-plan-ui.js';

const root = new URL('../', import.meta.url);
const source = relative => readFileSync(new URL(relative, root), 'utf8');
const CANDLE_TIME = Date.UTC(2026, 6, 29, 5, 31);

function officialFixture(side = 'BUY') {
  const buy = side === 'BUY';
  const setupDirection = buy ? 'BULLISH' : 'BEARISH';
  const entry = buy ? 4029.2 : 4043.1;
  const stopLoss = buy ? 4024.6 : 4047.8;
  const tp1 = buy ? 4038.4 : 4033.7;
  const tp2 = buy ? 4047.6 : 4024.3;
  const sweepType = buy ? 'SSL' : 'BSL';
  const targetType = buy ? 'BSL' : 'SSL';
  const setup = {
    id: `official-${side.toLowerCase()}`,
    dir: side,
    direction: setupDirection,
    live: true,
    entry,
    entryLow: entry,
    entryHigh: entry,
    initialSl: stopLoss,
    sl: stopLoss,
    tp1,
    tp2,
    targetR: 4,
    singleTarget: false,
    targetType,
    targetSubtype: 'EXTERNAL',
    entryConfirmedAtClose: true,
    executionMode: 'CAUSAL_ENTRY_MAP_ALL_TF',
    tp1Hit: false
  };
  const requirements = [
    { label: 'DATA', passed: true, detail: '150 closed candles M5' },
    { label: 'DIRECTION', passed: true, detail: side },
    { label: 'OPPOSING LIQUIDITY SWEEP', passed: true, detail: `${sweepType} confirmed` },
    { label: 'DISPLACED MSS', passed: true, detail: `INTERNAL MSS ${setupDirection}` },
    { label: 'HTF ALIGNMENT', passed: true, detail: `H1 aligned` },
    { label: 'EMA STACK', passed: true, detail: 'EMA filters passed' },
    { label: 'DEALING LOCATION', passed: true, detail: buy ? 'DISCOUNT' : 'PREMIUM' },
    { label: 'CLOSE LOCATION', passed: true, detail: 'Close supports direction' },
    { label: 'STRUCTURAL TARGET ≥ 2R', passed: true, detail: `${targetType} available` }
  ];
  const setupExecution = {
    active: true,
    setupId: setup.id,
    direction: side,
    status: 'ENTRY CONFIRMED · CLOSED CANDLE',
    lifecycleStage: 'ENTRY_ACTIVE',
    entryLow: entry,
    entryHigh: entry,
    stopLoss,
    initialStopLoss: stopLoss,
    target1: tp1,
    target2: tp2,
    singleTarget: false,
    entryTouched: true,
    target1Secured: false,
    terminal: false,
    alignedWithForecast: true,
    geometryValid: true,
    invalidated: false,
    invalidationReason: '',
    liquidityTarget: { type: targetType, level: tp2 },
    authority: 'CLOSED_CANDLE_CAUSAL_ENGINE'
  };
  const entryWatch = {
    version: '3.0.0',
    model: 'AMY_CAUSAL_ENTRY_MAP_MONITOR',
    direction: side,
    status: 'ENTRY CONFIRMED',
    lifecycleStage: 'ENTRY_ACTIVE',
    active: true,
    entryAllowed: true,
    terminal: false,
    scenario: null,
    executionPlan: {
      locked: true,
      entry,
      entryLow: entry,
      entryHigh: entry,
      initialSl: stopLoss,
      sl: stopLoss,
      tp1,
      tp2,
      terminal: false,
      tp1Hit: false
    }
  };
  const scenario = {
    tf: 'M5',
    triggerTf: 'M5',
    contextTf: 'H1',
    direction: side,
    status: 'ENTRY CONFIRMED',
    requirements,
    missing: [],
    sweep: { type: sweepType, level: buy ? 4026 : 4046 },
    mss: { scope: 'INTERNAL', direction: setupDirection },
    location: { zone: buy ? 'DISCOUNT' : 'PREMIUM' },
    target: { type: targetType, subtype: 'EXTERNAL', level: tp2, rr: 4 },
    reason: 'Sequence causal lengkap.'
  };
  entryWatch.scenario = scenario;
  const result = {
    tf: 'M5',
    price: entry,
    bsl: buy ? tp2 : 4051,
    ssl: buy ? 4019 : tp2,
    directionDecision: {
      bias: side,
      signal: side,
      source: 'VALIDATED_DIRECTION_FORECAST',
      invalidated: false
    },
    validatedMarketContext: {
      directionForecast: { active: true, direction: setupDirection, invalidated: false, expired: false },
      marketState: { state: buy ? 'UPTREND CONFIRMED' : 'DOWNTREND CONFIRMED', structureTrend: setupDirection }
    },
    htfNarrative: { htfBias: setupDirection },
    st: { localTrend: setupDirection },
    premiumDiscountZone: buy ? 'DISCOUNT' : 'PREMIUM',
    entryMap: {
      source: 'AMY_CAUSAL_ENTRY_MAP_V3',
      setup,
      activeSetup: setup,
      scenario
    },
    entryWatch,
    setupExecution
  };
  result.mappingSnapshot = {
    source: 'AMY_MAPPING_SINGLE_AUTHORITY_V3',
    timeframe: 'M5',
    sourceCandle: { time: CANDLE_TIME, isClosed: true },
    data: { stale: false, closedCandleOnly: true },
    facts: {
      structure: { localTrend: setupDirection, confirmedTrend: setupDirection },
      liquidity: { bsl: result.bsl, ssl: result.ssl }
    },
    context: {
      directionDecision: result.directionDecision,
      directionForecast: result.validatedMarketContext.directionForecast,
      marketState: result.validatedMarketContext.marketState,
      htfNarrative: result.htfNarrative
    },
    scenario,
    execution: setupExecution,
    freshness: { state: 'CLOSED_CANDLE', sourceCandleTime: CANDLE_TIME, analyzedAt: CANDLE_TIME },
    liveOverlay: { price: entry, provisional: true, mayRewriteClosedCandleFacts: false },
    authority: { entry: 'AMY_CAUSAL_ENTRY_MAP_V3', uiMayMutate: false }
  };
  return {
    result,
    setup,
    setupExecution,
    entryWatch,
    scenario,
    expected: { side, entry, stopLoss, tp1, tp2, rr: 4 }
  };
}

function waitFixture(side = 'BUY') {
  const fixture = officialFixture(side);
  const buy = side === 'BUY';
  fixture.result.entryMap.setup = null;
  fixture.result.entryMap.activeSetup = null;
  fixture.result.entryMap.scenario.status = 'MENUNGGU OPPOSING LIQUIDITY SWEEP';
  fixture.result.entryMap.scenario.requirements = fixture.result.entryMap.scenario.requirements.map(item => (
    ['OPPOSING LIQUIDITY SWEEP', 'DISPLACED MSS', 'HTF ALIGNMENT', 'EMA STACK', 'DEALING LOCATION', 'CLOSE LOCATION', 'STRUCTURAL TARGET ≥ 2R'].includes(item.label)
      ? { ...item, passed: false, detail: item.label === 'OPPOSING LIQUIDITY SWEEP' ? 'Belum ada sweep terkonfirmasi' : `Menunggu ${item.label}` }
      : item
  ));
  fixture.result.entryMap.scenario.missing = fixture.result.entryMap.scenario.requirements
    .filter(item => !item.passed)
    .map(item => item.label);
  fixture.result.entryMap.scenario.sweep = null;
  fixture.result.entryMap.scenario.mss = null;
  fixture.result.entryMap.scenario.target = null;
  fixture.result.entryMap.scenario.poi = null;
  fixture.result.entryWatch = {
    ...fixture.result.entryWatch,
    status: 'MENUNGGU OPPOSING LIQUIDITY SWEEP',
    lifecycleStage: 'WAITING_CONFIRMATION',
    active: true,
    entryAllowed: false,
    terminal: false,
    scenario: fixture.result.entryMap.scenario,
    executionPlan: null
  };
  fixture.result.setupExecution = {
    active: false,
    setupId: '',
    direction: side,
    status: 'WAITING FOR SETUP',
    lifecycleStage: 'WAITING_ENTRY',
    entryLow: null,
    entryHigh: null,
    stopLoss: null,
    target1: null,
    target2: null,
    singleTarget: true,
    entryTouched: false,
    target1Secured: false,
    terminal: true,
    alignedWithForecast: true,
    geometryValid: false,
    invalidated: false,
    invalidationReason: 'Belum ada setup Entry Map yang lolos seluruh filter.'
  };
  fixture.result.mappingSnapshot = {
    ...fixture.result.mappingSnapshot,
    scenario: fixture.result.entryMap.scenario,
    execution: fixture.result.setupExecution,
    facts: {
      ...fixture.result.mappingSnapshot.facts,
      structure: {
        localTrend: buy ? 'BEARISH' : 'BULLISH',
        confirmedTrend: buy ? 'BEARISH' : 'BULLISH'
      }
    }
  };
  return fixture;
}

function build(fixture, overrides = {}) {
  return buildExecutionPlanViewModel({
    result: fixture.result,
    mappingFreshness: { state: 'FRESH' },
    conflicts: [],
    ...overrides
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

test('BUY only comes from the complete official BUY setup', () => {
  const fixture = officialFixture('BUY');
  const vm = build(fixture);
  assert.equal(vm.decision, 'BUY');
  assert.equal(vm.authoritySource, 'setupExecution');
  assert.equal(vm.entryWatchStage, 'ENTRY_ACTIVE');

  fixture.result.directionDecision = { ...fixture.result.directionDecision, bias: 'SELL', signal: 'SELL' };
  assert.equal(build(fixture).decision, 'WAIT');

  const conflicting = officialFixture('BUY');
  assert.equal(build(conflicting, { conflicts: [{ note: 'Official context conflict' }] }).decision, 'WAIT');
});

test('SELL only comes from the complete official SELL setup', () => {
  const fixture = officialFixture('SELL');
  const vm = build(fixture);
  assert.equal(vm.decision, 'SELL');
  assert.equal(vm.focusDirection, 'SELL');

  fixture.result.entryMap.setup = { ...fixture.result.entryMap.setup, dir: 'BUY', direction: 'BULLISH' };
  assert.equal(build(fixture).decision, 'WAIT');
});

test('incomplete setup is WAIT and explains the next official requirements', () => {
  const vm = build(waitFixture('BUY'));
  assert.equal(vm.decision, 'WAIT');
  assert.match(vm.headline, /BELUM ADA ENTRY VALID/);
  assert.ok(vm.waitingFor.length >= 2);
  assert.match(vm.waitingFor[0], /SSL/i);
  assert.match(vm.waitingFor.join(' '), /MSS/i);
  assert.match(vm.lifecycleLabel, /liquidity sweep/i);
});

test('no setup never creates entry, Stop Loss, targets, RR, or invalidation price', () => {
  const vm = build(waitFixture('SELL'));
  assert.equal(vm.entry, null);
  assert.equal(vm.entryLow, null);
  assert.equal(vm.entryHigh, null);
  assert.equal(vm.stopLoss, null);
  assert.equal(vm.tp1, null);
  assert.equal(vm.tp2, null);
  assert.equal(vm.rr, null);
  assert.doesNotMatch(vm.invalidation, /\d{3,}/);
});

test('entry, SL, TP1, TP2, and RR retain the exact official values', () => {
  const fixture = officialFixture('BUY');
  const vm = build(fixture);
  assert.equal(vm.entry, fixture.expected.entry);
  assert.equal(vm.stopLoss, fixture.expected.stopLoss);
  assert.equal(vm.tp1, fixture.expected.tp1);
  assert.equal(vm.tp2, fixture.expected.tp2);
  assert.equal(vm.rr, fixture.expected.rr);
});

test('setupExecution has priority over entryMap.setup for the fields it owns', () => {
  const fixture = officialFixture('BUY');
  fixture.result.setupExecution = {
    ...fixture.result.setupExecution,
    entryLow: 4028.8,
    entryHigh: 4029.4,
    stopLoss: 4023.9,
    target1: 4039.1,
    target2: 4048.2,
    liquidityTarget: { type: 'BSL', level: 4048.2 }
  };
  const vm = build(fixture);
  assert.equal(vm.entryLow, 4028.8);
  assert.equal(vm.entryHigh, 4029.4);
  assert.equal(vm.stopLoss, 4023.9);
  assert.equal(vm.tp1, 4039.1);
  assert.equal(vm.tp2, 4048.2);
  assert.equal(vm.entry, fixture.result.entryMap.setup.entry);
});

test('RR is copied from the official setup and is not recomputed from levels', () => {
  const fixture = officialFixture('SELL');
  fixture.result.entryMap.setup.targetR = 2.37;
  fixture.result.entryMap.scenario.target.rr = 9.99;
  assert.equal(build(fixture).rr, 2.37);
  const core = source('app/src/main/assets/apps/mapping/js/execution-plan-core.js');
  assert.doesNotMatch(core, /(?:tp1|tp2)\s*-\s*(?:entry|stopLoss)|(?:entry|stopLoss)\s*-\s*(?:tp1|tp2)/);
});

test('STALE and EXPIRED freshness can never expose an active BUY or SELL', () => {
  const buy = officialFixture('BUY');
  const stale = build(buy, { mappingFreshness: { state: 'STALE' } });
  const expired = build(buy, { mappingFreshness: { state: 'EXPIRED' } });
  assert.equal(stale.decision, 'WAIT');
  assert.equal(stale.headline, 'WAIT — DATA MAPPING SUDAH LAMA');
  assert.equal(stale.entry, null);
  assert.equal(stale.stopLoss, null);
  assert.equal(stale.area.level, null);
  assert.equal(expired.decision, 'WAIT');
  assert.equal(expired.headline, 'WAIT — ANALISIS KEDALUWARSA');
  assert.equal(expired.tp1, null);
  assert.equal(expired.tp2, null);
});

test('terminal and post-TP1 lifecycle outcomes are always WAIT', () => {
  const terminalCases = [
    ['SL HIT', 'WAIT — SETUP SELESAI'],
    ['TP2 HIT', 'WAIT — TARGET AKHIR TERCAPAI'],
    ['TP1 / BE', 'WAIT — SETUP SELESAI'],
    ['EXPIRED', 'WAIT — SETUP KEDALUWARSA'],
    ['INVALID', 'WAIT — SETUP TIDAK VALID'],
    ['LEVEL_RETIRED', 'WAIT — LEVEL TIDAK LAGI AKTIF']
  ];
  for (const [status, headline] of terminalCases) {
    const fixture = officialFixture('BUY');
    fixture.result.entryMap.setup = {
      ...fixture.result.entryMap.setup,
      live: false,
      lifecycleStatus: status
    };
    fixture.result.entryWatch = {
      ...fixture.result.entryWatch,
      status,
      terminal: true,
      active: false,
      entryAllowed: false,
      executionPlan: { ...fixture.result.entryWatch.executionPlan, terminal: true }
    };
    fixture.result.setupExecution = {
      ...fixture.result.setupExecution,
      active: false,
      status,
      lifecycleStage: status === 'TP2 HIT' ? 'TARGET_HIT' : status === 'EXPIRED' ? 'EXPIRED' : 'STOPPED',
      terminal: true
    };
    const vm = build(fixture);
    assert.equal(vm.decision, 'WAIT', status);
    assert.equal(vm.headline, headline, status);
    assert.equal(vm.entry, null, status);
    assert.equal(vm.stopLoss, null, status);
  }

  const runner = officialFixture('SELL');
  runner.result.entryMap.setup.tp1Hit = true;
  runner.result.entryWatch.status = 'TP1 HIT / BE';
  runner.result.entryWatch.lifecycleStage = 'RUNNER_ACTIVE';
  runner.result.entryWatch.executionPlan.tp1Hit = true;
  runner.result.setupExecution.status = 'TP1 HIT / BE';
  runner.result.setupExecution.lifecycleStage = 'RUNNER_ACTIVE';
  runner.result.setupExecution.target1Secured = true;
  assert.equal(build(runner).decision, 'WAIT');
});

test('ENTRY_ACTIVE / ENTRY CONFIRMED is the official ENTRY_TRIGGERED equivalent', () => {
  const fixture = officialFixture('BUY');
  const display = determineExecutionDisplayStatus({
    result: fixture.result,
    mappingFreshness: { state: 'FRESH' }
  });
  assert.equal(display.entryTriggered, true);
  assert.equal(display.decision, 'BUY');

  fixture.result.entryWatch.lifecycleStage = 'WAITING_CONFIRMATION';
  fixture.result.setupExecution.lifecycleStage = 'WAITING_ENTRY';
  fixture.result.setupExecution.status = 'WAITING FOR SETUP';
  fixture.result.entryWatch.status = 'WAITING_CONFIRMATION';
  assert.equal(build(fixture).decision, 'WAIT');
});

test('execution plan is read-only for Mapping and Entry Watch objects', () => {
  const fixture = officialFixture('BUY');
  const beforeResult = JSON.stringify(fixture.result);
  const beforeWatch = JSON.stringify(fixture.result.entryWatch);
  deepFreeze(fixture.result);
  const vm = build(fixture);
  assert.equal(vm.decision, 'BUY');
  assert.equal(JSON.stringify(fixture.result), beforeResult);
  assert.equal(JSON.stringify(fixture.result.entryWatch), beforeWatch);
  assert.equal(Object.isFrozen(vm), true);
  assert.equal(Object.isFrozen(vm.checks), true);
});

test('execution feature creates no API request and no polling or timer', () => {
  const core = source('app/src/main/assets/apps/mapping/js/execution-plan-core.js');
  const ui = source('app/src/main/assets/apps/mapping/js/execution-plan-ui.js');
  for (const text of [core, ui]) {
    assert.doesNotMatch(text, /\bfetch\s*\(/);
    assert.doesNotMatch(text, /\bXMLHttpRequest\b/);
    assert.doesNotMatch(text, /\bsetInterval\s*\(/);
    assert.doesNotMatch(text, /\bsetTimeout\s*\(/);
  }
});

test('Dashboard and Analysis each render one stable execution-plan card', () => {
  const vm = build(waitFixture('BUY'));
  const compact = renderExecutionPlanCompact(vm);
  const detail = renderExecutionPlanDetail(vm);
  assert.equal((compact.match(/id="amy-execution-plan-compact"/g) || []).length, 1);
  assert.equal((detail.match(/id="amy-execution-plan-detail"/g) || []).length, 1);
  assert.match(compact, /data-execution-plan-fingerprint/);
  assert.match(detail, /data-execution-plan-fingerprint/);

  const ui = source('app/src/main/assets/apps/mapping/js/execution-plan-ui.js');
  assert.match(ui, /scrollTop/);
  assert.match(ui, /executionPlanFingerprint/);
  assert.doesNotMatch(ui, /insertAdjacentHTML|appendChild\(.*execution/i);
});

test('Analysis order keeps Rencana Eksekusi directly above Penjelasan Mapping', () => {
  const ui = source('app/src/main/assets/apps/mapping/js/ui/ui-render.js');
  const asiaUi = source('app/src/main/assets/apps/mapping/js/session/asia-range-ui.js');
  assert.match(
    ui,
    /\$\{executionPlan\}<details class="card disclosure" data-stability-key="mapping-explanation"><summary>Penjelasan Mapping<\/summary>\$\{plainMappingExplanation\(\)\}/
  );
  assert.match(ui, /export function plainMappingExplanation/);
  assert.match(ui, /Apa yang Sedang Terjadi\?/);
  assert.match(asiaUi, /state\.tab !== 'Analyze'/);
  assert.match(asiaUi, /summary'\)\?\.textContent\?\.trim\(\) === 'Penjelasan Mapping'/);
  assert.match(asiaUi, /anchor\.insertAdjacentElement\('afterend', strip\)/);
});

test('Amy receives the exact same decision and official levels as the card', () => {
  const vm = build(officialFixture('SELL'));
  const context = buildAmyExecutionContext(vm);
  const envelope = buildExecutionContextEnvelope(vm);
  assert.equal(context.decision, vm.decision);
  assert.equal(context.entry, vm.entry);
  assert.equal(context.stopLoss, vm.stopLoss);
  assert.equal(context.tp1, vm.tp1);
  assert.equal(context.tp2, vm.tp2);
  assert.equal(context.rr, vm.rr);
  assert.deepEqual(envelope.payload.execution_plan, context);
  assert.equal(envelope.source_module, 'mapping');
  assert.equal(envelope.payload.feature, 'execution_plan');
});

test('Amy execution context contains no API key, secret, token, or signing field', () => {
  const envelope = buildExecutionContextEnvelope(build(waitFixture('BUY')));
  const forbidden = /api.?key|secret|token|password|credential|authorization|keystore|signing|private.?key/i;
  function keys(value) {
    if (Array.isArray(value)) return value.flatMap(keys);
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, child]) => [key, ...keys(child)]);
  }
  assert.equal(keys(envelope).some(key => forbidden.test(key)), false);
});

test('Amy Bot execution-plan path preserves WAIT and never invokes a competing answer', () => {
  const handler = source('app/src/main/assets/apps/shared/amyfx-professional-bot-handler-lock-v1.js');
  assert.match(handler, /executionPlanAnswer/);
  assert.match(handler, /Keputusan Rencana Eksekusi tetap WAIT/);
  assert.match(handler, /Amy tidak mengubah arah Mapping/);
  assert.match(handler, /Saya tidak membuat level atau sinyal baru/);
  assert.match(handler, /mapping-execution-plan-read-only-v1/);
});

test('context button forwards its structured envelope through universal Mentor access', () => {
  const ui = source('app/src/main/assets/apps/mapping/js/execution-plan-ui.js');
  const mentor = source('app/src/main/assets/apps/shared/amyfx-mentor-universal-access-v1.js');
  assert.match(ui, /AmyFXUniversalContext\.submit\(question,\s*\{\s*sourceModule:\s*'mapping',\s*context/s);
  assert.match(mentor, /submitUniversal\(questionOverride = "", options = \{\}\)/);
  assert.match(mentor, /context:\s*options\.context \|\| undefined/);
});
