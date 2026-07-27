"use strict";

import { state, nowTime } from "./main.js";
import { runAnalysis, isCandleStale } from "./api/market-data.js";

(function () {
  if (window.__amyFxMappingLiveConsistencyV1) return;
  window.__amyFxMappingLiveConsistencyV1 = true;

  const ANALYSIS_MAX_AGE_MS = 5 * 60 * 1000;
  const REFRESH_COOLDOWN_MS = 30 * 1000;
  let refreshInFlight = false;
  let lastRefreshAttemptAt = 0;
  let syncScheduled = false;

  function clean(value) {
    return String(value ?? "").trim();
  }

  function timestamp(value) {
    const numeric = Number(value);
    const parsed = Number.isFinite(numeric) && numeric > 86_400_000
      ? numeric
      : new Date(value || 0).getTime();
    return Number.isFinite(parsed) && parsed > 86_400_000 ? parsed : 0;
  }

  function mappingSnapshot() {
    try {
      return window.AmyFXIntel?.read?.()?.mapping || null;
    } catch (_) {
      return null;
    }
  }

  function mappingTimestamp(mapping = mappingSnapshot()) {
    if (!mapping) return 0;
    if (typeof window.AmyFXIntel?.partTimestamp === "function") {
      return Number(window.AmyFXIntel.partTimestamp(mapping) || 0);
    }
    return Math.max(
      timestamp(mapping.analyzedAt),
      timestamp(mapping.capturedAt),
      timestamp(mapping.captured_at),
      timestamp(mapping.updated)
    );
  }

  function mappingExplicitlyStale(mapping = mappingSnapshot()) {
    const status = clean(mapping?.status || mapping?.statusText || mapping?.marketState).toUpperCase();
    return Boolean(mapping?.dataStale) || /DATA USANG|EXPIRED|INVALID/.test(status);
  }

  function mappingIsFresh(mapping = mappingSnapshot()) {
    const capturedAt = mappingTimestamp(mapping);
    const sameTimeframe = !mapping?.timeframe || clean(mapping.timeframe).toUpperCase() === clean(state.tf).toUpperCase();
    return Boolean(
      mapping &&
      sameTimeframe &&
      capturedAt > 0 &&
      Date.now() - capturedAt <= ANALYSIS_MAX_AGE_MS &&
      !mappingExplicitlyStale(mapping)
    );
  }

  function ensureStyles() {
    if (document.getElementById("amy-mapping-live-consistency-style-v1")) return;
    const style = document.createElement("style");
    style.id = "amy-mapping-live-consistency-style-v1";
    style.textContent = `
      #conn[data-analysis-freshness="expired"] { color:#fbbf24 !important; }
      #conn[data-analysis-freshness="fresh"] { color:#4ade80 !important; }
      #conn[data-analysis-freshness="loading"] { color:#e7c65a !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function syncConnectionLabel() {
    ensureStyles();
    const mapping = mappingSnapshot();
    const fresh = mappingIsFresh(mapping);
    const connected = state.conn === "Connected";
    const conn = document.getElementById("conn");

    if (conn) {
      let text = state.conn || "Offline";
      let freshness = "offline";
      if (refreshInFlight) {
        text = `● Connected · Memperbarui ${state.tf}`;
        freshness = "loading";
      } else if (connected && fresh) {
        text = `● Connected · ${state.tf} Fresh`;
        freshness = "fresh";
      } else if (connected) {
        text = `● Price Live · ${state.tf} Expired`;
        freshness = "expired";
      }
      if (conn.textContent !== text) conn.textContent = text;
      conn.dataset.analysisFreshness = freshness;
      conn.className = connected ? "status on" : "status";
    }

    const topTime = document.getElementById("top-wib");
    if (topTime) {
      const label = connected
        ? fresh
          ? `● Live Price • Mapping ${state.tf} fresh • WITA ${nowTime()}`
          : `● Live Price • Mapping ${state.tf} kedaluwarsa • WITA ${nowTime()}`
        : `○ ${state.conn || "Offline"} • WITA ${nowTime()}`;
      if (topTime.textContent !== label) topTime.textContent = label;
      topTime.id = "top-wita";
    }

    const currentTopTime = document.getElementById("top-wita");
    if (currentTopTime) {
      const label = connected
        ? fresh
          ? `● Live Price • Mapping ${state.tf} fresh • WITA ${nowTime()}`
          : `● Live Price • Mapping ${state.tf} kedaluwarsa • WITA ${nowTime()}`
        : `○ ${state.conn || "Offline"} • WITA ${nowTime()}`;
      if (currentTopTime.textContent !== label) currentTopTime.textContent = label;
    }

    const killzoneTime = document.getElementById("kz-wib") || document.getElementById("kz-wita");
    if (killzoneTime) {
      killzoneTime.id = "kz-wita";
      const label = `WITA ${nowTime()}`;
      if (killzoneTime.textContent !== label) killzoneTime.textContent = label;
    }

    document.querySelectorAll(".session-focus small").forEach(node => {
      const value = clean(node.textContent).replace(/\bWIB\b/g, "WITA");
      if (node.textContent !== value) node.textContent = value;
    });
  }

  function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;
    window.setTimeout(() => {
      syncScheduled = false;
      syncConnectionLabel();
    }, 0);
  }

  function analysisNeedsRefresh() {
    if (document.hidden || state.conn !== "Connected") return false;
    const mapping = mappingSnapshot();
    return !mappingIsFresh(mapping) || isCandleStale(state.tf);
  }

  async function refreshExpiredAnalysis(reason = "mapping-expired") {
    if (!analysisNeedsRefresh() || refreshInFlight) return;
    if (Date.now() - lastRefreshAttemptAt < REFRESH_COOLDOWN_MS) return;

    lastRefreshAttemptAt = Date.now();
    refreshInFlight = true;
    scheduleSync();
    try {
      await runAnalysis(state.tf);
      window.dispatchEvent(new CustomEvent("amyfx:mapping-consistency-refresh", {
        detail: { reason, timeframe: state.tf, refreshedAt: Date.now() }
      }));
    } catch (_) {
      // runAnalysis already records and renders the actionable error state.
    } finally {
      refreshInFlight = false;
      scheduleSync();
    }
  }

  function reconcile(reason) {
    scheduleSync();
    window.setTimeout(() => refreshExpiredAnalysis(reason), 50);
  }

  function boot() {
    reconcile("startup");
    window.addEventListener("amyfx:market-update", () => reconcile("market-update"));
    window.addEventListener("online", () => reconcile("online"));
    window.addEventListener("focus", () => reconcile("focus"));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) reconcile("visible");
    });
    document.querySelector(".nav")?.addEventListener("click", scheduleSync);
    window.setInterval(() => {
      if (!document.hidden) reconcile("periodic-check");
    }, 60_000);
  }

  window.AmyFXMappingConsistency = Object.freeze({
    version: "1.0.0",
    mappingIsFresh,
    refresh: refreshExpiredAnalysis,
    sync: syncConnectionLabel
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
