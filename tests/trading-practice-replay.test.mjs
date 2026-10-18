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

test('IndexedDB error or block resets dbPromise to allow subsequent connection retry', async () => {
  let openAttempts = 0;
  let shouldFail = true;
  const requests = [];
  const indexedDB = {
    open() {
      openAttempts++;
      const req = {};
      requests.push(req);
      queueMicrotask(() => {
        if (shouldFail) {
          req.error = new Error('Transient DB failure');
          if (req.onerror) req.onerror();
        } else {
          req.result = {
            objectStoreNames: { contains: () => true },
            transaction() {
              const tx = {
                objectStore() {
                  return { put() { return {}; } };
                }
              };
              queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
              return tx;
            }
          };
          if (req.onsuccess) req.onsuccess();
        }
      });
      return req;
    }
  };
  const runtime = { console, indexedDB, Blob, localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout, queueMicrotask };
  runtime.globalThis = runtime;
  vm.createContext(runtime);
  const run = name => vm.runInContext(readFileSync(new URL(name, base), 'utf8'), runtime, { filename: name });
  run('practice-core.js');
  run('storage.js');

  // First call should fail and reject
  await assert.rejects(
    () => runtime.AmyPracticeStorage.saveHistoricalPack({ id: 'pack-retry' }, new Blob(['data'])),
    /Transient DB failure/
  );
  assert.equal(openAttempts, 1);

  // Subsequent call after recovering should trigger a new open attempt instead of permanent rejection
  shouldFail = false;
  const result = await runtime.AmyPracticeStorage.saveHistoricalPack({ id: 'pack-retry' }, new Blob(['data']));
  assert.equal(openAttempts, 2, 'Subsequent call must retry indexedDB.open() rather than caching failed promise');
  assert.equal(result.id, 'pack-retry');
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

test('D1 aggregation uses NY 17:00 close offset to merge Sunday session into Monday daily bar (item 1.62)', () => {
  const core = context.AmyPracticeCore;
  // Choose a base day aligned to NY 17:00 (multiple of 86400 + 17*3600)
  // Let base = 86400 * 1000 + 17 * 3600 = 86461200
  const sunday1700 = 86400 * 1000 + 17 * 3600;
  
  // Create 3 candles:
  // 1. Sunday 18:00 (1 hour after open)
  // 2. Monday 10:00 (next calendar day UTC)
  // 3. Monday 18:00 (next trading day NY)
  const candles = [
    { time: sunday1700 + 3600, open: 2600, high: 2610, low: 2595, close: 2605 },
    { time: sunday1700 + 17 * 3600, open: 2605, high: 2620, low: 2600, close: 2615 },
    { time: sunday1700 + 86400 + 3600, open: 2615, high: 2630, low: 2610, close: 2625 }
  ];

  const d1Candles = core.aggregateCandles(candles, 'D1');
  // First two candles fall in the same D1 bar [sunday1700, sunday1700 + 86400)
  assert.equal(d1Candles.length, 2, 'Sunday + Monday session must merge into 1 daily bar, not 2 separate bars');
  assert.equal(d1Candles[0].time, sunday1700);
  assert.equal(d1Candles[0].open, 2600);
  assert.equal(d1Candles[0].high, 2620);
  assert.equal(d1Candles[0].low, 2595);
  assert.equal(d1Candles[0].close, 2615);
  assert.equal(d1Candles[0].sourceCount, 2);

  // Second D1 candle starts at next day 17:00
  assert.equal(d1Candles[1].time, sunday1700 + 86400);
  assert.equal(d1Candles[1].open, 2615);
  assert.equal(d1Candles[1].high, 2630);

  // Verify visibleCandles invariant holds with cursor
  const visible = core.visibleCandles(candles, sunday1700 + 17 * 3600, 'D1');
  assert.equal(visible.length, 1);
  assert.equal(visible[0].time, sunday1700);
  assert.equal(visible[0].lastSourceTime, sunday1700 + 17 * 3600);
});

test('Item 2.37: Multi-timeframe synced playback projects cursor and retrieves MTF context', async () => {
  const core = context.AmyPracticeCore;
  const provider = {
    async getTimeline({ timeframe }) {
      return core.aggregateCandles(minuteCandles, timeframe, { sourceTimeframe: 'M1' }).map(c => c.lastSourceTime ?? c.time);
    },
    async getCandles({ timeframe, cursor }) {
      return {
        source: 'test',
        candles: core.visibleCandles(minuteCandles, cursor, timeframe, 'M1')
      };
    }
  };
  const controller = new context.AmyReplayEngine.ReplayController({ provider, timeframe: 'M1' });
  await controller.start(180);

  // Test projectTimeframeCursor for H1 (3600s) and M5 (300s)
  const projectionH1 = controller.projectTimeframeCursor('H1');
  assert.equal(projectionH1.targetTimeframe, 'H1');
  assert.equal(projectionH1.candleOpenTime, 0);
  assert.equal(projectionH1.candleCloseTime, 3600);
  assert.equal(projectionH1.intraCandleElapsedSec, 180);

  const projectionM5 = controller.projectTimeframeCursor('M5');
  assert.equal(projectionM5.targetTimeframe, 'M5');
  assert.equal(projectionM5.candleOpenTime, 0);
  assert.equal(projectionM5.candleCloseTime, 300);
  assert.equal(projectionM5.intraCandleElapsedSec, 180);

  // Test getMultiTimeframeContext
  const mtfContext = await controller.getMultiTimeframeContext(['M1', 'M5']);
  assert.ok(mtfContext.M1);
  assert.ok(mtfContext.M5);
  assert.equal(mtfContext.M1.cursor, 180);
  assert.equal(mtfContext.M5.cursor, 180);
  assert.equal(mtfContext.M5.candles.length, 1);
  assert.equal(mtfContext.M5.candles[0].lastSourceTime, 180);
});

test('Item 2.30: synthesizeNyCloseD1 aggregates 17:00 NY Close D1 and derives PDH, PDL, and True Day Range', () => {
  const core = context.AmyPracticeCore;
  // Sunday July 5, 2026: 18:00 NY (22:00 UTC) -> 1783375200
  // Monday July 6, 2026: 10:00 NY (14:00 UTC) -> 1783432800
  // Monday July 6, 2026: 18:00 NY (22:00 UTC) -> Tuesday trading day! 1783461600
  // Tuesday July 7, 2026: 10:00 NY (14:00 UTC) -> 1783519200
  const candles = [
    // Sunday open bar (Sunday 18:00 NY)
    { time: 1783375200, open: 2650.0, high: 2655.0, low: 2648.0, close: 2652.0 },
    // Monday day bar (Monday 10:00 NY)
    { time: 1783432800, open: 2652.0, high: 2665.0, low: 2645.0, close: 2660.0 },
    // Monday evening bar (Monday 18:00 NY = start of Tuesday trading day)
    { time: 1783461600, open: 2660.0, high: 2670.0, low: 2658.0, close: 2668.0 },
    // Tuesday day bar (Tuesday 10:00 NY)
    { time: 1783519200, open: 2668.0, high: 2675.0, low: 2662.0, close: 2672.0 }
  ];

  const d1Bars = core.synthesizeNyCloseD1(candles);
  // Must merge Sunday + Monday into Monday trading bar (bar 0), and Mon evening + Tue into Tuesday bar (bar 1)
  assert.equal(d1Bars.length, 2, 'Sunday open must merge with Monday into exactly 1 institutional trading day');

  // Monday Trading Day Bar
  const monday = d1Bars[0];
  assert.equal(monday.open, 2650.0);
  assert.equal(monday.high, 2665.0);
  assert.equal(monday.low, 2645.0);
  assert.equal(monday.close, 2660.0);
  assert.equal(monday.pdh, null, 'First day has no previous day');
  assert.equal(monday.trueDayRange, 20.0); // 2665 - 2645 = 20
  assert.equal(monday.equilibrium, 2655.0); // (2665 + 2645) / 2 = 2655

  // Tuesday Trading Day Bar
  const tuesday = d1Bars[1];
  assert.equal(tuesday.open, 2660.0);
  assert.equal(tuesday.high, 2675.0);
  assert.equal(tuesday.low, 2658.0);
  assert.equal(tuesday.close, 2672.0);
  assert.equal(tuesday.pdh, 2665.0, 'Tuesday PDH must match Monday high');
  assert.equal(tuesday.pdl, 2645.0, 'Tuesday PDL must match Monday low');
  assert.equal(tuesday.trueDayRange, 17.0); // 2675 - 2658 = 17
  assert.equal(tuesday.equilibrium, 2666.5);
});



