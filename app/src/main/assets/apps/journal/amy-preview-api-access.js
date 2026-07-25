"use strict";

(function () {
  if (window.__amyPreviewApiAccess) return;
  window.__amyPreviewApiAccess = true;

  const SETTINGS_KEY = "tradingLibraryManager.assistantSettings.v1";
  let mounted = false;

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
      String(saved.apiPoolText || "").trim()
    );
  }

  function injectStyle() {
    if (document.querySelector("#amyPreviewApiAccessStyle")) return;
    const style = document.createElement("style");
    style.id = "amyPreviewApiAccessStyle";
    style.textContent = `
      #assistantApiSettings.amy-preview-api-settings {
        order: -20;
        border-color: rgba(218, 179, 58, .42);
        box-shadow: 0 14px 38px rgba(0, 0, 0, .2);
      }
      #assistantApiSettings.amy-preview-api-settings > summary {
        min-height: 64px;
      }
      .amy-preview-api-button {
        white-space: nowrap;
      }
      .amy-preview-api-hint {
        margin: 0 0 14px;
        padding: 12px 14px;
        border: 1px solid rgba(218, 179, 58, .3);
        border-radius: 14px;
        background: rgba(218, 179, 58, .08);
        color: rgba(255, 255, 255, .82);
        line-height: 1.45;
      }
    `;
    document.head.appendChild(style);
  }

  function focusApiInput() {
    const target = document.querySelector("#amyAiKeyPoolInput, #geminiApiKeyInput");
    if (!target) return;
    try {
      target.focus({ preventScroll: true });
    } catch (_) {
      target.focus();
    }
  }

  function openApiSettings() {
    const settings = document.querySelector("#assistantApiSettings");
    if (!settings) return;
    settings.open = true;
    requestAnimationFrame(() => {
      settings.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(focusApiInput, 280);
    });
  }

  function mount() {
    const workspace = document.querySelector("#assistantView .assistant-workspace");
    const settings = document.querySelector("#assistantApiSettings");
    const headline = document.querySelector("#assistantView .assistant-chat-headline");
    if (!workspace || !settings || !headline) return false;

    injectStyle();
    settings.classList.add("amy-preview-api-settings");

    if (workspace.firstElementChild !== settings) {
      workspace.insertBefore(settings, workspace.firstElementChild);
    }

    const body = settings.querySelector(".assistant-api-body");
    if (body && !body.querySelector(".amy-preview-api-hint")) {
      const hint = document.createElement("p");
      hint.className = "amy-preview-api-hint";
      hint.textContent = "Masukkan semua API Gemini dan OpenRouter di Pool API Keys. Sistem akan merotasi key otomatis saat limit, timeout, atau error.";
      body.insertBefore(hint, body.firstElementChild);
    }

    let button = document.querySelector("#amyOpenApiSettingsBtn");
    if (!button) {
      button = document.createElement("button");
      button.id = "amyOpenApiSettingsBtn";
      button.type = "button";
      button.className = "ghost-button amy-preview-api-button";
      button.textContent = "Pengaturan API";
      button.addEventListener("click", openApiSettings);
      const clearButton = headline.querySelector("#clearAssistantHistoryBtn");
      if (clearButton) headline.insertBefore(button, clearButton);
      else headline.appendChild(button);
    }

    if (!hasStoredApi()) settings.open = true;
    mounted = true;
    return true;
  }

  function boot() {
    if (mount()) return;
    const timer = setInterval(() => {
      if (mount()) clearInterval(timer);
    }, 100);
    setTimeout(() => clearInterval(timer), 15000);
  }

  document.addEventListener("click", event => {
    if (event.target.closest('[data-view="assistant"]')) {
      setTimeout(() => {
        mount();
        if (!hasStoredApi()) openApiSettings();
      }, 60);
    }
  });

  window.addEventListener("storage", event => {
    if (event.key === SETTINGS_KEY && mounted) mount();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
