import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const base = new URL('../app/src/main/assets/apps/academy/trading-practice/', import.meta.url);
const read = name => readFileSync(new URL(name, base), 'utf8');
const candle = (time, low, high, close = 100) => ({ time, open: close, low, high, close });
const payload = (cursor, candles, timeframe = 'M1') => ({ symbol: 'XAUUSD', sourceId: 'pack-a', timeframe, cursor, startTime: 60, candles });

function runtime(shared = new Map()) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', dataset: {}, value: 'M1' });
    return nodes.get(id);
  };
  const ctx = { console, setTimeout, clearTimeout, Map,
    localStorage: { getItem: k => shared.get(k) ?? null, setItem: (k, v) => shared.set(k, String(v)) },
    document: { readyState: 'loading', addEventListener() {} },
    addEventListener() {},
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const file of ['practice-core.js', 'storage.js', 'trade-engine.js']) vm.runInContext(read('assets/js/' + file), ctx);
  ctx.AmyPracticeUI = {
    byId: node, text: (id, text) => { node(id).textContent = text; },
    status: (id, text) => { node(id).textContent = text; },
    currentCandle: list => list.at(-1), tradeReady() {}, decisionState() {}, renderOhlc() {},
    async saveTrade(form, context) {
      const trade = ctx.AmyPracticeTrades.create({ ...form.values, ...context });
      await ctx.AmyPracticeStorage.saveTrade(trade);
      return trade;
    }
  };
  ctx.AmyPracticeData = { async getCandles() { throw new Error('Unexpected provider request'); } };
  ctx.AmyReplayEngine = { lowerBound: (list, time) => Math.max(0, list.indexOf(time)) };
  const source = read('assets/js/candle-replay.js').replace(/\}\)\(\);\s*$/, `
    window.testReplay = { render, renderHistory, updateOutcomes, saveTrade,
      setPayload(value) { latestPayload = value; },
      setup() { chart = { options: {}, setTradeLevels() {}, setDrawingTimeBoundary() {}, setCandles() {} };
        replay = { timeline: [60,120,180,240], speedMs: 900, pause() {} }; }
    };
  })();`);
  vm.runInContext(source, ctx);
  ctx.testReplay.setup();
  return { ctx, node, shared };
}

async function submit(rt, bias = 'BUY', current = 100) {
  const form = rt.node('tradeForm');
  form.values = { bias, entry: 100, stopLoss: bias === 'SELL' ? 102 : 98, takeProfit: bias === 'SELL' ? 98 : 102, notes: 'catatan <entry>' };
  rt.ctx.testReplay.setPayload(payload(60, [candle(60, 97, 103, current)]));
  await rt.ctx.testReplay.saveTrade({ currentTarget: form, preventDefault() {} });
  return (await rt.ctx.AmyPracticeStorage.listTrades())[0];
}

test('Replay history links stay on Replay and new decisions appear immediately and after reload', async () => {
  const html = read('candle-replay.html');
  assert.equal((html.match(/href="#replayHistory"/g) || []).length, 2);
  assert.doesNotMatch(html, /href="backtest-history.html"/);
  const rt = runtime();
  await submit(rt);
  assert.match(rt.node('replayHistoryRows').innerHTML, /BUY.*M1/);
  assert.match(rt.node('replayHistoryRows').innerHTML, /Aktif · menunggu SL\/TP/);
  assert.match(rt.node('replayHistoryRows').innerHTML, /catatan &lt;entry&gt;/);
  assert.match(rt.node('replayHistoryRows').innerHTML, /data-delete-replay-trade/);
  const fresh = runtime(rt.shared);
  await fresh.ctx.testReplay.renderHistory();
  assert.equal(fresh.node('replayHistoryRows').innerHTML, rt.node('replayHistoryRows').innerHTML);
});

test('terminal Replay records from older builds receive missing SL/TP candle evidence', async () => {
  const rt = runtime();
  const old = rt.ctx.AmyPracticeTrades.create({
    symbol: 'XAUUSD', timeframe: 'M1', sourceId: 'pack-a', tradeTime: 60,
    bias: 'BUY', entry: 100, stopLoss: 98, takeProfit: 102, currentPrice: 100, lockDecision: true
  });
  delete old.outcomeEvidence;
  old.result = 'WIN';
  old.r = old.plannedR;
  old.closedAt = 120;
  await rt.ctx.AmyPracticeStorage.saveTrade(old);
  await rt.ctx.testReplay.render(payload(120, [candle(60, 99, 101), candle(120, 99, 103)]));
  const repaired = await rt.ctx.AmyPracticeStorage.getTrade(old.id);
  assert.equal(repaired.result, 'WIN');
  assert.equal(repaired.outcomeEvidence.type, 'TP');
  assert.match(rt.node('replayHistoryRows').innerHTML, /Bukti TP/);
});

