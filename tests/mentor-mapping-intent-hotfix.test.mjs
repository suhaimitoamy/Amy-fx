import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const hotfixPath = resolve(root, "app/src/main/assets/apps/shared/amyfx-mentor-mapping-intent-hotfix-v1.js");
const providerPath = resolve(root, "app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js");
const hotfixSource = readFileSync(hotfixPath, "utf8");
const providerSource = readFileSync(providerPath, "utf8");

function storage() {
  const rows = new Map();
  return {
    getItem(key) { return rows.has(key) ? rows.get(key) : null; },
    setItem(key, value) { rows.set(key, String(value)); },
    removeItem(key) { rows.delete(key); }
  };
}

function freshContext() {
  const capturedAt = new Date().toISOString();
  return {
    source_module: "mapping",
    captured_at: capturedAt,
    freshness: { state: "fresh" },
    payload: {
      workspace: {
        market: {
          captured_at: capturedAt,
          current_price: 4109,
          live_state: {
            timeframe: "M15",
            capturedAt,
            price: 4109,
            dataStale: false,
            result: {
              liquidityLevels: [
                { type: "BSL", price: 4116.43, status: "ACTIVE", active: true },
                { type: "SSL", price: 4012.26, status: "ACTIVE", active: true }
              ]
            }
          },
          shared_intelligence: {
            mapping: {
              timeframe: "M15",
              updated: capturedAt,
              price: 4109,
              bsl: 4116.43,
              ssl: 4012.26
            }
          }
        }
      }
    }
  };
}

function createRuntime() {
  let contextValue = freshContext();
  const session = storage();
  const local = storage();
  const window = {
    __amyFxMentorRuleChatSafeV3: true,
    AmyFXOS: {
      __amySafeRuleChatV3: true,
      async ask() { return { text: "generic", provider: "amy-bot" }; },
      async buildContext() { return contextValue; }
    },
    AmyFXIntel: { read() { return contextValue.payload.workspace.market.shared_intelligence; } },
    addEventListener() {},
    dispatchEvent() {},
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout
  };
  const document = {
    readyState: "complete",
    addEventListener() {}
  };
  const sandbox = {
    window,
    document,
    location: { pathname: "/apps/mapping/index.html" },
    sessionStorage: session,
    localStorage: local,
    CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    Intl,
    Date,
    Number,
    Object,
    Array,
    String,
    Boolean,
    RegExp,
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
    setContext(value) { contextValue = value; }
  };
}

test("provider loader chains mapping intent hotfix after safe rule chat", () => {
  assert.match(providerSource, /amyfx-mentor-mapping-intent-hotfix-v1\.js/);
  assert.match(providerSource, /loadScriptOnce\("amyfx-mentor-rule-chat-safe-v3\.js"[\s\S]*loadMappingIntentHotfixRuntime\)/);
});

test("mapping hotfix is bounded and does not install a global DOM observer", () => {
  assert.doesNotMatch(hotfixSource, /MutationObserver/);
  assert.match(hotfixSource, /attempts >= 240/);
  assert.match(hotfixSource, /window\.clearInterval\(timer\)/);
});

test("Amy answers BSL and standalone Mapping instead of generic fallback", async () => {
  const runtime = createRuntime();
  const bsl = await runtime.window.AmyFXOS.ask("Bsl dimana", { sourceModule: "mapping" });
  assert.match(bsl.text, /BSL aktif terdekat ada di 4\.116/);
  assert.doesNotMatch(bsl.text, /belum menangkap bagian/i);

  const mapping = await runtime.window.AmyFXOS.ask("Mapping", { sourceModule: "mapping" });
  assert.match(mapping.text, /BSL, SSL, arah market, setup aktif, harga, atau status datanya/);

  const followUp = await runtime.window.AmyFXOS.ask("Ini tentang mapping", { sourceModule: "mapping" });
  assert.match(followUp.text, /Di Mapping kamu mau cek/);
});

test("Amy refuses to expose expired SSL levels", async () => {
  const runtime = createRuntime();
  const stale = freshContext();
  stale.captured_at = "2026-01-01T00:00:00.000Z";
  stale.freshness.state = "expired";
  stale.payload.workspace.market.captured_at = stale.captured_at;
  stale.payload.workspace.market.live_state.capturedAt = stale.captured_at;
  stale.payload.workspace.market.live_state.dataStale = true;
  stale.payload.workspace.market.shared_intelligence.mapping.updated = stale.captured_at;
  runtime.setContext(stale);

  const ssl = await runtime.window.AmyFXOS.ask("SSL dimana", { sourceModule: "mapping" });
  assert.match(ssl.text, /sedang expired/i);
  assert.doesNotMatch(ssl.text, /4\.012/);
});
