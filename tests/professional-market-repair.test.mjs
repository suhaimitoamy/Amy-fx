import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const repairPath = resolve(root, "app/src/main/assets/apps/shared/amyfx-professional-market-repair-v1.js");
const handlerPath = resolve(root, "app/src/main/assets/apps/shared/amyfx-professional-bot-handler-lock-v1.js");
const repairSource = readFileSync(repairPath, "utf8");
const handlerSource = readFileSync(handlerPath, "utf8");

function storage(seed = {}) {
  const values = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function repairRuntime() {
  const now = new Date().toISOString();
  const intelState = {
    mapping: {
      updated: now,
      price: 4091.49,
      bsl: 4110.15,
      ssl: 4084.14,
      levels: [
        { type: "BSL", price: 4110.15, status: "ACTIVE", active: true },
        { type: "SSL", price: 4084.14, status: "ACTIVE", active: true }
      ]
    },
    liquidity: {
      updated: now,
      currentPrice: 4091.49,
      levels: [
        { type: "BSL", price: 4092, distance: 0.51, status: "ACTIVE", active: true },
        { type: "SSL", price: 4087.5, distance: -3.99, status: "ACTIVE", active: true }
      ]
    },
    heatmap: { updated: now, currentPrice: 4091.49, zones: [] }
  };
  const result = {
    tf: "M15",
    price: 4091.49,
    capturedAt: now,
    marketConcepts: {
      nearestFairValueGaps: [
        { kind: "FVG", bottom: 4088, top: 4090, direction: "BULLISH", status: "DETECTED", active: true, source: "AMY_CONCEPT_ENGINE_V2" }
      ],
      nearestOrderBlocks: [
        { kind: "OB", bottom: 4084, top: 4086, direction: "BULLISH", status: "DETECTED", active: true, source: "AMY_CONCEPT_ENGINE_V2" }
      ]
    }
  };
  const localStorage = storage({ last_price: "4091.49" });
  const window = {
    state: { price: 4091.49, result },
    AmyFXIntel: {
      read() { return intelState; },
      partTimestamp(part) { return new Date(part?.updated || 0).getTime(); },
      nearestLevels() { return { bsl: { price: 4110.15 }, ssl: { price: 4084.14 } }; }
    },
    addEventListener() {},
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
    querySelectorAll() { return []; }
  };
  const sandbox = {
    window,
    document,
    localStorage,
    sessionStorage: storage(),
    location: { pathname: "/apps/mapping/index.html" },
    CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
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
    JSON
  };
  vm.runInNewContext(repairSource, sandbox, { filename: repairPath });
  return { window, localStorage, result };
}

test("Intel Liquidity is authoritative over newer Mapping BSL and SSL snapshots", () => {
  const runtime = repairRuntime();
  const levels = runtime.window.AmyFXProfessionalMarketRepair.nearestLevels();
  assert.equal(levels.bsl.price, 4092);
  assert.equal(levels.ssl.price, 4087.5);
  assert.equal(runtime.window.AmyFXIntel.nearestLevels().bsl.price, 4092);
  assert.equal(runtime.window.AmyFXIntel.nearestLevels().ssl.price, 4087.5);
});

test("FVG and Order Block are read from the current Mapping concept engine and persisted", () => {
  const runtime = repairRuntime();
  const fvg = runtime.window.AmyFXProfessionalMarketRepair.answer("Fvg terdekat");
  const ob = runtime.window.AmyFXProfessionalMarketRepair.answer("OB terdekat");
  assert.match(fvg, /4\.088–4\.090/);
  assert.match(fvg, /Mapping engine/);
  assert.match(ob, /4\.084–4\.086/);
  const stored = JSON.parse(runtime.localStorage.getItem("amyfx.bot.mapping.zones.v1"));
  assert.equal(stored.fvg.low, 4088);
  assert.equal(stored.ob.high, 4086);

  runtime.window.state.result = null;
  assert.match(runtime.window.AmyFXProfessionalMarketRepair.answer("FVG terdekat"), /4\.088–4\.090/);
});

function handlerRuntime() {
  let buildContextCalls = 0;
  const marketAnswer = question => /bullish|bearish|market/i.test(question) ? "Arah dominan engine BULLISH." : null;
  const repairAnswer = question => /fvg/i.test(question) ? "FVG aktif terdekat berada di area 4.088–4.090." : null;
  const bot = {
    __amyProfessionalMarketSourceRegistryV1: true,
    answer: async () => "Jawaban bot dasar."
  };
  const window = {
    __amyFxProfessionalMarketSourceRegistryV1: true,
    __amyFxProfessionalMarketRepairV1: true,
    AmyFXMarketSourceRegistry: { answer: marketAnswer },
    AmyFXProfessionalMarketRepair: { answer: repairAnswer },
    AmyFXProfessionalBot: bot,
    AmyFXMappingIntentHotfix: bot,
    AmyFXOS: {
      async buildContext() {
        buildContextCalls += 1;
        return new Promise(() => {});
      },
      async ask() { return { text: "legacy" }; }
    },
    addEventListener() {},
    dispatchEvent() {},
    setInterval() { return 0; },
    clearInterval() {},
    setTimeout(callback) { return setTimeout(callback, 0); },
    clearTimeout(id) { clearTimeout(id); }
  };
  const document = {
    readyState: "complete",
    currentScript: { src: "file:///android_asset/apps/shared/amyfx-professional-bot-handler-lock-v1.js" },
    hidden: false,
    body: null,
    documentElement: null,
    addEventListener() {},
    querySelector() { return null; },
    createElement() { return {}; }
  };
  const sandbox = {
    window,
    document,
    location: { pathname: "/apps/mapping/index.html" },
    CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    MutationObserver: undefined,
    URL,
    Promise,
    Object,
    String,
    Boolean,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(handlerSource, sandbox, { filename: handlerPath });
  return { window, buildContextCalls: () => buildContextCalls };
}

test("market direction and FVG answers bypass a buildContext promise that never resolves", async () => {
  const runtime = handlerRuntime();
  const direction = await Promise.race([
    runtime.window.AmyFXOS.ask("Market sedang bullish atau bearish"),
    new Promise((_, reject) => setTimeout(() => reject(new Error("direction timed out")), 100))
  ]);
  const fvg = await Promise.race([
    runtime.window.AmyFXOS.ask("FVG terdekat"),
    new Promise((_, reject) => setTimeout(() => reject(new Error("FVG timed out")), 100))
  ]);
  assert.match(direction.text, /BULLISH/);
  assert.match(fvg.text, /4\.088–4\.090/);
  assert.equal(runtime.buildContextCalls(), 0);
});

test("handler loads the repair runtime and limits slow context building", () => {
  assert.match(handlerSource, /amyfx-professional-market-repair-v1\.js/);
  assert.match(handlerSource, /fastMarketAnswer\(question, context\)/);
  assert.match(handlerSource, /CONTEXT_TIMEOUT_MS = 2_500/);
  assert.match(handlerSource, /loadMarketSourceRegistryRuntime\(startLocking\)/);
});