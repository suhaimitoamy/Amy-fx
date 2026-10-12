import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const base = new URL('../app/src/main/assets/apps/academy/trading-practice/assets/js/', import.meta.url);
const context = { console, setInterval, clearInterval, setTimeout, clearTimeout };
context.globalThis = context;
vm.createContext(context);

const load = name => vm.runInContext(readFileSync(new URL(name, base), 'utf8'), context, { filename: name });
load('practice-core.js');
context.AmyPracticeStorage = { identifier: prefix => `${prefix}-test` };
load('trade-engine.js');
load('drawing-core.js');
load('replay-engine.js');

const minuteCandles = Array.from({ length: 12 }, (_, index) => ({
  time: index * 60,
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100.5 + index
}));

test('normalization excludes open and synthetic candles', () => {
  const items = [
    { ...minuteCandles[0], isClosed: false },
    { ...minuteCandles[1], synthetic: true },
    minuteCandles[2]
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(context.AmyPracticeCore.normalizeCandles(items))), [minuteCandles[2]]);
});

test('aggregation filters source rows before building a partial higher-timeframe candle', () => {
  const visible = context.AmyPracticeCore.visibleCandles(minuteCandles, 180, 'M5', 'M1');
  assert.equal(visible.length, 1);
  assert.equal(visible[0].time, 0);
  assert.equal(visible[0].lastSourceTime, 180);
  assert.equal(visible[0].close, minuteCandles[3].close);
  assert.ok(visible.every(candle => candle.time <= 180 && candle.lastSourceTime <= 180));
});

test('replay keeps one timestamp cursor across timeframe switches with no future rows', async () => {
  const core = context.AmyPracticeCore;
  const provider = {
    async getTimeline({ timeframe }) {
      return core.aggregateCandles(minuteCandles, timeframe, { sourceTimeframe: 'M1' }).map(candle => candle.lastSourceTime ?? candle.time);
    },
    async getCandles({ timeframe, cursor }) {
      return { source: 'test', sampleOnly: true, candles: core.visibleCandles(minuteCandles, cursor, timeframe, 'M1') };
    }
  };
  const controller = new context.AmyReplayEngine.ReplayController({ provider, timeframe: 'M1' });
  const first = await controller.start(180);
  assert.equal(first.cursor, 180);
  const switched = await controller.setTimeframe('M5');
  assert.equal(switched.cursor, 180);
  assert.ok(switched.candles.every(candle => candle.time <= switched.cursor));
  assert.equal(switched.candles.at(-1).lastSourceTime, 180);
  const advanced = await controller.move(1);
  assert.equal(advanced.cursor, 240, 'the next step after a cross-timeframe partial cursor must not be skipped');
  assert.equal(advanced.candles.at(-1).lastSourceTime, 240);
});

test('manual trade resolves only from later candles and chooses SL on an ambiguous bar', () => {
  const trade = context.AmyPracticeTrades.create({
    symbol: 'XAUUSD', timeframe: 'M1', tradeTime: 60, replayStartTime: 0,
    bias: 'BUY', entry: 101, stopLoss: 99, takeProfit: 103, currentPrice: 100
  });
  const result = context.AmyPracticeTrades.evaluate(trade, [
    { time: 60, open: 100, high: 104, low: 98, close: 102 },
    { time: 120, open: 101, high: 104, low: 98, close: 100 }
  ]);
  assert.equal(result.result, 'LOSS');
  assert.equal(result.closedAt, 120);
  assert.equal(result.resolution, 'SL_FIRST_AMBIGUOUS_CANDLE');
  assert.equal(result.r, -1);
  assert.deepEqual(JSON.parse(JSON.stringify(result.outcomeEvidence)), {
    type: 'SL', level: 99, candleTime: 120, candleHigh: 104, candleLow: 98, ambiguous: true
  });
});

test('winning replay trade records auditable TP candle evidence', () => {
  const trade = context.AmyPracticeTrades.create({
    symbol: 'XAUUSD', timeframe: 'M1', tradeTime: 60,
    bias: 'BUY', entry: 101, stopLoss: 99, takeProfit: 103, currentPrice: 101
  });
  const result = context.AmyPracticeTrades.evaluate(trade, [
    { time: 120, open: 101, high: 103.5, low: 100.5, close: 103 }
  ]);
  assert.equal(result.result, 'WIN');
  assert.deepEqual(JSON.parse(JSON.stringify(result.outcomeEvidence)), {
    type: 'TP', level: 103, candleTime: 120, candleHigh: 103.5, candleLow: 100.5, ambiguous: false
  });
});

