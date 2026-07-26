"use strict";

(function () {
  if (window.__amyFxMappingContextBridgeV1) return;
  window.__amyFxMappingContextBridgeV1 = true;

  let lastFingerprint = "";
  let lastSharedFingerprint = "";
  let timer = 0;
  let writingShared = false;

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

  function capturedAtFrom(result) {
    const candidates = [
      result?.capturedAt,
      result?.captured_at,
      result?.updatedAt,
      result?.timestamp,
      Number(localStorage.getItem("last_ws_tick_at") || 0),
      Number(localStorage.getItem("last_candle_update_at") || 0)
    ];
    const valid = candidates.map(validTimestamp).filter(Boolean);
    if (!valid.length) return null;
    return valid.sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
  }

  function normalizeLevels(result) {
    const sources = [
      result?.liquidityLevels,
      result?.levels,
      result?.liquidity?.levels,
      result?.validatedMarketContext?.liquidityLevels
    ];
    const rows = sources.find(Array.isArray) || [];
    return rows.slice(0, 80).map(item => ({
      type: text(item?.type || item?.liquidityType).toUpperCase(),
      price: Number(item?.price ?? item?.level) || null,
      status: text(item?.status || "ACTIVE").toUpperCase(),
      active: item?.active !== false,
      strength: Number(item?.strength ?? item?.score) || null
    })).filter(item => ["BSL", "SSL"].includes(item.type) && item.price);
  }

  function sharedPayload(marketState) {
    const setup = marketState.setup || {};
    const direction = marketState.directionDecision || {};
    const levels = normalizeLevels(marketState.result);
    const nearest = type => levels
      .filter(level => level.type === type && level.active && !/(SWEPT|INVALID|BROKEN|EXPIRED|HISTORICAL)/.test(level.status))
      .sort((left, right) => Math.abs(left.price - marketState.price) - Math.abs(right.price - marketState.price))[0] || null;
    return {
      pair: marketState.pair,
      timeframe: marketState.timeframe,
      price: marketState.price,
      updated: marketState.capturedAt,
      capturedAt: marketState.capturedAt,
      connection: marketState.connection,
      dataStale: marketState.dataStale,
      status: text(setup.state || setup.status || direction.signal || "WAIT").toUpperCase(),
      direction: text(direction.signal || direction.bias || marketState.hypothesis?.direction || "WAIT").toUpperCase(),
      bias: text(direction.bias || marketState.hypothesis?.bias || "WAIT").toUpperCase(),
      setup: setup || null,
      bsl: nearest("BSL")?.price || null,
      ssl: nearest("SSL")?.price || null,
      levels,
      source: "mapping-context-bridge-v2"
    };
  }

  function publishShared(marketState) {
    if (writingShared || !window.AmyFXIntel?.write) return false;
    if (!marketState.capturedAt || !marketState.price || marketState.dataStale) return false;
    const payload = sharedPayload(marketState);
    const fingerprint = JSON.stringify([
      payload.timeframe,
      payload.price,
      payload.updated,
      payload.status,
      payload.direction,
      payload.bsl,
      payload.ssl,
      payload.levels.length
    ]);
    if (fingerprint === lastSharedFingerprint) return true;
    lastSharedFingerprint = fingerprint;
    writingShared = true;
    try {
      window.AmyFXIntel.write("mapping", payload);
      return true;
    } catch {
      return false;
    } finally {
      writingShared = false;
    }
  }

  function publish(force = false) {
    const state = window.state;
    if (!state || typeof state !== "object" || !("tf" in state)) return false;

    const result = state.result || null;
    const capturedAt = capturedAtFrom(result);
    const setup = setupFrom(result);
    const price = Number(state.price || result?.price || localStorage.getItem("last_price") || 0);
    const timeframe = text(result?.tf || state.tf || "M15").toUpperCase();
    const direction = result?.directionDecision || null;
    const dataStale = Boolean(result?.dataStale || !capturedAt || !(Number.isFinite(price) && price > 0));
    const fingerprint = JSON.stringify([
      timeframe,
      price,
      capturedAt,
      dataStale,
      setup?.setupId || setup?.id || setup?.status || setup?.state || "",
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
      dataStale,
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
      bestSetup: setup,
      dataStale
    };
    publishShared(marketState);
    window.dispatchEvent(new CustomEvent("amyfx:mapping-state-change", { detail: marketState }));
    return true;
  }

  function boot() {
    publish(true);
    clearInterval(timer);
    timer = window.setInterval(() => {
      if (!document.hidden) publish();
    }, 1000);
    window.addEventListener("amyfx:market-update", () => {
      if (!writingShared) publish(true);
    });
    window.addEventListener("focus", () => publish(true));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) publish(true);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  window.AmyFXMappingContextBridge = Object.freeze({ publish, publishShared });
})();
