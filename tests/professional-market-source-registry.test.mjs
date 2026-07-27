import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const registryPath = resolve(root, "app/src/main/assets/apps/shared/amyfx-professional-market-source-registry-v1.js");
const handlerPath = resolve(root, "app/src/main/assets/apps/shared/amyfx-professional-bot-handler-lock-v1.js");
const registrySource = readFileSync(registryPath, "utf8");
const handlerSource = readFileSync(handlerPath, "utf8");

function storage(seed = {}) {
  const rows = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)]));
  return {
    get length() { return rows.size; },
    key(index) { return [...rows.keys()][index] ?? null; },
    getItem(key) { return rows.has(key) ? rows.get(key) : null; },
    setItem(key, value) { rows.set(key, String(value)); },
    removeItem(key) { rows.delete(key); },
    clear() { rows.clear(); }
  };
}

function fixture({ localDirection = "BULLISH", includeMarket = true } = {}) {
  const now = new Date().toISOString();
  const state = includeMarket ? {
    mapping: {
      updated: now,
      capturedAt: now,
      price: 4091.49,
      bsl: 4110.15,
      ssl: 4075.20,
      direction: "BUY",
      bias: "BUY",
      timeframe: "M15",
      marketState: "TRENDING"
    },
    liquidity: {
      updated: now,
      capturedAt: now,
      currentPrice: 4091.49,
      levels: [
        { type: "BSL", price: 4092.00, status: "ACTIVE", active: true, distance: 0.51 },
        { type: "BSL", price: 4110.15, status: "ACTIVE", active: true, distance: 18.66 },
        { type: "SSL", price: 4087.50, status: "ACTIVE", active: true, distance: -3.99 }
      ]
    },
    news: { updated: now, items: [{ title: "CPI" }] },
    outlook: {
      generatedAt: now,
      status: "ACTIVE",
      direction: "BULLISH",
      scenarios: [{ status: "ACTIVE", side: "BUY", target: 4092, invalidation: 4084.14, zoneLow: 4088, zoneHigh: 4090, reason: "Validated continuation" }]
    }
  } : {};

  const result = includeMarket ? {
    tf: "M15",
    price: 4091.49,
    capturedAt: now,
    validatedMarketContext: {
      directionForecast: { active: true, direction: "BULLISH", confidence: 82 },
      marketState: { state: "TRENDING", structureTrend: localDirection }
    },
    st: {
      confirmedTrend: localDirection,
      lastEvent: { kind: "BOS", dir: "BULLISH", price: 4088.20 }
    },
    biasEvidence: { normalized: 0.72 },
    setupExecution: {
      active: true,
      terminal: false,
      status: "WAITING_ENTRY",
      direction: "BUY",
      entryLow: 4088,
      entryHigh: 4090,
      stopLoss: 4084.14,
      target1: 4092,
      target2: 4105.60
    },
    strategyRouter: { activeRegime: "TRENDING" },
    dealingRange: { currentZone: "DISCOUNT" }
  } : null;

  return {
    state,
    context: {
      payload: {
        workspace: {
          market: {
            current_price: includeMarket ? 4091.49 : null,
            shared_intelligence: state,
            live_state: result ? { price: 4091.49, capturedAt: now, result } : null
          }
        }
      }
    }
  };
}

function createRuntime(options = {}) {
  const data = fixture(options);
  const localStorage = storage();
  const sessionStorage = storage();
  const events = new Map();
  const baseBot = {
    __amyProfessionalBotV3: true,
    answer() { return "fallback lama"; }
  };
  const window = {
    AmyFXProfessionalBot: baseBot,
    AmyFXMappingIntentHotfix: baseBot,
    AmyFXMarketState: data.context.payload.workspace.market.live_state,
    AmyFXIntelState: data.state,
    AmyFXIntel: {
      read() { return data.state; },
      partTimestamp(part) { return new Date(part?.updated || part?.capturedAt || 0).getTime(); },
      bestCurrentPrice() { return options.includeMarket === false ? 0 : 4091.49; },
      nearestLevels() {
        if (options.includeMarket === false) return { bsl: null, ssl: null };
        return {
          bsl: { type: "BSL", price: 4092, distance: 0.51 },
          ssl: { type: "SSL", price: 4087.50, distance: -3.99 }
        };
      },
      freshness() { return options.includeMarket === false ? { label: "WAITING", className: "stale" } : { label: "LIVE", className: "live", source: "liquidity" }; },
      newsRisk() { return options.includeMarket === false ? "UNKNOWN" : "HIGH"; },
      sessionInfo() { return { id: "LONDON", label: "LONDON ACTIVE" }; }
    },
    AmyFXProfessionalBotHandlerLock: { lock() { return true; } },
    addEventListener(name, callback) { events.set(name, callback); },
    dispatchEvent() {},
    setInterval() { return 0; },
    clearInterval() {},
    setTimeout() { return 0; },
    clearTimeout() {}
  };
  const document = {
    readyState: "complete",
    hidden: false,
    addEventListener() {},
    currentScript: null
  };
  const sandbox = {
    window,
    document,
    location: { pathname: "/index.html" },
    localStorage,
    sessionStorage,
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    Intl,
    Date,
    Number,
    Object,
    Array,
    String,
    Boolean,
    RegExp,
    Map,
    Math,
    JSON,
    URL,
    setInterval() { return 0; },
    clearInterval() {},
    setTimeout() { return 0; },
    clearTimeout() {}
  };
  vm.runInNewContext(registrySource, sandbox, { filename: registryPath });
  return { window, localStorage, sessionStorage, context: data.context };
}

