import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const hotfixPath = resolve(root, "app/src/main/assets/apps/shared/amyfx-mentor-mapping-intent-hotfix-v1.js");
const providerPath = resolve(root, "app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js");
const blueprintPath = resolve(root, "app/src/main/assets/apps/shared/amyfx-blueprint-v1.js");
const hotfixSource = readFileSync(hotfixPath, "utf8");
const providerSource = readFileSync(providerPath, "utf8");
const blueprintSource = readFileSync(blueprintPath, "utf8");

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

function mappingContext({ capturedAt = new Date().toISOString(), price = 4100 } = {}) {
  return {
    source_module: "mapping",
    captured_at: capturedAt,
    freshness: { state: "expired" },
    payload: {
      workspace: {
        market: {
          captured_at: capturedAt,
          current_price: price,
          live_state: {
            timeframe: "M15",
            capturedAt,
            price,
            directionDecision: {
              signal: "NO CLEAR DIRECTION",
              higherTimeframeBias: "BULLISH"
            },
            result: {
              liquidityLevels: [
                { type: "BSL", price: 4092, status: "CONSUMED", active: false },
                { type: "BSL", price: 4105, status: "ACTIVE", active: true },
                { type: "BSL", price: 4098, status: "ACTIVE", active: true },
                { type: "SSL", price: 4087, status: "CONSUMED", active: false },
                { type: "SSL", price: 4075, status: "ACTIVE", active: true },
                { type: "SSL", price: 4102, status: "ACTIVE", active: true }
              ],
              orderBlocks: [
                { low: 4085, high: 4088, status: "MITIGATED", active: false },
                { low: 4078, high: 4081, status: "ACTIVE", active: true }
              ],
              fairValueGaps: [
                { low: 4094, high: 4097, status: "FILLED", active: false },
                { low: 4082, high: 4084, status: "ACTIVE", active: true }
              ],
              supplyDemandZones: [
                { low: 4068, high: 4072, status: "ACTIVE", active: true }
              ],
              structure: "Bullish structure",
              invalidation: 4065,
              targets: [4105, 4118]
            }
          },
          shared_intelligence: {
            mapping: {
              timeframe: "M15",
              updated: capturedAt,
              price,
              bsl: 4092,
              ssl: 4087
            }
          }
        }
      }
    }
  };
}