for (const [bias, low, high, expected] of [['BUY',99,103,'TP'], ['BUY',97,101,'SL'], ['SELL',97,101,'TP'], ['SELL',99,103,'SL'], ['BUY',97,103,'SL']]) {
  test(`${bias} ${low}/${high}: advancing renders ${expected} evidence and rewind/reload preserves it`, async () => {
    const rt = runtime();
    await submit(rt, bias);
    await rt.ctx.testReplay.render(payload(120, [candle(60, 97, 103), candle(120, low, high)]));
    const markup = rt.node('replayHistoryRows').innerHTML;
    assert.match(markup, new RegExp(`${expected} tercapai`));
    assert.match(markup, new RegExp(`Bukti ${expected}`));
    assert.match(markup, /Low .*High/);
    if (low === 97 && high === 103) assert.match(markup, /SL diprioritaskan/);
    await rt.ctx.testReplay.render(payload(60, [candle(60, 97, 103)]));
    assert.equal(rt.node('replayHistoryRows').innerHTML, markup);
    const fresh = runtime(rt.shared);
    await fresh.ctx.testReplay.renderHistory();
    assert.equal(fresh.node('replayHistoryRows').innerHTML, markup);
  });
}

test('WAIT and unfilled entry have distinct statuses and Chart Analysis records are excluded', async () => {
  const rt = runtime();
  await submit(rt, 'BUY', 101);
  await rt.ctx.AmyPracticeStorage.saveTrade({ id: 'chart-only', bias: 'SELL', notes: 'not-replay' });
  const wait = rt.ctx.AmyPracticeTrades.create({ bias: 'WAIT', tradeTime: 180, sourceId: 'pack-b', timeframe: 'M15', lockDecision: true });
  await rt.ctx.AmyPracticeStorage.saveTrade(wait);
  await rt.ctx.testReplay.renderHistory();
  assert.match(rt.node('replayHistoryRows').innerHTML, /Menunggu entry tersentuh/);
  assert.match(rt.node('replayHistoryRows').innerHTML, /WAIT · tidak entry/);
  assert.doesNotMatch(rt.node('replayHistoryRows').innerHTML, /not-replay/);
});

test('switching timeframe updates original-timeframe positions only in the matching pack and up to cursor', async () => {
  const rt = runtime();
  const original = await submit(rt);
  await rt.ctx.AmyPracticeStorage.saveTrade({ ...original, id: 'decision-other-pack', sourceId: 'pack-b' });
  const requests = [];
  rt.ctx.AmyPracticeData.getCandles = async req => {
    requests.push({ ...req });
    return { candles: [candle(120,99,103)] };
  };
  await rt.ctx.testReplay.render(payload(120, [], 'M15'));
  assert.deepEqual(requests, [{ symbol: 'XAUUSD', sourceId: 'pack-a', timeframe: 'M1', cursor: 120 }]);
  assert.equal((await rt.ctx.AmyPracticeStorage.getTrade(original.id)).result, 'WIN');
  assert.equal((await rt.ctx.AmyPracticeStorage.getTrade('decision-other-pack')).result, 'OPEN');
});

test('later evaluation must not apply a pre-fill target to an already activated position', () => {
  const rt = runtime();
  const trade = rt.ctx.AmyPracticeTrades.create({ bias: 'BUY', entry:100, stopLoss:98, takeProfit:102, currentPrice:101, tradeTime:60 });
  const preFill = candle(120,101,103,102);
  const fill = candle(180,99,101);
  const active = rt.ctx.AmyPracticeTrades.evaluate(trade, [preFill,fill]);
  assert.equal(active.entryStatus, 'ACTIVE');
  assert.equal(active.result, 'OPEN');
  const next = rt.ctx.AmyPracticeTrades.evaluate(active, [preFill,fill,candle(240,99,101)]);
  assert.equal(next.result, 'OPEN');
});

test('a cursor change during async save cannot move the recorded entry to the newer candle', async () => {
  const rt = runtime();
  const form = rt.node('tradeForm');
  form.values = { bias:'WAIT' };
  rt.ctx.testReplay.setPayload(payload(60, []));
  const saving = rt.ctx.testReplay.saveTrade({ currentTarget: form, preventDefault() {} });
  rt.ctx.testReplay.setPayload(payload(120, []));
  await saving;
  const [record] = await rt.ctx.AmyPracticeStorage.listTrades();
  assert.equal(record.tradeTime, 60);
  assert.equal(form.dataset.lockedDecisionId, undefined);
});