test('historical and live candles merge continuously, update same bucket, deduplicate, and order', () => {
  const historical = minuteCandles.slice(0, 3);
  let merged = context.AmyPracticeCore.mergeCandleSeries(historical, [minuteCandles[3], minuteCandles[4], minuteCandles[3]]);
  assert.deepEqual(Array.from(merged, candle => candle.time), [0, 60, 120, 180, 240]);
  const replacement = { ...minuteCandles[4], high: 999, close: 200 };
  const result = context.AmyPracticeCore.upsertLatestCandle(merged, replacement);
  assert.equal(result.action, 'UPDATED');
  assert.equal(result.candles.length, 5);
  assert.equal(result.candles.at(-1).high, 999);

  const ignored = context.AmyPracticeCore.upsertLatestCandle(result.candles, { ...minuteCandles[2], high: 777 });
  assert.equal(ignored.action, 'IGNORED_OLDER');
  assert.equal(ignored.candles.at(-1).high, 999);
  assert.deepEqual(Array.from(ignored.candles, candle => candle.time), [0, 60, 120, 180, 240]);

  const liveBuffer = merged.slice();
  const appended = context.AmyPracticeCore.upsertLatestCandle(liveBuffer, minuteCandles[5], { trustedSeries: true, mutate: true });
  assert.equal(appended.candles, liveBuffer, 'trusted live ticks update the existing buffer without copying the full historical pack');
  assert.equal(liveBuffer.at(-1).time, 300);
});

test('historical OHLC wins on an overlapping native/live context timestamp', () => {
  const historical = minuteCandles.slice(0, 3);
  const overlap = { ...minuteCandles[2], high: 999, close: 998 };
  const merged = context.AmyPracticeCore.mergeCandleSeries(historical, [overlap, minuteCandles[3]]);
  assert.equal(merged.length, 4);
  assert.equal(merged[2].high, minuteCandles[2].high);
  assert.equal(merged[2].close, minuteCandles[2].close);

  const liveOverlap = context.AmyPracticeCore.upsertLatestCandle(merged, overlap, { immutableThrough: minuteCandles[2].time });
  assert.equal(liveOverlap.action, 'IGNORED_HISTORICAL');
  assert.equal(liveOverlap.candles[2].high, minuteCandles[2].high);
});

test('tick aggregation can seed and update the last historical timeframe candle', () => {
  const aggregator = new context.AmyPracticeCore.TickAggregator('M1');
  aggregator.seed({ time: 120, open: 100, high: 101, low: 99, close: 100 });
  assert.equal(aggregator.push({ timestamp: 60, price: 500 }), null, 'a stale reconnect tick must not rewind the active bucket');
  const update = aggregator.push({ timestamp: 150, price: 102 });
  assert.equal(update.closed, null);
  assert.equal(update.current.time, 120);
  assert.equal(update.current.open, 100);
  assert.equal(update.current.high, 102);
});

test('drawing model stores TIME + PRICE and remains stable across screen transforms', () => {
  const drawing = context.AmyPracticeDrawing.create('trend', [{ time: 60, price: 100 }, { time: 180, price: 110 }]);
  assert.ok(drawing);
  const moved = context.AmyPracticeDrawing.move(drawing, 60, -5);
  assert.deepEqual(JSON.parse(JSON.stringify(moved.points)), [{ time: 120, price: 95 }, { time: 240, price: 105 }]);
  assert.equal(context.AmyPracticeDrawing.requiredPoints('parallelChannel'), 3);
  assert.equal(context.AmyPracticeDrawing.requiredPoints('fibonacci'), 2);
});

