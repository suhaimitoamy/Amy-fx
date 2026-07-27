import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const lockPath = resolve(root, "app/src/main/assets/apps/shared/amyfx-professional-bot-handler-lock-v1.js");
const providerPath = resolve(root, "app/src/main/assets/apps/shared/amyfx-provider-detection-v1.js");
const lockSource = readFileSync(lockPath, "utf8");
const providerSource = readFileSync(providerPath, "utf8");

function runtime() {
  let legacyCalls = 0;
  const listeners = new Map();
  const intervals = [];
  const window = {
    AmyFXProfessionalBot: {
      answer(question) {
        if (/bsl/i.test(question)) return "BSL aktif terdekat berada di 4.116.";
        return "Jawaban full bot.";
      }
    },
    AmyFXOS: {
      __amyProfessionalBotV3: true,
      async buildContext() { return { payload: { workspace: { market: {} } } }; },
      async ask() { legacyCalls += 1; return { text: "Aku belum menangkap bagian yang kamu maksud." }; }
    },
    addEventListener(name, callback) { listeners.set(name, callback); },
    dispatchEvent() {},
    setInterval(callback) { intervals.push(callback); return intervals.length; },
    clearInterval() {},
    setTimeout() { return 1; }
  };
  const document = {
    readyState: "complete",
    hidden: false,
    body: null,
    documentElement: null,
    addEventListener() {}
  };
  const sandbox = {
    window,
    document,
    location: { pathname: "/index.html" },
    CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    MutationObserver: undefined,
    Object,
    String,
    Boolean,
    RegExp,
    Array,
    Promise,
    setInterval: window.setInterval,
    clearInterval: window.clearInterval,
    setTimeout: window.setTimeout
  };
  vm.runInNewContext(lockSource, sandbox, { filename: lockPath });
  return { window, listeners, intervals, legacyCalls: () => legacyCalls };
}

test("provider loader always loads the handler lock after the professional bot runtime", () => {
  assert.match(providerSource, /amyfx-professional-bot-handler-lock-v1\.js/);
  assert.match(providerSource, /loadMappingIntentHotfixRuntime\([\s\S]*loadProfessionalBotHandlerLockRuntime/);
});

test("full bot answers BSL even when the OS object still carries a stale professional marker", async () => {
  const app = runtime();
  const result = await app.window.AmyFXOS.ask("Bsl terdekat dimana", { sourceModule: "home" });
  assert.equal(result.text, "BSL aktif terdekat berada di 4.116.");
  assert.equal(result.provider, "amy-bot");
  assert.equal(result.mode, "full-bot");
  assert.equal(app.legacyCalls(), 0);
  assert.equal(app.window.AmyFXProfessionalBotHandlerLock.isAuthoritative(), true);
});

test("handler lock repairs AmyFXOS after a legacy runtime overwrites ask and copies all markers", async () => {
  const app = runtime();
  const staleFallback = async () => ({ text: "Aku belum menangkap bagian yang kamu maksud." });
  app.window.AmyFXOS = Object.freeze({
    ...app.window.AmyFXOS,
    ask: staleFallback,
    __amyProfessionalBotV3: true,
    __amyProfessionalBotHandlerLockV1: true
  });

  assert.equal(app.window.AmyFXProfessionalBotHandlerLock.isAuthoritative(), false);
  assert.equal(app.window.AmyFXProfessionalBotHandlerLock.lock(), true);
  const result = await app.window.AmyFXOS.ask("BSL terdekat", { sourceModule: "home" });
  assert.match(result.text, /BSL aktif terdekat/);
  assert.doesNotMatch(result.text, /belum menangkap/i);
  assert.equal(app.window.AmyFXProfessionalBotHandlerLock.isAuthoritative(), true);
});
