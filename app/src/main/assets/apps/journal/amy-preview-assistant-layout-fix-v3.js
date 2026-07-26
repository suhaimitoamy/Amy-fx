"use strict";

(function () {
  if (window.__amyPreviewAssistantLayoutFixV3) return;
  window.__amyPreviewAssistantLayoutFixV3 = true;

  const SETTINGS_KEY = "tradingLibraryManager.assistantSettings.v1";

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function hasStoredApi() {
    const saved = readSettings();
    return Boolean(
      String(saved.apiKey || "").trim() ||
      String(saved.apiPoolText || "").trim() ||
      (saved.geminiKeys || []).length ||
      (saved.openrouterKeys || []).length ||
      (saved.deepseekKeys || []).length ||
      String(saved.deepseekKey || "").trim()
    );
  }

  function injectStyle() {
    if (document.querySelector("#amyPreviewAssistantLayoutFixV3Style")) return;
    const style = document.createElement("style");
    style.id = "amyPreviewAssistantLayoutFixV3Style";
    style.textContent = `
      #assistantView {
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        padding-bottom: calc(150px + env(safe-area-inset-bottom, 0px)) !important;
      }

      #assistantView .assistant-workspace {
        position: static !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        grid-template-rows: none !important;
        grid-auto-rows: auto !important;
        align-content: start !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        overscroll-behavior: auto !important;
      }

      #assistantView .assistant-workspace > * {
        position: static !important;
        width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        overflow: visible !important;
        flex: none !important;
        transform: none !important;
      }

      #assistantApiSettings.amy-preview-api-settings,
      #assistantApiSettings.amy-preview-api-settings[open] {
        position: static !important;
        display: block !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        contain: none !important;
        isolation: auto !important;
      }

      #assistantApiSettings.amy-preview-api-settings > summary {
        position: relative !important;
        z-index: 1 !important;
      }

      #assistantApiSettings:not([open]) > #amyAiSettingsV2 {
        display: none !important;
      }

      #assistantApiSettings[open] > #amyAiSettingsV2 {
        position: static !important;
        display: grid !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        clip: auto !important;
        clip-path: none !important;
        opacity: 1 !important;
        visibility: visible !important;
        transform: none !important;
      }

      #assistantView .assistant-room-card {
        position: static !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        grid-template-rows: auto auto auto auto !important;
        align-content: start !important;
        flex: none !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
      }

      #assistantView .assistant-chat-headline,
      #assistantView .assistant-chat-log,
      #assistantView .assistant-live-answer,
      #assistantView .assistant-chat-bar-container,
      #assistantView .assistant-note {
        position: static !important;
        width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        max-height: none !important;
        flex: none !important;
        transform: none !important;
      }

      #assistantView .assistant-chat-log {
        min-height: 120px !important;
        overflow: visible !important;
        padding: 10px 2px 14px !important;
      }

      #assistantView .assistant-chat-empty,
      #assistantView .assistant-chat-log:empty::before {
        min-height: 108px !important;
      }

      #assistantView .assistant-message-wrapper,
      #assistantView .assistant-message,
      #assistantView .chat-bubble,
      #assistantView .save-ai-btn {
        position: static !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        transform: none !important;
      }

      #assistantView .assistant-message-wrapper {
        width: 100% !important;
        min-width: 0 !important;
        align-items: flex-start !important;
      }

      #assistantView .assistant-message,
      #assistantView .chat-bubble {
        max-width: min(88%, 680px) !important;
        overflow: visible !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
      }

      #assistantView .assistant-chat-bar-container {
        inset: auto !important;
        bottom: auto !important;
        z-index: auto !important;
        margin-top: 12px !important;
        overflow: visible !important;
      }

      #assistantView .assistant-chat-bar {
        position: static !important;
        inset: auto !important;
        width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 !important;
        transform: none !important;
      }

      #assistantView .assistant-insight-card {
        position: static !important;
        display: block !important;
        flex: none !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
      }

      #assistantView .mode-dropdown-menu {
        position: absolute !important;
      }

      @media (max-width: 520px) {
        #assistantView .assistant-workspace {
          gap: 12px !important;
        }

        #assistantApiSettings.amy-preview-api-settings,
        #assistantView .assistant-room-card,
        #assistantView .assistant-insight-card {
          border-radius: 18px !important;
        }

        #assistantApiSettings[open] > #amyAiSettingsV2 {
          padding: 12px !important;
        }

        #assistantView .assistant-message,
        #assistantView .chat-bubble {
          max-width: 92% !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function removeInlineSizing(element) {
    if (!element) return;
    [
      "height", "min-height", "max-height", "overflow", "overflow-y",
      "position", "top", "right", "bottom", "left", "transform"
    ].forEach(property => element.style.removeProperty(property));
  }

  function normalizeLayout(options = {}) {
    injectStyle();

    const view = document.querySelector("#assistantView");
    const workspace = view?.querySelector(".assistant-workspace");
    const settings = document.querySelector("#assistantApiSettings");
    const room = view?.querySelector(".assistant-room-card");
    const log = view?.querySelector(".assistant-chat-log");
    const barContainer = view?.querySelector(".assistant-chat-bar-container");
    const insight = view?.querySelector(".assistant-insight-card");

    [view, workspace, settings, room, log, barContainer, insight].forEach(removeInlineSizing);

    if (settings) {
      settings.dataset.amyLayoutFixed = "1";
      if (options.collapseStored && hasStoredApi() && settings.dataset.amyUserOpened !== "1") {
        settings.open = false;
      }
    }
  }

  function boot() {
    normalizeLayout({ collapseStored: true });
    setTimeout(() => normalizeLayout({ collapseStored: true }), 120);
    setTimeout(() => normalizeLayout({ collapseStored: true }), 500);
    setTimeout(() => normalizeLayout({ collapseStored: true }), 1200);
  }

  document.addEventListener("click", event => {
    const settings = document.querySelector("#assistantApiSettings");
    if (event.target.closest?.("#assistantApiSettings > summary") && settings) {
      settings.dataset.amyUserOpened = settings.open ? "0" : "1";
      setTimeout(() => normalizeLayout(), 0);
      return;
    }

    if (event.target.closest?.('[data-view="assistant"]')) {
      if (settings) settings.dataset.amyUserOpened = "0";
      setTimeout(() => normalizeLayout({ collapseStored: true }), 140);
    }

    if (event.target.closest?.("#amyAiSaveV2")) {
      setTimeout(() => {
        normalizeLayout();
        const current = document.querySelector("#assistantApiSettings");
        if (current && hasStoredApi()) {
          current.dataset.amyUserOpened = "0";
          current.open = false;
          document.querySelector("#assistantView .assistant-room-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 180);
    }
  }, true);

  const observer = new MutationObserver(mutations => {
    if (mutations.some(row => row.type === "childList" || row.attributeName === "style")) {
      normalizeLayout();
    }
  });

  function startObserver() {
    const view = document.querySelector("#assistantView");
    if (!view) return;
    observer.observe(view, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot();
      startObserver();
    }, { once: true });
  } else {
    boot();
    startObserver();
  }
})();
