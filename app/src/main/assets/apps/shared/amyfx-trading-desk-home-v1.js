"use strict";

(function () {
  if (window.__amyFxTradingDeskHomeV1) return;
  window.__amyFxTradingDeskHomeV1 = true;

  const STATE_KEYS = [
    "amyfx.market.state.v1",
    "amyfx.mapping.snapshot.v1",
    "amy_mapping_snapshot",
    "amy_mapping_analyses",
    "amy_mapping_setups",
    "amy_entry_watch_state_v3"
  ];

  function safeJson(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  function newest(value) {
    if (!Array.isArray(value)) return value;
    return value.length ? value[value.length - 1] : null;
  }

  function readState() {
    for (const key of STATE_KEYS) {
      const value = newest(safeJson(localStorage.getItem(key) || ""));
      if (value && typeof value === "object") return value;
    }
    return null;
  }

  function findValue(source, names, depth = 0, visited = new Set()) {
    if (!source || typeof source !== "object" || depth > 5 || visited.has(source)) return undefined;
    visited.add(source);

    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(source, name)) {
        const value = source[name];
        if (value !== undefined && value !== null && value !== "") return value;
      }
    }

    const preferred = [
      "result", "facts", "market", "mapping", "snapshot", "context",
      "directionDecision", "validatedMarketContext", "entryMap", "setup",
      "setupExecution", "executionPlan", "latest", "data"
    ];

    for (const key of preferred) {
      const value = source[key];
      const found = findValue(value, names, depth + 1, visited);
      if (found !== undefined) return found;
    }

    for (const value of Object.values(source)) {
      if (!value || typeof value !== "object") continue;
      const found = findValue(value, names, depth + 1, visited);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  function normalizeDecision(value) {
    const text = String(value || "").trim().toUpperCase();
    if (/BUY|BULL|LONG/.test(text)) return "BUY";
    if (/SELL|BEAR|SHORT/.test(text)) return "SELL";
    return "WAIT";
  }

  function formatPrice(value) {
    const number = Number(String(value ?? "").replace(/,/g, ""));
    if (!Number.isFinite(number) || number <= 0) return "—";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  }

  function formatTime(value) {
    if (!value) return "Belum ada candle tersimpan";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "Snapshot Mapping tersedia";
    try {
      return `Candle terakhir ${new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Makassar",
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short"
      }).format(date)} WITA`;
    } catch {
      return "Snapshot Mapping tersedia";
    }
  }

  function snapshot() {
    const source = readState();
    const price = findValue(source, ["currentPrice", "livePrice", "goldPrice", "price", "close"]);
    const decision = normalizeDecision(findValue(source, ["decision", "direction", "bias", "focusDirection", "side"]));
    const timeframe = String(findValue(source, ["timeframe", "selectedTimeframe", "tf"]) || "—").toUpperCase();
    const session = String(findValue(source, ["session", "activeSession", "killzone"]) || "—");
    const stage = String(findValue(source, ["lifecycle", "stage", "status", "entryWatchStage"]) || (source ? "Tersedia" : "Belum dianalisis"));
    const timestamp = findValue(source, ["sourceCandleTime", "candleTime", "timestamp", "updatedAt", "time"]);

    return {
      price: formatPrice(price),
      decision,
      timeframe,
      session,
      stage: stage.replaceAll("_", " "),
      timeLabel: formatTime(timestamp),
      online: navigator.onLine !== false
    };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[char]);
  }

  function renderSnapshot(section) {
    if (!section || section.dataset.deskReady === "true") return;
    const data = snapshot();
    section.dataset.deskReady = "true";
    section.classList.add("desk-market-snapshot");
    section.innerHTML = `
      <button class="desk-snapshot-button" type="button" data-open="mapping" aria-label="Buka Mapping XAU/USD">
        <div class="desk-snapshot-head">
          <span class="desk-symbol">XAU/USD</span>
          <span class="desk-live-state" data-online="${data.online}">${data.online ? "Data tersedia" : "Mode offline"}</span>
        </div>
        <div class="desk-snapshot-price-row">
          <strong class="desk-snapshot-price">${escapeHtml(data.price)}</strong>
          <span class="desk-snapshot-decision" data-decision="${data.decision}">${data.decision}</span>
        </div>
        <div class="desk-snapshot-meta">
          <div><small>Timeframe</small><strong>${escapeHtml(data.timeframe)}</strong></div>
          <div><small>Session</small><strong>${escapeHtml(data.session)}</strong></div>
          <div><small>Status setup</small><strong>${escapeHtml(data.stage)}</strong></div>
        </div>
        <div class="desk-snapshot-foot">${escapeHtml(data.timeLabel)} · Ketuk untuk membuka Mapping</div>
      </button>`;
  }

  function refineHome() {
    const subtitle = document.querySelector(".app-header__copy small");
    if (subtitle) subtitle.textContent = "Trading desk";

    const hero = document.querySelector("#main-content .home-hero");
    if (hero) renderSnapshot(hero);

    const heading = document.querySelector("#main-content .section-heading");
    if (heading) {
      const kicker = heading.querySelector(".section-kicker");
      const title = heading.querySelector("h2");
      if (kicker) kicker.textContent = "Navigasi";
      if (title) title.textContent = "Modul";
    }
  }

  function refreshSnapshot() {
    const hero = document.querySelector("#main-content .home-hero, #main-content .desk-market-snapshot");
    if (!hero) return;
    hero.dataset.deskReady = "false";
    renderSnapshot(hero);
  }

  function boot() {
    refineHome();
    const main = document.getElementById("main-content");
    if (main) {
      new MutationObserver(() => refineHome()).observe(main, { childList: true, subtree: false });
    }

    window.addEventListener("storage", event => {
      if (!event.key || STATE_KEYS.includes(event.key)) refreshSnapshot();
    });
    window.addEventListener("amyfx:mapping-state-change", refreshSnapshot);
    window.addEventListener("amyfx:integration-change", refreshSnapshot);
    window.addEventListener("online", refreshSnapshot);
    window.addEventListener("offline", refreshSnapshot);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