function createRuntime({ context = mappingContext(), pathname = "/apps/mapping/index.html", localSeed = {} } = {}) {
  let contextValue = context;
  let originalCalls = 0;
  const session = storage();
  const local = storage(localSeed);
  const listeners = new Map();
  const window = {
    __amyFxMentorRuleChatSafeV3: true,
    AmyFXOS: {
      __amySafeRuleChatV3: true,
      async ask(question) { originalCalls += 1; return { text: `generic:${question}`, provider: "amy-bot" }; },
      async buildContext() { return contextValue; },
      getGlobalSettings() { return { key_refs: [] }; }
    },
    AmyFXIntel: { read() { return contextValue?.payload?.workspace?.market?.shared_intelligence || {}; } },
    addEventListener(name, callback) { listeners.set(name, callback); },
    dispatchEvent() {},
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout
  };
  const document = {
    readyState: "complete",
    hidden: false,
    body: null,
    documentElement: null,
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const sandbox = {
    window,
    document,
    location: { pathname },
    sessionStorage: session,
    localStorage: local,
    indexedDB: undefined,
    MutationObserver: undefined,
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
    JSON,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(hotfixSource, sandbox, { filename: hotfixPath });
  return {
    window,
    local,
    session,
    setContext(value) { contextValue = value; },
    originalCalls() { return originalCalls; }
  };
}

test("provider loader keeps Mapping lifecycle runtime after safe rule chat", () => {
  assert.match(providerSource, /amyfx-mentor-mapping-intent-hotfix-v1\.js/);
  assert.match(providerSource, /loadScriptOnce\("amyfx-mentor-rule-chat-safe-v3\.js"[\s\S]*loadMappingIntentHotfixRuntime\)/);
  assert.match(hotfixSource, /const VERSION = "2\.0\.0"/);
  assert.match(hotfixSource, /amyfx\.mapping\.snapshot\.v2/);
});

test("consumed liquidity is ignored and Amy gives the next directional BSL and SSL", async () => {
  const runtime = createRuntime();
  const bsl = await runtime.window.AmyFXOS.ask("BSL di mana?", { sourceModule: "mapping" });
  assert.match(bsl.text, /BSL 4\.092 sudah tersapu/);
  assert.match(bsl.text, /BSL aktif berikutnya berada di 4\.105/);
  assert.doesNotMatch(bsl.text, /4\.098/);

  const ssl = await runtime.window.AmyFXOS.ask("SSL di mana?", { sourceModule: "mapping" });
  assert.match(ssl.text, /SSL 4\.087 sudah tersapu/);
  assert.match(ssl.text, /SSL aktif berikutnya berada di 4\.075/);
  assert.doesNotMatch(ssl.text, /4\.102/);
});

test("Mapping levels survive quote TTL and only end through lifecycle events", async () => {
  const stale = mappingContext({ capturedAt: "2026-01-01T00:00:00.000Z" });
  const runtime = createRuntime({ context: stale });
  const bsl = await runtime.window.AmyFXOS.ask("BSL sekarang", { sourceModule: "mapping" });
  assert.match(bsl.text, /4\.105/);
  assert.doesNotMatch(bsl.text, /jalankan ulang/i);
  assert.doesNotMatch(bsl.text, /sedang expired/i);

  const freshness = await runtime.window.AmyFXOS.ask("status data mapping", { sourceModule: "mapping" });
  assert.match(freshness.text, /Harga live M15 perlu diperbarui/);
  assert.match(freshness.text, /level Mapping tidak otomatis expired/i);
  assert.match(freshness.text, /tersapu, termitigasi, digantikan, atau invalid/i);
});

test("Amy understands OB, FVG, SND, structure, invalidation and targets", async () => {
  const runtime = createRuntime();
  const ob = await runtime.window.AmyFXOS.ask("OB saat ini", { sourceModule: "mapping" });
  assert.match(ob.text, /OB 4\.085–4\.088 sudah termitigasi/);
  assert.match(ob.text, /OB aktif berikutnya berada di area 4\.078–4\.081/);

  const fvg = await runtime.window.AmyFXOS.ask("FVG aktif", { sourceModule: "mapping" });
  assert.match(fvg.text, /FVG 4\.094–4\.097 sudah termitigasi/);
  assert.match(fvg.text, /4\.082–4\.084/);

  const snd = await runtime.window.AmyFXOS.ask("SND di mana", { sourceModule: "mapping" });
  assert.match(snd.text, /4\.068–4\.072/);

  assert.match((await runtime.window.AmyFXOS.ask("struktur market", { sourceModule: "mapping" })).text, /Bullish structure/);
  assert.match((await runtime.window.AmyFXOS.ask("invalidasi", { sourceModule: "mapping" })).text, /4\.065/);
  assert.match((await runtime.window.AmyFXOS.ask("target mapping", { sourceModule: "mapping" })).text, /4\.105, 4\.118/);
});

test("Amy separates M15 direction from the larger market direction", async () => {
  const runtime = createRuntime();
  const intraday = await runtime.window.AmyFXOS.ask("arah market", { sourceModule: "mapping" });
  assert.match(intraday.text, /M15 saat ini belum jelas/);
  assert.match(intraday.text, /arah market besarnya masih BULLISH/);

  const large = await runtime.window.AmyFXOS.ask("arah market besarnya", { sourceModule: "mapping" });
  assert.match(large.text, /Arah market besarnya saat ini BULLISH/);
  assert.match(large.text, /Arah M15 NO CLEAR DIRECTION/);
});

test("Mapping state does not hijack a later Journal question", async () => {
  const runtime = createRuntime();
  await runtime.window.AmyFXOS.ask("Mapping", { sourceModule: "home" });
  const journal = await runtime.window.AmyFXOS.ask("berapa jurnal ku", { sourceModule: "home" });
  assert.equal(journal.text, "generic:berapa jurnal ku");
  assert.equal(runtime.originalCalls(), 1);
});

test("persisted Mapping snapshot is readable from Home without reopening Mapping", async () => {
  const persisted = {
    schema: "AmyFXMappingSnapshotV2",
    schemaVersion: 2,
    pair: "XAU/USD",
    timeframe: "M15",
    capturedAt: "2026-01-01T00:00:00.000Z",
    storedAt: "2026-01-01T00:00:00.000Z",
    price: 4100,
    quoteFresh: false,
    structuralValid: true,
    direction: "BEARISH",
    higherTimeframeDirection: "BEARISH",
    levels: [
      { kind: "BSL", type: "BSL", price: 4110, low: 4110, high: 4110, status: "ACTIVE", active: true },
      { kind: "SSL", type: "SSL", price: 4080, low: 4080, high: 4080, status: "ACTIVE", active: true }
    ],
    zones: { OB: [], FVG: [], SND: [] }
  };
  const emptyHome = { source_module: "home", payload: { workspace: { market: {} } } };
  const runtime = createRuntime({
    context: emptyHome,
    pathname: "/index.html",
    localSeed: { "amyfx.mapping.snapshot.v2": JSON.stringify(persisted) }
  });
  const answer = await runtime.window.AmyFXOS.ask("BSL di mana", { sourceModule: "home" });
  assert.match(answer.text, /4\.110/);
});

test("Amy greeting is short and no longer mentions customer service chat", async () => {
  const runtime = createRuntime();
  const result = await runtime.window.AmyFXOS.ask("hai", { sourceModule: "home" });
  assert.match(result.text, /^Hai, selamat (pagi|siang|sore|malam)\. Aku Amy, asisten Anda\. Ada yang bisa kubantu\?$/);
  assert.doesNotMatch(result.text, /customer service|langsung menulis/i);
  assert.match(hotfixSource, /data-amy-safe-welcome/);
});

test("Operating System is moved to Profile and user-facing metrics are sanitized", () => {
  assert.match(hotfixSource, /isProfileVisible/);
  assert.match(hotfixSource, /section\.hidden = !profile/);
  assert.match(hotfixSource, /list\.insertAdjacentElement\("beforebegin", section\)/);
  assert.match(hotfixSource, /Belum ada jurnal/);
  assert.match(hotfixSource, /API siap digunakan/);
  assert.doesNotMatch(hotfixSource, /migration\.textContent = migration\.state/);
  assert.match(blueprintSource, /data-amy-command-center/);
});
