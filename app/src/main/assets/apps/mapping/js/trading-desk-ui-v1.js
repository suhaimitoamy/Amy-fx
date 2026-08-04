"use strict";

(function () {
  if (window.__amyFxTradingDeskMappingV1) return;
  window.__amyFxTradingDeskMappingV1 = true;

  const COPY = new Map([
    ["PEMULIHAN DATA", "Status data"],
    ["MARKET INTELLIGENCE", "Analisis market"],
    ["EXECUTION PLAN", "Rencana eksekusi"],
    ["FOCUS DIRECTION", "Fokus"],
    ["CURRENT PRICE", "Harga saat ini"],
    ["MAPPING FRESHNESS", "Candle terakhir"],
    ["ENTRY NOT LOCKED", "Entry belum dikonfirmasi"],
    ["WAITING_FOR_AREA", "Menunggu harga masuk area"],
    ["WAITING_FOR_SWEEP", "Menunggu sweep likuiditas"],
    ["SWEEP_DETECTED", "Sweep terdeteksi"],
    ["WAITING_FOR_MSS", "Menunggu MSS"],
    ["WAITING_FOR_CLOSE", "Menunggu candle close"],
    ["ENTRY_TRIGGERED", "Entry terkonfirmasi"],
    ["LEVEL_RETIRED", "Level tidak lagi aktif"],
    ["FORECAST_PAUSED", "Analisis arah ditahan"],
    ["TP1 HIT / BE", "TP1 tercapai · BE"],
    ["TP1 / BE", "TP1 · BE"],
    ["TP2 HIT", "TP2 tercapai"],
    ["SL HIT", "Stop Loss tercapai"]
  ]);

  function patchHeader() {
    document.title = "XAU/USD · Mapping";
    document.body.dataset.deskUi = "trading-desk-v1";

    const title = document.querySelector(".topbar .brand-title");
    const subtitle = document.querySelector(".topbar .brand-sub");
    const connection = document.getElementById("conn");
    if (title) title.textContent = "XAU/USD";
    if (subtitle) subtitle.textContent = "Mapping · candle close";
    if (connection) connection.setAttribute("aria-label", "Status koneksi data market");
  }

  function patchCopy(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    const elements = [root, ...root.querySelectorAll(".kicker, .eyebrow, small, span, strong, h2, h3")];

    elements.forEach(element => {
      if (element.children.length) return;
      const original = element.textContent?.trim();
      if (!original || !COPY.has(original)) return;
      if (!element.dataset.deskOriginalText) element.dataset.deskOriginalText = original;
      element.textContent = COPY.get(original);
    });
  }

  let scheduled = false;
  function schedulePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patchHeader();
      const app = document.getElementById("app");
      if (app) patchCopy(app);
    });
  }

  function boot() {
    patchHeader();
    const app = document.getElementById("app");
    if (app) {
      patchCopy(app);
      new MutationObserver(schedulePatch).observe(app, { childList: true, subtree: true });
    }
    window.addEventListener("amyfx:mapping-state-change", schedulePatch);
    window.addEventListener("amyfx:entry-watch-updated", schedulePatch);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
