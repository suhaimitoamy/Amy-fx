"use strict";

(function () {
  if (window.__amyFxProfessionalBotHandlerLockV1) return;
  window.__amyFxProfessionalBotHandlerLockV1 = true;

  const VERSION = "1.0.0";
  const ASK_MARKER = "__amyProfessionalBotHandlerLockV1";
  const clean = value => String(value ?? "").trim();

  function currentModule() {
    const path = location.pathname.toLowerCase();
    if (path.includes("/apps/mapping/")) return "mapping";
    if (path.includes("/apps/market-intel/")) return "intel";
    if (path.includes("/apps/journal/")) return "journal";
    if (path.includes("/apps/academy/")) return "academy";
    return "home";
  }

  function botRuntime() {
    return window.AmyFXProfessionalBot || window.AmyFXMappingIntentHotfix || null;
  }

  function isAuthoritative(os = window.AmyFXOS) {
    return Boolean(os?.ask?.[ASK_MARKER]);
  }

  function makeAsk(os, bot) {
    const buildContext = typeof os?.buildContext === "function" ? os.buildContext.bind(os) : null;
    const ask = async function (question, options = {}) {
      const sourceModule = options.sourceModule || currentModule();
      let context = options.context || null;
      if (!context && buildContext) context = await buildContext(sourceModule, { question });
      const text = await bot.answer(question, context || {});
      return {
        text: clean(text) || "Data untuk pertanyaan itu belum tersedia.",
        provider: "amy-bot",
        model: "professional-bot-handler-lock-v1",
        source: "Amy FX",
        route: "bot",
        mode: "full-bot",
        context: context || null
      };
    };
    Object.defineProperty(ask, ASK_MARKER, { value: true, enumerable: false });
    return ask;
  }

  function lock() {
    const os = window.AmyFXOS;
    const bot = botRuntime();
    if (!os?.ask || typeof bot?.answer !== "function") return false;
    if (isAuthoritative(os)) return true;

    const ask = makeAsk(os, bot);
    window.AmyFXOS = Object.freeze({
      ...os,
      ask,
      __amyProfessionalBotV3: true,
      __amyProfessionalBotHandlerLockV1: true
    });
    window.AmyFXBotMode = "full";
    window.dispatchEvent(new CustomEvent("amyfx:professional-bot-handler-locked", {
      detail: { version: VERSION, mode: "full-bot" }
    }));
    return true;
  }

  function interactionNeedsLock(event) {
    const target = event?.target;
    if (!target?.closest) return false;
    return Boolean(target.closest("[data-amy-input], [data-amy-send], [data-starter], .amy-os-panel"));
  }

  function lockBeforeInteraction(event) {
    if (interactionNeedsLock(event)) lock();
  }

  function boot() {
    lock();

    [
      "amyfx:safe-rule-chat-ready",
      "amyfx:universal-access-ready",
      "amyfx:professional-bot-ready",
      "amyfx:open-mentor"
    ].forEach(name => window.addEventListener(name, lock));

    ["pointerdown", "touchstart", "focusin", "input"].forEach(name => {
      document.addEventListener(name, lockBeforeInteraction, true);
    });
    window.addEventListener("focus", lock);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) lock(); });

    let attempts = 0;
    const rapid = window.setInterval(() => {
      attempts += 1;
      lock();
      if (attempts >= 200) window.clearInterval(rapid);
    }, 100);
    window.setTimeout(() => window.clearInterval(rapid), 25_000);

    window.setInterval(() => { if (!document.hidden) lock(); }, 1_500);
    const target = document.body || document.documentElement;
    if (target && typeof MutationObserver === "function") {
      new MutationObserver(lock).observe(target, { childList: true, subtree: true });
    }
  }

  window.AmyFXProfessionalBotHandlerLock = Object.freeze({ VERSION, lock, isAuthoritative });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
