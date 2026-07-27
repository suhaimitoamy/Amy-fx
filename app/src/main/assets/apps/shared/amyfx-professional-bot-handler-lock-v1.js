"use strict";

(function () {
  if (window.__amyFxProfessionalBotHandlerLockV1) return;
  window.__amyFxProfessionalBotHandlerLockV1 = true;

  const VERSION = "1.1.0";
  const ASK_MARKER = "__amyProfessionalBotHandlerLockV1";
  const BOT_SIGNATURE_MARKER = "__amyProfessionalBotRuntimeSignatureV1";
  const REGISTRY_FILE = "amyfx-professional-market-source-registry-v1.js";
  const SCRIPT_URL = document.currentScript?.src || "";
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

  function botSignature(bot = botRuntime()) {
    if (bot?.__amyProfessionalMarketSourceRegistryV1) return "market-source-registry-v1";
    if (bot?.__amyProfessionalBotV3) return "professional-bot-v3";
    return clean(bot?.version || bot?.VERSION || "base-bot");
  }

  function isAuthoritative(os = window.AmyFXOS, bot = botRuntime()) {
    return Boolean(os?.ask?.[ASK_MARKER] && os.ask[BOT_SIGNATURE_MARKER] === botSignature(bot));
  }

  function makeAsk(os, bot) {
    const buildContext = typeof os?.buildContext === "function" ? os.buildContext.bind(os) : null;
    const signature = botSignature(bot);
    const ask = async function (question, options = {}) {
      const sourceModule = options.sourceModule || currentModule();
      let context = options.context || null;
      if (!context && buildContext) context = await buildContext(sourceModule, { question });
      const text = await bot.answer(question, context || {});
      return {
        text: clean(text) || "Data untuk pertanyaan itu belum tersedia.",
        provider: "amy-bot",
        model: bot?.__amyProfessionalMarketSourceRegistryV1 ? "professional-market-source-registry-v1" : "professional-bot-handler-lock-v1",
        source: "Amy FX",
        route: "bot",
        mode: "full-bot",
        context: context || null
      };
    };
    Object.defineProperty(ask, ASK_MARKER, { value: true, enumerable: false });
    Object.defineProperty(ask, BOT_SIGNATURE_MARKER, { value: signature, enumerable: false });
    return ask;
  }

  function lock() {
    const os = window.AmyFXOS;
    const bot = botRuntime();
    if (!os?.ask || typeof bot?.answer !== "function") return false;
    if (isAuthoritative(os, bot)) return true;

    const ask = makeAsk(os, bot);
    window.AmyFXOS = Object.freeze({
      ...os,
      ask,
      __amyProfessionalBotV3: true,
      __amyProfessionalBotHandlerLockV1: true,
      __amyProfessionalMarketSourceRegistryV1: Boolean(bot.__amyProfessionalMarketSourceRegistryV1)
    });
    window.AmyFXBotMode = "full";
    window.dispatchEvent(new CustomEvent("amyfx:professional-bot-handler-locked", {
      detail: { version: VERSION, mode: "full-bot", runtime: botSignature(bot) }
    }));
    return true;
  }

  function runtimeUrl(filename) {
    return SCRIPT_URL ? new URL(filename, SCRIPT_URL).href : filename;
  }

  function loadMarketSourceRegistryRuntime(next) {
    if (window.__amyFxProfessionalMarketSourceRegistryV1) { next?.(); return; }
    if (!SCRIPT_URL || typeof document.createElement !== "function" || typeof document.querySelector !== "function") { next?.(); return; }
    const marker = "data-amyfx-professional-market-source-registry";
    const existing = document.querySelector(`script[${marker}]`);
    if (existing) {
      if (window.__amyFxProfessionalMarketSourceRegistryV1) next?.();
      else {
        existing.addEventListener?.("load", () => next?.(), { once: true });
        existing.addEventListener?.("error", () => next?.(), { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.src = runtimeUrl(REGISTRY_FILE);
    script.setAttribute(marker, "1");
    script.async = false;
    script.addEventListener("load", () => next?.(), { once: true });
    script.addEventListener("error", () => next?.(), { once: true });
    (document.head || document.documentElement)?.appendChild(script);
  }

  function interactionNeedsLock(event) {
    const target = event?.target;
    if (!target?.closest) return false;
    return Boolean(target.closest("[data-amy-input], [data-amy-send], [data-starter], .amy-os-panel"));
  }

  function lockBeforeInteraction(event) {
    if (interactionNeedsLock(event)) lock();
  }

  let lockingStarted = false;
  function startLocking() {
    if (lockingStarted) { lock(); return; }
    lockingStarted = true;
    lock();

    [
      "amyfx:safe-rule-chat-ready",
      "amyfx:universal-access-ready",
      "amyfx:professional-bot-ready",
      "amyfx:professional-market-source-registry-ready",
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

  function boot() {
    loadMarketSourceRegistryRuntime(startLocking);
    window.setTimeout(startLocking, 2_500);
  }

  window.AmyFXProfessionalBotHandlerLock = Object.freeze({ VERSION, lock, isAuthoritative, loadMarketSourceRegistryRuntime, botSignature });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
