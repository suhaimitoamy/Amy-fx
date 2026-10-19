import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = f => readFileSync('app/src/main/assets/' + f, 'utf8');

test('chart-view updateActiveCandle tracks live price ticks into forming bar and resets on draw', () => {
  const updates = [];
  const setDatas = [];
  const chart = {
    applyOptions() {},
    addCandlestickSeries: () => ({
      setData: v => setDatas.push(v),
      update: v => updates.push({ ...v }),
      createPriceLine: () => ({}),
      removePriceLine: () => {}
    }),
    timeScale: () => ({ fitContent() {}, rightOffset: 0 }),
    priceScale: () => ({ applyOptions() {} }),
    remove() {}
  };

  const context = {
    window: {
      LightweightCharts: { createChart: () => chart },
      addEventListener() {},
      removeEventListener() {}
    },
    document: {
      documentElement: { dataset: { amyfxTheme: 'light' } }
    },
    createIctCanvas: () => ({ update() {}, invalidate() {}, destroy() {} }),
    Date
  };

  const source = read('apps/mapping/js/ict-workspace/chart-view.js')
    .replace(/^import .*;\n/gm, '')
    .replace('export function', 'function');
  vm.runInNewContext(source, context);

  const view = context.createPriceChart({});

  // 1. Initial draw with closed candle at 14:00 (M15 duration = 900s)
  const initialClosedTime = 1792392000; // Mon Oct 19 2026 14:00:00 GMT
  const candles = [
    { time: initialClosedTime - 900, open: 4170, high: 4175, low: 4168, close: 4172 },
    { time: initialClosedTime, open: 4172, high: 4178, low: 4171, close: 4175 }
  ];

  view.draw({ tf: 'M15', candles, plan: null });
  assert.equal(setDatas.length, 1);
  assert.equal(updates.length, 0);

  // 2. A live price tick arrives at 14:05 (time = 1792392300)
  // Active bar bucket for M15 should be 1792392900 (14:15)
  const tickTimeMs = (initialClosedTime + 300) * 1000;
  view.updateActiveCandle(4177.50, tickTimeMs);

  assert.equal(updates.length, 1);
  const bar1 = updates[0];
  assert.equal(bar1.time, initialClosedTime + 900); // 14:15
  assert.equal(bar1.open, 4175); // Opened at previous close
  assert.equal(bar1.high, 4177.50);
  assert.equal(bar1.low, 4175);
  assert.equal(bar1.close, 4177.50);

  // 3. Higher price tick arrives at 14:06 -> High expands
  view.updateActiveCandle(4182.00, tickTimeMs + 60000);
  assert.equal(updates.length, 2);
  const bar2 = updates[1];
  assert.equal(bar2.high, 4182.00);
  assert.equal(bar2.close, 4182.00);

  // 4. Lower price tick arrives at 14:07 -> Low expands
  view.updateActiveCandle(4173.00, tickTimeMs + 120000);
  assert.equal(updates.length, 3);
  const bar3 = updates[2];
  assert.equal(bar3.high, 4182.00);
  assert.equal(bar3.low, 4173.00);
  assert.equal(bar3.close, 4173.00);

  // 5. Next candle closed and officially confirmed via draw()
  const nextClosedCandles = [
    ...candles,
    { time: initialClosedTime + 900, open: 4175, high: 4182, low: 4173, close: 4180 }
  ];
  view.draw({ tf: 'M15', candles: nextClosedCandles, plan: null });
  assert.equal(setDatas.length, 2);

  // 6. After draw(), new active bar starts for the subsequent period
  const newTickTimeMs = (initialClosedTime + 1200) * 1000; // 14:20
  view.updateActiveCandle(4181.50, newTickTimeMs);
  assert.equal(updates.length, 4);
  const bar4 = updates[3];
  assert.equal(bar4.time, initialClosedTime + 1800); // 14:30 bucket
  assert.equal(bar4.open, 4180); // Previous closed close
  assert.equal(bar4.close, 4181.50);
});

test('chart-view updateActiveCandle suppresses active candle synthesis during weekend closure', () => {
  const updates = [];
  const chart = {
    applyOptions() {},
    addCandlestickSeries: () => ({
      setData() {},
      update: v => updates.push({ ...v }),
      createPriceLine: () => ({}),
      removePriceLine: () => {}
    }),
    timeScale: () => ({ fitContent() {} }),
    priceScale: () => ({ applyOptions() {} }),
    remove() {}
  };

  const context = {
    window: { LightweightCharts: { createChart: () => chart }, addEventListener() {}, removeEventListener() {} },
    document: { documentElement: { dataset: {} } },
    createIctCanvas: () => ({ update() {}, invalidate() {}, destroy() {} }),
    Date
  };

  const source = read('apps/mapping/js/ict-workspace/chart-view.js')
    .replace(/^import .*;\n/gm, '')
    .replace('export function', 'function');
  vm.runInNewContext(source, context);

  const view = context.createPriceChart({});
  view.draw({
    tf: 'M15',
    candles: [{ time: 1000, open: 4170, high: 4175, low: 4168, close: 4172 }]
  });

  // Saturday 12:00 NY (Weekend Closure) -> 1792252800
  // Sat Oct 17 2026 16:00:00 UTC = Sat 12:00 EDT
  const saturdayTimestampMs = 1792252800 * 1000;
  view.updateActiveCandle(4175.00, saturdayTimestampMs);

  assert.equal(updates.length, 0, 'Must not synthesize or update active candle on weekend');
});
