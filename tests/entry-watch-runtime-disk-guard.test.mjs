import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimeSource = fs.readFileSync('app/src/main/assets/apps/mapping/js/entry-watch-runtime.js', 'utf8');

test('Item 1.29: writeJson and syncScanner are guarded by signature change in entry-watch-runtime.js', () => {
  // 1. Static assertion: writeJson(STORAGE_KEY, watch) and syncScanner(watch) must be inside if (signature !== lastSignature)
  const pattern = /if\s*\(\s*signature\s*!==\s*lastSignature\s*\)\s*\{[\s\S]*?writeJson\s*\(\s*STORAGE_KEY\s*,\s*watch\s*\);[\s\S]*?syncScanner\s*\(\s*watch\s*\);/;
  assert.ok(
    pattern.test(runtimeSource),
    'writeJson and syncScanner must be strictly enclosed within if (signature !== lastSignature) block'
  );

  // 2. Dynamic execution test: simulate repeated 750ms persistAndRender ticks
  const setItemCalls = [];
  const scannerCalls = [];

  const context = {
    console,
    location: { href: 'http://localhost/apps/mapping/' },
    localStorage: {
      getItem: () => null,
      setItem: (key, value) => {
        if (key === 'amy_entry_watch_state_v2') {
          setItemCalls.push({ key, value });
        }
      }
    },
    document: {
      readyState: 'complete',
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    window: {
      Android: {
        startBackgroundScanner: () => {},
        stopBackgroundScanner: () => {},
        showNotificationWithUrl: () => {}
      }
    },
    setInterval: () => {},
    setTimeout: () => {}
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.localStorage = context.localStorage;

  // Extract signatureOf and persistAndRender logic
  // We can run the file in context with DOM mocked to verify behavior
  const mockWatch = {
    id: 'WATCH_TEST_1',
    lifecycleStage: 'WATCHING_LEVEL',
    status: 'ACTIVE',
    level: 2650.00,
    sourceCandleTime: 1700000000,
    triggerCandleTime: null,
    direction: 'BUY'
  };
  const mockForecast = { tf: 'M15', direction: 'BUY' };

  // Run snippet matching persistAndRender implementation
  const strippedSource = runtimeSource.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];/gm, '');
  const testScript = `
    ${strippedSource.slice(0, strippedSource.indexOf('function sync()'))}
    globalThis.testPersist = persistAndRender;
    globalThis.testSignatureOf = signatureOf;
  `;

  vm.createContext(context);
  vm.runInContext(testScript, context);

  const mockState = { result: {}, candles: {} };

  // Call 1: First tick -> signature is new -> must write to localStorage
  context.testPersist(mockState, mockWatch, mockForecast);
  assert.equal(setItemCalls.length, 1, 'First tick must write to localStorage');
  assert.equal(setItemCalls[0].key, 'amy_entry_watch_state_v2');

  // Next 50 ticks (representing ~37.5 seconds of 750ms intervals with unchanged watch)
  for (let i = 0; i < 50; i++) {
    context.testPersist(mockState, mockWatch, mockForecast);
  }
  assert.equal(
    setItemCalls.length,
    1,
    'Subsequent 50 ticks with identical signature must NOT write to localStorage (0 disk thrashing)'
  );

  // Call 52: Watch transitions to a new stage (e.g. LEVEL_TESTING) -> signature changes
  const updatedWatch = { ...mockWatch, lifecycleStage: 'LEVEL_TESTING' };
  context.testPersist(mockState, updatedWatch, mockForecast);
  assert.equal(setItemCalls.length, 2, 'State transition must trigger exactly one new disk write');
});
