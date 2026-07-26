"use strict";

(function () {
  if (window.__amyFxMappingContextBridgeV1) return;
  window.__amyFxMappingContextBridgeV1 = true;

  let lastFingerprint = "";
  let timer = 0;

  function text(value) {
    return String(value ?? "").trim();
  }

  function validTimestamp(value) {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) && time > 86_400_000 ? new Date(time).toISOString() : null;
  }

  function setupFrom(result) {
    return result?.setupExecution
      || result?.experimentalBestSetup
      || result?.bestSetup
      || result?.entryMap?.setup
      || null;
  }

  function capturedAtFrom(state, result) {
    const candidates = [
      result?.capturedAt,
      result?.captured_at,
      result?.updatedAt,
      result?.timestamp,
      Number(localStorage.getItem("last_ws_tick_at") || 0),
      Number(localStorage.getItem("last_candle_update_at") || 0)
    ];
    for (const candidate of candidates) {
      const value = validTimestamp(candidate);
      if (value) return value;
    }
    return Number(state?.price || result?.price || 0) > 0 && result ? new Date().toISOString() : null;
  }

  function publish(force = false) {
    const state = window.state;
    if (!state || typeof state !== "object" || !("tf" in state)) return false;

    const result = state.result || null;
    const capturedAt = capturedAtFrom(state, result);
    const setup = setupFrom(result);
    const price = Number(state.price || result?.price || localStorage.getItem("last_price") || 0);
    const timeframe = text(result?.tf || state.tf || "M15").toUpperCase();
    const direction = result?.directionDecision || null;
    const fingerprint = JSON.stringify([
      timeframe,
      price,
      capturedAt,
      setup?.setupId || setup?.id || setup?.status || "",
      direction?.bias || direction?.signal || "",
      state.conn || ""
    ]);
    if (!force && fingerprint === lastFingerprint) return true;
    lastFingerprint = fingerprint;

    const marketState = {
      pair: "XAU/USD",
      symbol: "XAU/USD",
      timeframe,
      capturedAt,
      updatedAt: capturedAt,
      price: Number.isFinite(price) && price > 0 ? price : null,
      connection: text(state.conn || "Offline"),
      facts: result?.facts || result?.validatedMarketContext?.facts || {},
      hypothesis: result?.hypothesis || result?.validatedMarketContext?.directionForecast || null,
      setup,
      bestSetup: setup,
      evidence: result?.evidence || [],
      conflicts: result?.conflicts || [],
      directionDecision: direction,
      dataStale: Boolean(result?.dataStale),
      result
    };

    window.AmyFXMarketState = marketState;
    window.lastMappingResult = {
      ...(result || {}),
      symbol: "XAU/USD",
      pair: "XAU/USD",
      timeframe,
      tf: timeframe,
      capturedAt,
      timestamp: capturedAt,
      price: marketState.price,
      setup,
      bestSetup: setup
    };
    window.dispatchEvent(new CustomEvent("amyfx:mapping-state-change", { detail: marketState }));
    return true;
  }

  function boot() {
    publish(true);
    clearInterval(timer);
    timer = window.setInterval(() => {
      if (!document.hidden) publish();
    }, 1000);
    window.addEventListener("amyfx:market-update", () => publish(true));
    window.addEventListener("focus", () => publish(true));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) publish(true);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  window.AmyFXMappingContextBridge = Object.freeze({ publish });
})();