test("canonical nearest draw BSL wins over the stale Mapping snapshot", () => {
  const runtime = createRuntime();
  const answer = runtime.window.AmyFXMarketSourceRegistry.answer("BSL terdekat di mana?", runtime.context);
  assert.match(answer, /BSL aktif terdekat 4\.092/);
  assert.match(answer, /snapshot Mapping 4\.110,15/);
  assert.match(answer, /nearest draw live/i);
  assert.doesNotMatch(answer, /BSL aktif terdekat 4\.110,15/);
});

test("market summary uses past, dominant direction, present data, future and provenance", () => {
  const runtime = createRuntime();
  const answer = runtime.window.AmyFXMarketSourceRegistry.answer("Market hari ini gimana?", runtime.context);
  assert.match(answer, /Sebelumnya terjadi BOS BULLISH di 4\.088,2/);
  assert.match(answer, /dominan BULLISH/);
  assert.match(answer, /Arah M15 BULLISH/);
  assert.match(answer, /Harga terakhir 4\.091,49/);
  assert.match(answer, /BSL terdekat 4\.092/);
  assert.match(answer, /SSL terdekat 4\.087,5/);
  assert.match(answer, /Invalidasi 4\.084,14/);
  assert.match(answer, /Risiko news HIGH/);
  assert.match(answer, /LONDON ACTIVE/);
  assert.match(answer, /Sumber: Mapping engine \+ Market Intel nearest draw/);
});

test("direction conflicts are stated explicitly and decision remains WAIT", () => {
  const runtime = createRuntime({ localDirection: "BEARISH" });
  const answer = runtime.window.AmyFXMarketSourceRegistry.answer("Arah market sekarang?", runtime.context);
  assert.match(answer, /Arah dominan engine BULLISH/);
  assert.match(answer, /Arah M15 BEARISH/);
  assert.match(answer, /Konflik data/);
  assert.match(answer, /tetap WAIT/);
});

test("follow-up context resolves invalidation and writes an answer audit", () => {
  const runtime = createRuntime();
  runtime.window.AmyFXMarketSourceRegistry.answer("Market hari ini gimana?", runtime.context);
  const answer = runtime.window.AmyFXMarketSourceRegistry.answer("invalidasinya", runtime.context);
  assert.match(answer, /4\.084,14/);
  const audit = JSON.parse(runtime.localStorage.getItem("amyfx.bot.answer.audit.v1"));
  assert.equal(audit[0].intent, "invalidation");
  assert.equal(audit[0].selected.bsl, 4092);
  assert.equal(audit[0].selected.ssl, 4087.5);
});

test("handler loads source registry before locking and tracks bot runtime signature", () => {
  assert.match(handlerSource, /amyfx-professional-market-source-registry-v1\.js/);
  assert.match(handlerSource, /loadMarketSourceRegistryRuntime\(startLocking\)/);
  assert.match(handlerSource, /__amyProfessionalBotRuntimeSignatureV1/);
  assert.match(handlerSource, /amyfx:professional-market-source-registry-ready/);
  assert.match(handlerSource, /professional-market-source-registry-v1/);
});

test("past and future questions stay grounded in Mapping engine data", () => {
  const runtime = createRuntime();
  const past = runtime.window.AmyFXMarketSourceRegistry.answer("Apa yang terjadi sebelumnya?", runtime.context);
  const future = runtime.window.AmyFXMarketSourceRegistry.answer("Masa depan market gimana?", runtime.context);
  assert.match(past, /BOS BULLISH di 4\.088,2/);
  assert.match(future, /arah skenario BULLISH/);
  assert.match(future, /area 4\.088–4\.090/);
  assert.match(future, /target 4\.092/);
  assert.match(future, /invalidasi 4\.084,14/);
});

test("empty data never produces invented price levels", () => {
  const runtime = createRuntime({ includeMarket: false });
  const bsl = runtime.window.AmyFXMarketSourceRegistry.answer("BSL terdekat", runtime.context);
  const summary = runtime.window.AmyFXMarketSourceRegistry.answer("Market hari ini gimana?", runtime.context);
  assert.match(bsl, /belum tersedia/i);
  assert.match(summary, /Data market belum cukup/i);
  assert.doesNotMatch(`${bsl} ${summary}`, /4\.0\d{2}/);
});
