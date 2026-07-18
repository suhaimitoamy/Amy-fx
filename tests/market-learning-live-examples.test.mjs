import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const bridgePath = 'app/src/main/assets/apps/academy/assets/js/market-learning-bridge.js';
const registryPath = 'app/src/main/assets/apps/academy/assets/data/market-learning-map.json';
const source = fs.readFileSync(bridgePath, 'utf8');

function loadBridge() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    URL,
    URLSearchParams,
    Map,
    Promise,
    Date,
    Intl,
    Number,
    String,
    Math,
    JSON,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: bridgePath });
  return sandbox.module.exports;
}

test('registry v2 keeps inline lesson categories enabled', () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  assert.equal(registry.schemaVersion, 2);
  assert.equal(registry.defaults.showLiveExamples, true);
  assert.equal(registry.lessons['bagian-17-fvg-masterclass/index.html'].category, 'structural');
  assert.equal(registry.lessons['bagian-17-fvg-masterclass/index.html'].topic, 'fvg');
  assert.equal(registry.lessons['bagian-13-psikologi-trading/index.html'].category, 'management');
});

test('bridge removes simulated data and uses Mapping market pipeline', () => {
  assert.doesNotMatch(source, /simulatedLiveData/);
  assert.match(source, /https:\/\/amy-fx\.vercel\.app\/api\/twelvedata/);
  assert.match(source, /\/assets\/apps\/mapping\/js\/engine\/ict-core\.js/);
  assert.match(source, /\/assets\/apps\/mapping\/js\/engine\/concept-candles\.js/);
  assert.match(source, /engine\.analyze\(/);
  assert.match(source, /conceptAtrAt\(/);
});

test('inline architecture contains no redirect or external coach flow', () => {
  assert.doesNotMatch(source, /location\.assign\s*\(/);
  assert.doesNotMatch(source, /location\.replace\s*\(/);
  assert.doesNotMatch(source, /window\.open\s*\(/);
  assert.doesNotMatch(source, /Android\.goHome\s*\(/);
  assert.doesNotMatch(source, /Gemini|OpenAI|chatbot|learning-ai/i);
});

test('existing glass UI and pulse animation contract remain present', () => {
  assert.match(source, /live-example-box glass-panel/);
  assert.match(source, /Live Market Example/);
  assert.match(source, /pulse 2s infinite/);
  assert.match(source, /@keyframes pulse/);
  assert.match(source, /insertBefore\(ui, injectionPoint\.nextSibling\)/);
});

test('basics example is built from fetched candle values', () => {
  const bridge = loadBridge();
  const result = bridge.buildBasicsExample(
    { latest: { close: 3341.25 } },
    { latest: { open: 3320, high: 3355.5, low: 3312.75, close: 3341.25 } }
  );
  assert.equal(result.price, '3341.25');
  assert.match(result.message, /\$3341\.25/);
  assert.match(result.message, /\$3320\.00/);
  assert.match(result.message, /\$3355\.50/);
  assert.match(result.message, /\$3312\.75/);
});

test('structural examples use Mapping FVG and Order Block fields', () => {
  const bridge = loadBridge();
  const analysis = {
    currentPrice: 3341.25,
    result: {
      price: 3341.25,
      marketConcepts: {
        nearestFairValueGaps: [{ direction: 'BULLISH', bottom: 3330, top: 3334, status: 'DETECTED' }],
        nearestOrderBlocks: [{ direction: 'BEARISH', bottom: 3350, top: 3356, status: 'TESTING', sourceStructure: 'BOS' }],
        latestConfirmedSweep: null,
        liquidityHierarchy: { drawTarget: null }
      }
    }
  };

  const fvg = bridge.buildStructuralExample('fvg', analysis);
  assert.match(fvg.message, /FVG BULLISH/);
  assert.match(fvg.message, /\$3330\.00 - \$3334\.00/);
  assert.match(fvg.message, /DETECTED/);

  const ob = bridge.buildStructuralExample('ob', analysis);
  assert.match(ob.message, /Order Block BEARISH/);
  assert.match(ob.message, /\$3350\.00 - \$3356\.00/);
  assert.match(ob.message, /BOS/);
});

test('liquidity lesson distinguishes confirmed sweep from an active target', () => {
  const bridge = loadBridge();
  const confirmed = bridge.buildStructuralExample('liquidity_sweep', {
    currentPrice: 3341,
    result: {
      marketConcepts: {
        latestConfirmedSweep: {
          type: 'BSL',
          level: 3350,
          reclaimDepthAtr: 0.55,
          status: 'CONFIRMED_REACTION'
        },
        liquidityHierarchy: { drawTarget: null }
      }
    }
  });
  assert.match(confirmed.message, /sweep terkonfirmasi/);
  assert.match(confirmed.message, /BSL/);
  assert.match(confirmed.message, /0\.55 ATR/);

  const waiting = bridge.buildStructuralExample('liquidity_sweep', {
    currentPrice: 3341,
    result: {
      marketConcepts: {
        latestConfirmedSweep: null,
        liquidityHierarchy: { drawTarget: { type: 'SSL', level: 3320 } }
      }
    }
  });
  assert.match(waiting.message, /belum menemukan sweep terkonfirmasi/i);
  assert.match(waiting.message, /target likuiditas, bukan sinyal arah/i);
});