test('every required drawing tool creates a valid TIME + PRICE model', () => {
  const model = context.AmyPracticeDrawing;
  const points = [
    { time: 60, price: 4101.25 },
    { time: 180, price: 4112.75 },
    { time: 240, price: 4094.5 }
  ];
  for (const type of model.SUPPORTED) {
    const count = model.requiredPoints(type);
    const drawing = model.create(type, points.slice(0, count), { text: 'Area reaksi' });
    assert.ok(drawing, `${type} should create a drawing`);
    assert.equal(drawing.type, type);
    assert.equal(drawing.points.length, count);
    assert.ok(drawing.points.every(point => Number.isFinite(point.time) && Number.isFinite(point.price)));
  }
  const position = model.create('longPosition', points);
  assert.equal(model.positionStats(position).entry, 4101.25);
});

test('locked replay decision gets a stable cursor/source identity and WAIT needs no levels', () => {
  const first = context.AmyPracticeTrades.create({ symbol: 'XAUUSD', timeframe: 'M15', sourceId: 'pack-a', tradeTime: 900, bias: 'WAIT', lockDecision: true });
  const second = context.AmyPracticeTrades.create({ symbol: 'XAUUSD', timeframe: 'M15', sourceId: 'pack-a', tradeTime: 900, bias: 'WAIT', lockDecision: true });
  assert.equal(first.id, second.id);
  assert.equal(first.entryStatus, 'NOT_APPLICABLE');
  assert.equal(first.locked, true);
});

test('locked decision persists, can be read after runtime reload, and history consumes stored trades', async () => {
  const shared = new Map();
  const localStorage = {
    getItem: key => shared.has(key) ? shared.get(key) : null,
    setItem: (key, value) => shared.set(key, String(value)),
    removeItem: key => shared.delete(key)
  };
  const createRuntime = () => {
    const runtime = { console, localStorage, setTimeout, clearTimeout };
    runtime.globalThis = runtime;
    vm.createContext(runtime);
    const run = name => vm.runInContext(readFileSync(new URL(name, base), 'utf8'), runtime, { filename: name });
    run('practice-core.js');
    run('storage.js');
    run('trade-engine.js');
    return runtime;
  };

  const firstRuntime = createRuntime();
  const record = firstRuntime.AmyPracticeTrades.create({
    symbol: 'XAUUSD', timeframe: 'M15', sourceId: 'pack-july-2026', tradeTime: 1_786_000_000,
    replayStartTime: 1_785_999_100, bias: 'WAIT', notes: 'No setup', lockDecision: true
  });
  await firstRuntime.AmyPracticeStorage.saveTrade(record);
  assert.equal((await firstRuntime.AmyPracticeStorage.getTrade(record.id)).tradeTime, record.tradeTime);

  const restartedRuntime = createRuntime();
  const restored = await restartedRuntime.AmyPracticeStorage.getTrade(record.id);
  assert.equal(restored.id, record.id);
  assert.equal(restored.bias, 'WAIT');
  assert.equal((await restartedRuntime.AmyPracticeStorage.listTrades()).length, 1);

  const historySource = readFileSync(new URL('../app/src/main/assets/apps/academy/trading-practice/assets/js/backtest-history.js', import.meta.url), 'utf8');
  assert.match(historySource, /AmyPracticeStorage\.listTrades\(\)/);
  assert.match(historySource, /history-lock/);
});

test('IndexedDB write resolves only after the transaction commit event', async () => {
  const state = {};
  const indexedDB = {
    open() {
      state.openRequest = {};
      return state.openRequest;
    }
  };
  const runtime = { console, indexedDB, localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout };
  runtime.globalThis = runtime;
  vm.createContext(runtime);
  const run = name => vm.runInContext(readFileSync(new URL(name, base), 'utf8'), runtime, { filename: name });
  run('practice-core.js');
  run('storage.js');

  let resolved = false;
  const saving = runtime.AmyPracticeStorage.saveTrade({ id: 'commit-test', createdAt: 1 }).then(() => { resolved = true; });
  state.openRequest.result = {
    objectStoreNames: { contains: () => true },
    transaction() {
      state.transaction = {
        objectStore() {
          return {
            put() {
              state.operationRequest = {};
              return state.operationRequest;
            }
          };
        },
        abort() {}
      };
      return state.transaction;
    }
  };
  state.openRequest.onsuccess();
  await new Promise(resolve => setImmediate(resolve));
  state.operationRequest.result = 'commit-test';
  state.operationRequest.onsuccess();
  await Promise.resolve();
  assert.equal(resolved, false, 'request success alone must not report a durable save');
  state.transaction.oncomplete();
  await saving;
  assert.equal(resolved, true);
});

