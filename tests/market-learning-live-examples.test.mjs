import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const bridgePath = 'app/src/main/assets/apps/academy/assets/js/market-learning-bridge.js';
const registryPath = 'app/src/main/assets/apps/academy/assets/data/market-learning-map.json';
const apiPath = 'api/learning-live-example.js';
const source = fs.readFileSync(bridgePath, 'utf8');
const apiSource = fs.readFileSync(apiPath, 'utf8');

function loadBridge(overrides = {}) {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    URL,
    URLSearchParams,
    AbortController,
    Promise,
    Date,
    Number,
    String,
    JSON,
    setTimeout,
    clearTimeout,
    location: { pathname: '/assets/apps/academy/bagian-01-pemula-nol/apa-itu-trading.html' },
    ...overrides
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: bridgePath });
  return sandbox.module.exports;
}

test('registry v2 maps all 645 HTML lessons to explicit topics', () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const entries = Object.entries(registry.lessons);

  assert.equal(registry.schemaVersion, 2);
  assert.equal(registry.defaults.showLiveExamples, true);
  assert.equal(entries.length, 645);
  for (const [path, config] of entries) {
    assert.match(path, /\.html$/);
    assert.equal(config.enabled, true);
    assert.ok(['basics', 'structural', 'management'].includes(config.category));
    assert.equal(typeof config.topic, 'string');
    assert.ok(config.topic.length > 0);
  }
});

test('different pages inside the same category retain different topics', () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const trading = registry.lessons['bagian-01-pemula-nol/apa-itu-trading.html'];
  const lot = registry.lessons['bagian-01-pemula-nol/lot-pip-point-dan-spread.html'];
  const risk = registry.lessons['bagian-01-pemula-nol/risk-sebelum-entry.html'];

  assert.equal(trading.category, 'basics');
  assert.equal(lot.category, 'basics');
  assert.equal(risk.category, 'basics');
  assert.equal(trading.topic, 'apa-itu-trading');
  assert.equal(lot.topic, 'lot-pip-point-dan-spread');
  assert.equal(risk.topic, 'risk-sebelum-entry');
  assert.notEqual(trading.topic, lot.topic);
  assert.notEqual(lot.topic, risk.topic);
});

test('bridge calls the topic-aware backend instead of simulated data', () => {
  assert.doesNotMatch(source, /simulatedLiveData/);
  assert.doesNotMatch(source, /Siap disambungkan ke API backend/);
  assert.doesNotMatch(source, /setTimeout\(\(\) => \{\s*desc\.innerHTML/);
  assert.match(source, /\/api\/learning-live-example/);
  assert.match(source, /topic:\s*String\(topic/);
  assert.match(source, /category:\s*String\(category/);
  assert.match(source, /data\.content\.message/);
});

test('inline glass UI, pulse animation, and no-redirect contract remain present', () => {
  assert.match(source, /live-example-box glass-panel/);
  assert.match(source, /Live Market Example/);
  assert.match(source, /pulse 2s infinite/);
  assert.match(source, /@keyframes pulse/);
  assert.match(source, /insertBefore\(ui, injectionPoint\.nextSibling\)/);
  assert.doesNotMatch(source, /location\.assign\s*\(/);
  assert.doesNotMatch(source, /location\.replace\s*\(/);
  assert.doesNotMatch(source, /window\.open\s*\(/);
  assert.doesNotMatch(source, /Gemini|OpenAI|chatbot|learning-ai/i);
});

test('academy chapter URL resolves to its exact registry key', () => {
  const bridge = loadBridge({
    location: { pathname: '/assets/apps/academy/bagian-01-pemula-nol/apa-itu-trading.html' }
  });
  assert.equal(bridge.getCurrentPath(), 'bagian-01-pemula-nol/apa-itu-trading.html');
});

test('bridge forwards exact category and topic to backend', async () => {
  let requestedUrl = '';
  const bridge = loadBridge({
    fetch: async url => {
      requestedUrl = String(url);
      return {
        ok: true,
        async json() {
          return {
            status: 'ok',
            route: { group: 'order_math' },
            market: { generatedAt: '2026-07-18T00:00:00.000Z' },
            content: {
              message: 'Lot dan pip memakai **data berbeda**.',
              disclaimer: 'Bukan sinyal.'
            }
          };
        }
      };
    }
  });

  const result = await bridge.fetchLiveExample('basics', 'lot-pip-point-dan-spread');
  const parsed = new URL(requestedUrl);
  assert.equal(parsed.pathname, '/api/learning-live-example');
  assert.equal(parsed.searchParams.get('category'), 'basics');
  assert.equal(parsed.searchParams.get('topic'), 'lot-pip-point-dan-spread');
  assert.equal(result.route.group, 'order_math');
});

test('API text is escaped before limited bold markup is rendered', () => {
  const bridge = loadBridge();
  const rendered = bridge.renderMessage('<img src=x onerror=alert(1)> **aman**');
  assert.doesNotMatch(rendered, /<img/);
  assert.match(rendered, /&lt;img/);
  assert.match(rendered, /<strong>aman<\/strong>/);
});

test('backend route validates topic and uses Twelve Data server-side', () => {
  assert.match(apiSource, /req\.query\?\.topic/);
  assert.match(apiSource, /classifyLearningTopic/);
  assert.match(apiSource, /buildLearningExample/);
  assert.match(apiSource, /process\.env\.TWELVEDATA_API_KEY/);
  assert.match(apiSource, /api\.twelvedata\.com\/time_series/);
  assert.match(apiSource, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(apiSource, /Gemini|OpenAI|chatbot/i);
});
