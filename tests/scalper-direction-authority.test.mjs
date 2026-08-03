import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../app/src/main/assets/apps/mapping/js/mapping-clarity-v1.js', import.meta.url),
  'utf8'
);

function loadChooser() {
  const start = source.indexOf('function matchingRows');
  const end = source.indexOf('function structure(', start);
  assert.ok(start >= 0 && end > start, 'scalper direction block must exist');
  const context = {
    SCALPER_AUTHORITY_TFS: Object.freeze(['M15', 'M5', 'M1', 'M30', 'H1']),
    SCALPER_WEIGHTS: Object.freeze({ M15: 6, M5: 5, M1: 2, M30: 3, H1: 2 }),
    chooser: null
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nchooser = chooseScalperDirection;`, context);
  return context.chooser;
}

const row = (tf, direction, invalidation = 1) => ({
  tf,
  missing: false,
  s: {
    direction,
    phase: 'CONTINUATION',
    invalidation,
    rule: `${tf} invalidation`
  },
  sourceTime: 1
});

test('M1 + M30 + H1 bearish stays bearish when M15 and M5 are not loaded', () => {
  const choose = loadChooser();
  const result = choose([
    { tf: 'M15', missing: true },
    { tf: 'M5', missing: true },
    row('M1', 'BEARISH', 4051.54),
    row('M30', 'BEARISH', 4071.66),
    row('H1', 'BEARISH', 4116.43),
    row('H4', 'BULLISH', 3983.43)
  ]);
  assert.equal(result.direction, 'BEARISH');
  assert.deepEqual([...result.sources], ['M1', 'M30', 'H1']);
  assert.ok(!result.sources.includes('H4'));
});

test('M15 remains the primary scalping direction and reports lower-timeframe conflict', () => {
  const choose = loadChooser();
  const result = choose([
    row('M15', 'BULLISH', 4000),
    row('M5', 'BEARISH', 4050),
    row('M1', 'BEARISH', 4040),
    row('H1', 'BEARISH', 4100)
  ]);
  assert.equal(result.direction, 'BULLISH');
  assert.match(result.label, /konflik M5 \+ M1/);
});

test('H4, D1, and W1 never vote on scalping direction', () => {
  assert.match(source, /SCALPER_AUTHORITY_TFS = Object\.freeze\(\['M15', 'M5', 'M1', 'M30', 'H1'\]\)/);
  assert.doesNotMatch(source, /SCALPER_AUTHORITY_TFS[^\n]*H4/);
  assert.doesNotMatch(source, /SCALPER_AUTHORITY_TFS[^\n]*D1/);
  assert.doesNotMatch(source, /SCALPER_AUTHORITY_TFS[^\n]*W1/);
  assert.match(source, /H4\/D1 tidak ikut menentukan arah scalping/);
});

test('clarity runtime no longer watches nested mutations or live quote events', () => {
  assert.match(source, /subtree: false/);
  assert.doesNotMatch(source, /amyfx:market-update/);
});