test('fallback trade remains readable and newer outcomes win over stale IndexedDB records', async () => {
  const shared = new Map();
  let primary;
  const runtime = {
    console,
    localStorage: {
      getItem: key => shared.has(key) ? shared.get(key) : null,
      setItem: (key, value) => shared.set(key, String(value))
    },
    indexedDB: {
      open() {
        const request = {};
        queueMicrotask(() => {
          request.result = {
            objectStoreNames: { contains: () => true },
            transaction() {
              const transaction = {
                objectStore() {
                  return {
                    get() { const op = {}; queueMicrotask(() => { op.result = primary; op.onsuccess(); }); return op; },
                    getAll() { const op = {}; queueMicrotask(() => { op.result = primary ? [primary] : []; op.onsuccess(); }); return op; }
                  };
                }
              };
              queueMicrotask(() => queueMicrotask(() => transaction.oncomplete()));
              return transaction;
            }
          };
          request.onsuccess();
        });
        return request;
      }
    },
    setTimeout,
    clearTimeout,
    queueMicrotask
  };
  runtime.globalThis = runtime;
  vm.createContext(runtime);
  vm.runInContext(readFileSync(new URL('storage.js', base), 'utf8'), runtime, { filename: 'storage.js' });
  shared.set('amy.practice.v1.trades', JSON.stringify([{ id: 'fallback-trade', createdAt: 1, bias: 'WAIT' }]));
  assert.equal((await runtime.AmyPracticeStorage.getTrade('fallback-trade')).bias, 'WAIT');
  assert.equal((await runtime.AmyPracticeStorage.listTrades())[0].id, 'fallback-trade');
  primary = { id: 'fallback-trade', result: 'OPEN', updatedAt: 10 };
  shared.set('amy.practice.v1.trades', JSON.stringify([{ ...primary, result: 'WIN', updatedAt: 20 }]));
  assert.equal((await runtime.AmyPracticeStorage.getTrade(primary.id)).result, 'WIN');
  assert.equal((await runtime.AmyPracticeStorage.listTrades())[0].result, 'WIN');
  primary = { ...primary, result: 'LOSS', updatedAt: 30 };
  assert.equal((await runtime.AmyPracticeStorage.getTrade(primary.id)).result, 'LOSS');
  assert.equal((await runtime.AmyPracticeStorage.listTrades())[0].result, 'LOSS');
});

test('deleting a trade clears both IndexedDB and fallback copies', async () => {
  const shared = new Map();
  let primary = { id: 'delete-me', updatedAt: 20 };
  const runtime = {
    console,
    localStorage: {
      getItem: key => shared.has(key) ? shared.get(key) : null,
      setItem: (key, value) => shared.set(key, String(value))
    },
    indexedDB: {
      open() {
        const request = {};
        queueMicrotask(() => {
          request.result = {
            objectStoreNames: { contains: () => true },
            transaction() {
              const transaction = {
                objectStore() {
                  return {
                    delete() { const op = {}; queueMicrotask(() => { primary = null; op.onsuccess(); }); return op; },
                    getAll() { const op = {}; queueMicrotask(() => { op.result = primary ? [primary] : []; op.onsuccess(); }); return op; }
                  };
                }
              };
              queueMicrotask(() => queueMicrotask(() => transaction.oncomplete()));
              return transaction;
            }
          };
          request.onsuccess();
        });
        return request;
      }
    },
    setTimeout,
    clearTimeout,
    queueMicrotask
  };
  runtime.globalThis = runtime;
  vm.createContext(runtime);
  vm.runInContext(readFileSync(new URL('storage.js', base), 'utf8'), runtime, { filename: 'storage.js' });
  shared.set('amy.practice.v1.trades', JSON.stringify([{ id: 'delete-me', updatedAt: 10 }]));
  await runtime.AmyPracticeStorage.deleteTrade('delete-me');
  assert.deepEqual(JSON.parse(shared.get('amy.practice.v1.trades')), []);
  assert.deepEqual(JSON.parse(JSON.stringify(await runtime.AmyPracticeStorage.listTrades())), []);
});

