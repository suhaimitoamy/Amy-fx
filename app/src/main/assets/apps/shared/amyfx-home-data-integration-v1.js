"use strict";

(function () {
  if (window.__amyFxHomeDataIntegrationV1) return;
  window.__amyFxHomeDataIntegrationV1 = true;

  const DB_NAME = "tradingLibraryManager.files";
  const META_STORE = "metadata";
  const JOURNAL_RECORD = "journals.v2";
  let refreshToken = 0;

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function mappingCount() {
    try {
      return safeArray(JSON.parse(localStorage.getItem("amy_mapping_analyses") || "[]")).length;
    } catch {
      return 0;
    }
  }

  function legacyJournalCount() {
    try {
      return safeArray(JSON.parse(localStorage.getItem("tradingLibraryManager.journals.v1") || "[]")).length;
    } catch {
      return 0;
    }
  }

  function readJournalCount() {
    return new Promise(resolve => {
      if (!window.indexedDB) return resolve(legacyJournalCount());
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(Number.isFinite(Number(value)) ? Number(value) : legacyJournalCount());
      };
      const request = indexedDB.open(DB_NAME);
      request.onerror = () => finish(legacyJournalCount());
      request.onblocked = () => finish(legacyJournalCount());
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.close();
          finish(legacyJournalCount());
          return;
        }
        try {
          const tx = db.transaction(META_STORE, "readonly");
          const get = tx.objectStore(META_STORE).get(JOURNAL_RECORD);
          get.onsuccess = () => {
            const count = safeArray(get.result?.value).length;
            db.close();
            finish(count);
          };
          get.onerror = () => {
            db.close();
            finish(legacyJournalCount());
          };
        } catch {
          db.close();
          finish(legacyJournalCount());
        }
      };
      window.setTimeout(() => finish(legacyJournalCount()), 2500);
    });
  }

  function statValue(label) {
    const card = [...document.querySelectorAll(".stats-grid .stat-card")]
      .find(item => item.querySelector("small")?.textContent?.trim() === label);
    return card?.querySelector("strong") || null;
  }

  async function refresh() {
    const journalTarget = statValue("Catatan Jurnal");
    const mappingTarget = statValue("Analisis Mapping");
    if (!journalTarget && !mappingTarget) return;

    const token = ++refreshToken;
    const analyses = mappingCount();
    const journals = await readJournalCount();
    if (token !== refreshToken) return;

    if (mappingTarget) mappingTarget.textContent = String(analyses);
    if (journalTarget) journalTarget.textContent = String(journals);
    window.AmyFXHomeStats = Object.freeze({ analyses, journals, updatedAt: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent("amyfx:home-stats-change", { detail: window.AmyFXHomeStats }));
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      refresh();
    });
  }

  function boot() {
    schedule();
    const target = document.getElementById("main-content") || document.body;
    new MutationObserver(schedule).observe(target, { childList: true, subtree: true });
    window.addEventListener("focus", schedule);
    window.addEventListener("storage", schedule);
    window.addEventListener("amyfx:journal-state-change", schedule);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
