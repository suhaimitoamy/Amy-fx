import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../app/src/main/assets/apps/academy/trading-practice/assets/js/candle-replay.js', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  async function saveTrade(event)'), source.indexOf('\n  async function changeSource'));

for (const scenario of ['new', 'locked', 'failure']) {
  test(`replay submit retains its form after event dispatch: ${scenario}`, async () => {
    const form = { dataset: {} };
    const record = { id: 'decision-test', bias: 'WAIT', tradeTime: 120 };
    let persisted = scenario === 'locked' ? record : null;
    let ready;
    let state;
    let writes = 0;
    const context = {
      savingDecision: false, playing: false, replay: { pause() {} },
      async renderHistory() {},
      latestPayload: { symbol: 'XAUUSD', timeframe: 'M15', cursor: 120, candles: [], sourceId: 'sample' },
      chart: { setTradeLevels() {} },
      core: { formatWita: String },
      storage: { async getTrade() { return persisted; } },
      window: { AmyPracticeTrades: { decisionId() { return record.id; } } },
      ui: {
        text() {},
        currentCandle() { return null; },
        byId() { return {}; },
        status() {},
        tradeReady(value) { ready = value; },
        decisionState(value) { state = value; },
        async saveTrade(target) {
          assert.equal(target, form);
          if (scenario === 'failure') throw new Error('Storage unavailable');
          writes += 1;
          persisted = record;
          return record;
        }
      }
    };
    vm.createContext(context);
    vm.runInContext(handler, context);
    const event = { currentTarget: form, preventDefault() {} };
    const completion = context.saveTrade(event);
    event.currentTarget = null;
    await completion;
    assert.equal(state, scenario === 'failure' ? 'error' : 'locked');
    assert.equal(ready, scenario === 'failure');
    assert.equal(writes, scenario === 'new' ? 1 : 0);
    assert.equal(form.dataset.lockedDecisionId, scenario === 'failure' ? undefined : record.id);
  });
}