test('replay outcomes are isolated to the active historical pack', () => {
  const source = readFileSync(new URL('candle-replay.js', base), 'utf8');
  assert.match(source, /item\.sourceId === payload\.sourceId/);
  assert.doesNotMatch(source, /!item\.sourceId \|\| item\.sourceId === payload\.sourceId/);
});

test('history renders SL/TP candle evidence instead of an unsubstantiated result label', () => {
  const source = readFileSync(new URL('backtest-history.js', base), 'utf8');
  assert.match(source, /outcomeEvidence/);
  assert.match(source, /candleHigh/);
  assert.match(source, /candleLow/);
  assert.match(source, /SL diprioritaskan/);
});


test('rapid seeks discard a late provider response instead of moving the chart backward', async () => {
  const pending = [];
  const seen = [];
  const replay = new context.AmyReplayEngine.ReplayController({
    sourceId: 'fixture',
    provider: { getCandles: request => new Promise(resolve => pending.push({ request, resolve })) },
    onChange: payload => seen.push(payload.cursor)
  });
  replay.timeline = [0, 60, 120];
  const first = replay.seek(60);
  const second = replay.seek(120);
  pending[1].resolve({ sourceId: 'fixture', candles: [], source: 'fixture' });
  await second;
  pending[0].resolve({ sourceId: 'fixture', candles: [], source: 'fixture' });
  assert.equal(await first, null);
  assert.deepEqual(seen, [120]);
});

test('reaching the final replay bar stops playback rather than repeatedly replacing data', async () => {
  let ended = 0;
  const replay = new context.AmyReplayEngine.ReplayController({
    sourceId: 'fixture', speedMs: 10000,
    provider: { getCandles: async () => ({ sourceId: 'fixture', candles: [], source: 'fixture' }) },
    onEnd: () => { ended++; }
  });
  replay.timeline = [0, 60]; replay.cursor = 0;
  replay.play();
  try { await replay.move(1); assert.equal(replay.playTimer, null); assert.equal(ended, 1); }
  finally { replay.destroy(); }
});

test('switching timeframe from default initial position yields full candle context on M15 and M30', async () => {
  const core = context.AmyPracticeCore;
  const longMinutes = Array.from({ length: 3000 }, (_, index) => ({
    time: 1700000000 + index * 60,
    open: 2600 + index * 0.1, high: 2601 + index * 0.1, low: 2599 + index * 0.1, close: 2600.5 + index * 0.1
  }));
  const provider = {
    async getTimeline({ timeframe }) {
      return core.aggregateCandles(longMinutes, timeframe, { sourceTimeframe: 'M1', trustedSeries: true })
        .map(candle => candle.lastSourceTime ?? candle.time);
    },
    async getCandles({ timeframe, cursor }) {
      return {
        source: 'test', sampleOnly: true,
        candles: core.visibleCandles(longMinutes, cursor, timeframe, 'M1', { trustedSeries: true })
      };
    }
  };
  const controller = new context.AmyReplayEngine.ReplayController({ provider, timeframe: 'M1' });
  await controller.start();
  assert.equal(controller.isDefaultInitial, true);
  
  // Switch to M15: should initialize full M15 context (81 bars) rather than getting stuck at 6 bars
  const m15 = await controller.setTimeframe('M15');
  assert.ok(m15.candles.length >= 80, `Expected at least 80 M15 candles, got ${m15.candles.length}`);
  
  // Advance 1 M15 bar: should cleanly increment candle count
  const nextBar = await controller.move(1);
  assert.equal(nextBar.candles.length, m15.candles.length + 1);
  
  // Switch to M30: preserves the user's navigated timeline position (41 M30 bars for ~20h of data)
  const m30 = await controller.setTimeframe('M30');
  assert.ok(m30.candles.length >= 40, `Expected at least 40 M30 candles for navigated position, got ${m30.candles.length}`);

  // Fresh M30 start from default initial position yields full 80+ bars
  const freshM30 = new context.AmyReplayEngine.ReplayController({ provider, timeframe: 'M30' });
  const m30Start = await freshM30.start();
  assert.ok(m30Start.candles.length >= 80, `Expected at least 80 M30 candles on fresh start, got ${m30Start.candles.length}`);
});
