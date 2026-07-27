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
    source_module: "home",
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
            },
            news: {
              items: [
                { title: "Initial Jobless Claims", actual: "220K", forecast: "215K", previous: "210K", time: "20:30 WITA" }
              ]
            }
          }
        },
        trading: {
          journal: {
            summary: {
              total: 18,
              win: 11,
              loss: 6,
              break_even: 1,
              completed: 18,
              win_rate: 61.1,
              total_profit: 300,
              total_loss: 120,
              net_result: 180
            },
            recent: [{ title: "XAU scalp", result: "win", date: "2026-07-27" }],
            relevant: [{ mistakes: ["Entry terlalu cepat"] }]
          },
          library: {
            catalog: { total: 7, titles: [{ title: "Mapping Notes" }] },
            relevant: [{ title: "Mapping Notes" }],
            personal_notes: []
          }
        },
        academy: {
          progress: { read_count: 5, total_sections: 36, percentage: 14, last_title: "Bias Market", read_topics: ["a"] },
          catalog: [
            { title: "Bias Market", description: "Dasar bias" },
            { title: "Likuiditas", description: "Membaca BSL dan SSL" }
          ],
          relevant_lessons: [
            { title: "Likuiditas", passage: "Likuiditas adalah area kumpulan order. Gunakan sebagai target, bukan alasan entry tunggal." }
          ]
        },
        indicators: { total: 3, catalog: [{ name: "AMY Mapping" }], relevant: [] },
        system: {
          app: {
            active_module: "home",
            online: true,
            version: { versionName: "2.0.0-preview.48" },
            update: { version: "2.0.0-preview.49", versionCode: 930049, enabled: true }
          },
          ai: { providers: [{ id: "stored-key" }], native_secret_count: 1 }
        }
      }
    }
  };
}

function createRuntime({ context = mappingContext(), pathname = "/index.html", localSeed = {} } = {}) {
  let contextValue = context;
  let originalCalls = 0;
  const session = storage();
  const local = storage(localSeed);
  const window = {
    AmyFXOS: {
      async ask(question) { originalCalls += 1; return { text: `provider:${question}`, provider: "gemini" }; },
      async buildContext() { return contextValue; },
      getGlobalSettings() { return { key_refs: [{ id: "stored-key" }] }; }
    },
    AmyFXIntel: { read() { return contextValue?.payload?.workspace?.market?.shared_intelligence || {}; } },
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
    body: null,
    documentElement: null,
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { className: "", dataset: {}, textContent: "", appendChild() {} }; }
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
    setInterval() { return 0; },
    clearInterval() {},
    setTimeout() { return 0; },
    clearTimeout() {}
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

test("provider loader keeps professional bot after universal and safe-rule runtimes", () => {
  assert.match(providerSource, /amyfx-mentor-mapping-intent-hotfix-v1\.js/);
  assert.match(providerSource, /loadScriptOnce\("amyfx-mentor-rule-chat-safe-v3\.js"[\s\S]*loadMappingIntentHotfixRuntime\)/);
  assert.match(hotfixSource, /const VERSION = "3\.0\.0"/);
  assert.match(hotfixSource, /professional-bot-v3/);
  assert.match(hotfixSource, /amyfx\.mapping\.snapshot\.v2/);
});

test("full bot never calls Gemini, OpenRouter, or DeepSeek", async () => {
  const runtime = createRuntime();
  const result = await runtime.window.AmyFXOS.ask("apa kabar", { sourceModule: "home" });
  assert.equal(result.provider, "amy-bot");
  assert.equal(result.mode, "full-bot");
  assert.equal(runtime.originalCalls(), 0);
  assert.match(result.text, /belum memiliki pola jawaban/i);
});

test("consumed liquidity is ignored and Amy gives the next directional BSL and SSL", async () => {
  const runtime = createRuntime();
  const bsl = await runtime.window.AmyFXOS.ask("BSL di mana?");
  assert.match(bsl.text, /BSL 4\.092 sudah tersapu/);
  assert.match(bsl.text, /BSL aktif berikutnya berada di 4\.105/);
  assert.doesNotMatch(bsl.text, /4\.098/);

  const ssl = await runtime.window.AmyFXOS.ask("SSL di mana?");
  assert.match(ssl.text, /SSL 4\.087 sudah tersapu/);
  assert.match(ssl.text, /SSL aktif berikutnya berada di 4\.075/);
  assert.doesNotMatch(ssl.text, /4\.102/);
});

test("market direction includes real area, liquidity target, and invalidation", async () => {
  const runtime = createRuntime();
  const result = await runtime.window.AmyFXOS.ask("sekarang arah market kemana");
  assert.match(result.text, /M15 saat ini belum jelas/);
  assert.match(result.text, /arah market besarnya masih BULLISH/);
  assert.match(result.text, /OB 4\.078–4\.081/);
  assert.match(result.text, /target likuiditas BSL 4\.105/);
  assert.match(result.text, /invalidasi 4\.065/);
  assert.doesNotMatch(result.text, /demand/i);
});

test("Mapping levels survive quote TTL and only end through lifecycle events", async () => {
  const stale = mappingContext({ capturedAt: "2026-01-01T00:00:00.000Z" });
  const runtime = createRuntime({ context: stale });
  const bsl = await runtime.window.AmyFXOS.ask("BSL sekarang");
  assert.match(bsl.text, /4\.105/);
  assert.doesNotMatch(bsl.text, /jalankan ulang/i);
  const freshness = await runtime.window.AmyFXOS.ask("status data mapping");
  assert.match(freshness.text, /Harga live M15 perlu diperbarui/);
  assert.match(freshness.text, /level Mapping tidak otomatis expired/i);
});

test("Amy understands OB, FVG, SND, structure, invalidation, targets, and typo variants", async () => {
  const runtime = createRuntime();
  assert.match((await runtime.window.AmyFXOS.ask("OB saat ini")).text, /4\.078–4\.081/);
  assert.match((await runtime.window.AmyFXOS.ask("FVG aktif")).text, /4\.082–4\.084/);
  assert.match((await runtime.window.AmyFXOS.ask("SND di mana")).text, /4\.068–4\.072/);
  assert.match((await runtime.window.AmyFXOS.ask("struktur market")).text, /Bullish structure/);
  assert.match((await runtime.window.AmyFXOS.ask("invalidasi")).text, /4\.065/);
  assert.match((await runtime.window.AmyFXOS.ask("target maping")).text, /4\.105, 4\.118/);
});

test("Journal questions switch cleanly from Mapping and stay deterministic", async () => {
  const runtime = createRuntime();
  await runtime.window.AmyFXOS.ask("Mapping");
  const summary = await runtime.window.AmyFXOS.ask("berapa progres jurnl saya");
  assert.match(summary.text, /18 jurnal: 11 win, 6 loss, dan 1 break-even/);
  assert.match((await runtime.window.AmyFXOS.ask("win rate jurnal")).text, /61,1%/);
  assert.match((await runtime.window.AmyFXOS.ask("trade terakhir")).text, /XAU scalp/);
  assert.match((await runtime.window.AmyFXOS.ask("kesalahan jurnal")).text, /Entry terlalu cepat/);
  assert.equal(runtime.originalCalls(), 0);
});

test("Academy, News, Library, Indicators, and System have direct bot answers", async () => {
  const runtime = createRuntime();
  assert.match((await runtime.window.AmyFXOS.ask("sampai mana belajar saya")).text, /5 dari 36/);
  assert.match((await runtime.window.AmyFXOS.ask("materi berikutnya")).text, /Likuiditas/);
  assert.match((await runtime.window.AmyFXOS.ask("news terbaru")).text, /Initial Jobless Claims/);
  assert.match((await runtime.window.AmyFXOS.ask("berapa isi library")).text, /7 item/);
  assert.match((await runtime.window.AmyFXOS.ask("berapa indikator")).text, /3 indikator/);
  assert.match((await runtime.window.AmyFXOS.ask("api dipakai tidak")).text, /full bot lokal/i);
  assert.match((await runtime.window.AmyFXOS.ask("versi aplikasi")).text, /2\.0\.0-preview\.48/);
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
  const emptyHome = { source_module: "home", payload: { workspace: { market: {}, trading: { journal: { summary: {} }, library: { catalog: {} } }, academy: {}, indicators: {}, system: {} } } };
  const runtime = createRuntime({
    context: emptyHome,
    pathname: "/index.html",
    localSeed: { "amyfx.mapping.snapshot.v2": JSON.stringify(persisted) }
  });
  const answer = await runtime.window.AmyFXOS.ask("BSL di mana");
  assert.match(answer.text, /4\.110/);
});

test("Amy greeting and user-facing UI identify full bot mode", async () => {
  const runtime = createRuntime();
  const result = await runtime.window.AmyFXOS.ask("hai");
  assert.match(result.text, /^Hai, selamat (pagi|siang|sore|malam)\. Aku Amy, asisten Anda\. Ada yang bisa kubantu\?$/);
  assert.match(hotfixSource, /Full bot • semua modul/);
  assert.match(hotfixSource, /FULL BOT • TANPA API/);
  assert.match(hotfixSource, /Bot lokal aktif/);
  assert.doesNotMatch(hotfixSource, /return originalAsk\(question/);
  assert.match(blueprintSource, /data-amy-command-center/);
});
