"use strict";

(function () {
  if (window.__amyPreviewApiAccessV3) return;
  window.__amyPreviewApiAccessV3 = true;

  const SETTINGS_KEY = "tradingLibraryManager.assistantSettings.v1";
  let mounted = false;

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function writeSettings(patch) {
    const current = readSettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...patch }));
  }

  function hasStoredApi() {
    const saved = readSettings();
    return Boolean(
      String(saved.apiKey || "").trim() ||
      String(saved.apiPoolText || "").trim()
    );
  }

  function injectStyle() {
    if (document.querySelector("#amyPreviewAssistantUiV3")) return;
    const style = document.createElement("style");
    style.id = "amyPreviewAssistantUiV3";
    style.textContent = `
      #assistantView {
        padding-bottom: 190px !important;
      }

      #assistantView .amy-assistant-page-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin: 2px 0 14px;
        padding: 0 2px;
      }

      #assistantView .amy-assistant-page-copy {
        min-width: 0;
      }

      #assistantView .amy-assistant-page-copy span {
        display: block;
        margin-bottom: 4px;
        color: #d4af37;
        font-size: .7rem;
        font-weight: 900;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      #assistantView .amy-assistant-page-copy h2 {
        margin: 0;
        color: #f9fafb;
        font-size: clamp(1.55rem, 7vw, 2rem);
        line-height: 1.08;
        letter-spacing: -.04em;
      }

      #assistantView .amy-assistant-page-copy p {
        max-width: 330px;
        margin: 7px 0 0;
        color: rgba(229, 231, 235, .68);
        font-size: .8rem;
        line-height: 1.5;
      }

      #assistantView #clearAssistantHistoryBtn {
        position: static !important;
        flex: 0 0 auto;
        min-height: 42px;
        border: 1px solid rgba(248, 113, 113, .42);
        border-radius: 999px;
        background: rgba(248, 113, 113, .07);
        padding: 0 14px;
        color: #ff858d;
        font-size: .75rem;
        font-weight: 900;
        white-space: nowrap;
      }

      #assistantView .assistant-workspace {
        display: grid !important;
        gap: 14px !important;
      }

      #assistantApiSettings.amy-preview-api-settings {
        order: 0 !important;
        width: 100%;
        height: auto !important;
        max-height: none !important;
        overflow: hidden !important;
        border: 1px solid rgba(212, 175, 55, .32) !important;
        border-radius: 22px !important;
        background:
          radial-gradient(circle at 0 0, rgba(57, 255, 136, .12), transparent 20rem),
          linear-gradient(145deg, rgba(10, 28, 18, .97), rgba(5, 12, 8, .98)) !important;
        padding: 0 !important;
        box-shadow: 0 18px 46px rgba(0, 0, 0, .28) !important;
      }

      #assistantApiSettings.amy-preview-api-settings > summary {
        display: grid !important;
        grid-template-columns: 46px minmax(0, 1fr) 12px !important;
        grid-template-areas:
          "icon title arrow"
          "icon status arrow";
        align-items: center !important;
        column-gap: 12px !important;
        row-gap: 3px !important;
        min-height: 78px !important;
        padding: 13px 15px !important;
      }

      #assistantApiSettings.amy-preview-api-settings > summary::before {
        grid-area: icon;
        width: 44px !important;
        height: 44px !important;
        border-color: rgba(212, 175, 55, .3) !important;
        border-radius: 15px !important;
        background: rgba(57, 255, 136, .08);
        color: #d4af37 !important;
        font-size: 1.15rem;
      }

      #assistantApiSettings.amy-preview-api-settings > summary::after {
        grid-area: arrow;
        align-self: center;
      }

      #assistantApiSettings.amy-preview-api-settings > summary > span {
        grid-area: title;
        min-width: 0;
        color: #f9fafb !important;
        font-size: 1rem;
        line-height: 1.25;
      }

      #assistantApiSettings.amy-preview-api-settings > summary > strong {
        grid-area: status;
        min-width: 0;
        overflow: hidden;
        color: rgba(229, 231, 235, .72) !important;
        font-size: .75rem !important;
        font-weight: 750 !important;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #assistantApiSettings .assistant-api-body {
        position: relative !important;
        display: grid !important;
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px !important;
        overflow: visible !important;
        border-top: 1px solid rgba(212, 175, 55, .14) !important;
        padding: 14px !important;
      }

      #assistantApiSettings .assistant-api-body > * {
        position: static !important;
        min-width: 0;
        height: auto;
        max-height: none;
        opacity: 1 !important;
        visibility: visible !important;
        transform: none !important;
      }

      #assistantApiSettings .assistant-api-body > [hidden],
      #assistantApiSettings .assistant-api-body > .field[hidden] {
        display: none !important;
      }

      #assistantApiSettings .assistant-api-body > .field {
        display: grid !important;
        width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        max-height: none !important;
        gap: 7px;
        overflow: visible !important;
      }

      #assistantApiSettings .assistant-api-body > .field > span {
        display: block !important;
        color: rgba(229, 231, 235, .78);
        font-size: .74rem;
        font-weight: 850;
      }

      #assistantApiSettings .assistant-api-body input,
      #assistantApiSettings .assistant-api-body select,
      #assistantApiSettings .assistant-api-body textarea {
        position: static !important;
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 48px !important;
        height: auto !important;
        max-height: none;
        overflow: visible;
        border: 1px solid rgba(212, 175, 55, .22) !important;
        border-radius: 13px !important;
        background-color: rgba(0, 0, 0, .34) !important;
        color: #f9fafb !important;
        padding: 11px 12px !important;
        font-size: 16px !important;
        line-height: 1.4 !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        z-index: auto !important;
        outline: none;
      }

      #assistantApiSettings .assistant-api-body select {
        padding-right: 38px !important;
      }

      #assistantApiSettings .assistant-api-body input:focus,
      #assistantApiSettings .assistant-api-body select:focus,
      #assistantApiSettings .assistant-api-body textarea:focus {
        border-color: rgba(212, 175, 55, .78) !important;
        box-shadow: 0 0 0 3px rgba(212, 175, 55, .09);
      }

      #assistantApiSettings #amyAiKeyPoolInput {
        display: block !important;
        min-height: 132px !important;
        max-height: 230px !important;
        resize: vertical !important;
        font-family: "JetBrains Mono", monospace;
        font-size: 13px !important;
        line-height: 1.5 !important;
      }

      #assistantApiSettings #amyAiKeyPoolInput + small {
        display: block;
        color: rgba(229, 231, 235, .58);
        font-size: .68rem;
        line-height: 1.5;
      }

      #assistantApiSettings .amy-api-pool-field,
      #assistantApiSettings .amy-preview-api-hint,
      #assistantApiSettings .toggle-field,
      #assistantApiSettings .form-actions,
      #assistantApiSettings .form-message {
        grid-column: 1 / -1;
      }

      #assistantApiSettings .amy-preview-api-hint {
        margin: 0 !important;
        border: 1px solid rgba(212, 175, 55, .2) !important;
        border-radius: 14px !important;
        background: rgba(212, 175, 55, .065) !important;
        color: rgba(249, 250, 251, .74) !important;
        padding: 11px 12px !important;
        font-size: .74rem;
        line-height: 1.5;
      }

      #assistantApiSettings .toggle-field {
        position: static !important;
        display: flex !important;
        min-height: 46px;
        align-items: center;
        gap: 9px;
        border: 1px solid rgba(212, 175, 55, .16) !important;
        border-radius: 13px !important;
        background: rgba(255, 255, 255, .025) !important;
        padding: 10px 11px !important;
      }

      #assistantApiSettings .toggle-field input {
        width: 18px !important;
        min-width: 18px !important;
        min-height: 18px !important;
        height: 18px !important;
        padding: 0 !important;
      }

      #assistantApiSettings .assistant-api-body > .form-actions {
        position: static !important;
        right: auto !important;
        bottom: auto !important;
        left: auto !important;
        z-index: auto !important;
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        align-items: stretch !important;
        justify-content: stretch !important;
        gap: 8px !important;
        width: 100% !important;
        margin: 2px 0 0 !important;
        border: 0 !important;
        background: transparent !important;
        padding: 0 !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      #assistantApiSettings .assistant-api-body > .form-actions > button {
        position: static !important;
        grid-column: auto !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 46px !important;
        border-radius: 13px !important;
        padding: 9px 7px !important;
        font-size: .75rem !important;
        font-weight: 900 !important;
        white-space: nowrap;
      }

      #assistantView .assistant-room-card,
      #assistantView .assistant-insight-card {
        border-radius: 22px !important;
        padding: 14px !important;
      }

      #assistantView .assistant-room-card {
        order: 1;
        min-height: 0 !important;
      }

      #assistantView .assistant-insight-card {
        order: 2;
      }

      #assistantView .assistant-chat-headline {
        align-items: center !important;
        margin-bottom: 8px !important;
      }

      #assistantView .assistant-chat-headline h3 {
        margin: 0 !important;
        font-size: 1.08rem !important;
      }

      #assistantView .assistant-chat-log {
        min-height: 128px !important;
        max-height: 42vh !important;
        gap: 12px !important;
        padding: 8px 1px !important;
      }

      #assistantView .assistant-chat-log:empty::before {
        display: grid;
        min-height: 112px;
        place-items: center;
        border: 1px dashed rgba(57, 255, 136, .14);
        border-radius: 18px;
        color: rgba(229, 231, 235, .48);
        content: "Mulai percakapan atau pilih pertanyaan cepat di bawah.";
        padding: 18px;
        text-align: center;
        line-height: 1.5;
      }

      #assistantView .assistant-chat-empty {
        min-height: 112px !important;
        border: 1px dashed rgba(57, 255, 136, .14);
        border-radius: 18px;
        padding: 18px;
      }

      #assistantView .assistant-chat-bar-container {
        gap: 10px !important;
        margin-top: 8px !important;
      }

      #assistantView .assistant-quick-prompts {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px !important;
        overflow: visible !important;
        padding: 0 !important;
      }

      #assistantView .quick-prompt-btn {
        width: 100%;
        min-width: 0;
        min-height: 44px;
        border-color: rgba(57, 255, 136, .14) !important;
        border-radius: 14px !important;
        background: rgba(57, 255, 136, .045) !important;
        color: rgba(249, 250, 251, .74) !important;
        padding: 10px 11px !important;
        font-size: .72rem !important;
        line-height: 1.35;
        text-align: left;
        white-space: normal !important;
      }

      #assistantView .quick-prompt-btn:nth-child(3) {
        grid-column: 1 / -1;
      }

      #assistantView .assistant-chat-bar {
        display: grid !important;
        grid-template-columns: 44px minmax(0, 1fr) 44px;
        align-items: end !important;
        gap: 6px;
        border: 1px solid rgba(57, 255, 136, .2) !important;
        border-radius: 20px !important;
        background: rgba(0, 0, 0, .28) !important;
        padding: 6px !important;
      }

      #assistantView .assistant-mode-toggle,
      #assistantView .assistant-send-button {
        display: grid;
        width: 44px !important;
        height: 44px !important;
        min-width: 44px !important;
        min-height: 44px !important;
        place-items: center;
        border-radius: 15px !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      #assistantView .assistant-mode-toggle {
        border: 1px solid rgba(57, 255, 136, .18);
        background: rgba(57, 255, 136, .07);
        color: #f9fafb;
      }

      #assistantView .assistant-send-button {
        background: #d4af37 !important;
        color: #111 !important;
      }

      #assistantView .assistant-chat-input,
      #assistantView .assistant-chat-input textarea {
        min-width: 0;
      }

      #assistantView .assistant-chat-input textarea {
        width: 100%;
        min-height: 44px !important;
        max-height: 112px !important;
        resize: none !important;
        border: 0 !important;
        background: transparent !important;
        padding: 11px 8px !important;
        font-size: 16px !important;
        line-height: 1.4 !important;
      }

      #assistantView .assistant-note {
        margin: 10px 0 0 !important;
        border: 1px solid rgba(57, 255, 136, .1);
        border-radius: 14px;
        background: rgba(57, 255, 136, .035);
        padding: 10px 11px;
        color: rgba(229, 231, 235, .62) !important;
        font-size: .72rem;
        line-height: 1.5 !important;
      }

      #assistantView .assistant-insight-card .assistant-card-headline {
        align-items: center !important;
        margin-bottom: 10px !important;
      }

      #assistantView .assistant-insight-card .compact-actions {
        position: static !important;
        bottom: auto !important;
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 7px !important;
        margin: 0 !important;
        border: 0 !important;
        background: transparent !important;
        padding: 0 !important;
        backdrop-filter: none !important;
      }

      #assistantView .assistant-insight-card .compact-actions button {
        position: static !important;
        grid-column: auto !important;
        min-height: 42px;
        border-radius: 13px;
        padding: 8px 13px;
        font-size: .75rem;
      }

      #assistantView #amyOpenApiSettingsBtn {
        display: none !important;
      }

      @media (max-width: 520px) {
        #assistantView .amy-assistant-page-copy p {
          max-width: 220px;
        }

        #assistantView #clearAssistantHistoryBtn {
          min-height: 38px;
          padding: 0 11px;
          font-size: .69rem;
        }

        #assistantApiSettings .assistant-api-body {
          grid-template-columns: 1fr !important;
          padding: 12px !important;
        }

        #assistantApiSettings .assistant-api-body > * {
          grid-column: 1 !important;
        }

        #assistantApiSettings .assistant-api-body > .form-actions {
          grid-template-columns: 1fr 1fr !important;
        }

        #assistantApiSettings .assistant-api-body > .form-actions > button:nth-child(3) {
          grid-column: 1 / -1 !important;
        }

        #assistantView .assistant-room-card,
        #assistantView .assistant-insight-card {
          padding: 12px !important;
        }
      }

      @media (max-width: 360px) {
        #assistantView .amy-assistant-page-head {
          display: grid;
        }

        #assistantView #clearAssistantHistoryBtn {
          justify-self: start;
        }

        #assistantView .assistant-quick-prompts,
        #assistantApiSettings .assistant-api-body > .form-actions {
          grid-template-columns: 1fr !important;
        }

        #assistantView .quick-prompt-btn:nth-child(3),
        #assistantApiSettings .assistant-api-body > .form-actions > button:nth-child(3) {
          grid-column: auto !important;
        }
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
      setTimeout(focusApiInput, 220);
    });
  }

  function ensurePageHeader(view, headline) {
    let header = view.querySelector(".amy-assistant-page-head");
    if (!header) {
      header = document.createElement("div");
      header.className = "amy-assistant-page-head";
      header.innerHTML = `
        <div class="amy-assistant-page-copy">
          <span>Trading Intelligence</span>
          <h2>Asisten AI</h2>
          <p>Analisa jurnal, evaluasi kebiasaan, dan pelajari konsep trading.</p>
        </div>`;
      view.insertBefore(header, view.firstChild);
    }

    const clearButton = document.querySelector("#clearAssistantHistoryBtn");
    if (clearButton && clearButton.parentElement !== header) header.appendChild(clearButton);

    const title = headline.querySelector("h3");
    if (title && title.textContent !== "Percakapan") title.textContent = "Percakapan";

    document.querySelector("#amyOpenApiSettingsBtn")?.remove();
  }

  function ensurePoolUi(settings) {
    const body = settings.querySelector(".assistant-api-body");
    if (!body) return;

    const saved = readSettings();
    const actions = body.querySelector(".form-actions");
    const providerField = body.querySelector("#aiProviderInput")?.closest(".field");

    let hint = body.querySelector(".amy-preview-api-hint");
    if (!hint) {
      hint = document.createElement("p");
      hint.className = "amy-preview-api-hint";
      hint.textContent = "Masukkan API Gemini dan OpenRouter ke Pool API Keys. Sistem merotasi key otomatis saat limit, timeout, atau error.";
    }
    if (body.firstElementChild !== hint) body.insertBefore(hint, body.firstElementChild);

    let pool = body.querySelector("#amyAiKeyPoolInput");
    let poolField = pool?.closest(".field");
    if (!pool) {
      poolField = document.createElement("label");
      poolField.className = "field amy-api-pool-field";
      poolField.innerHTML = `
        <span>Pool API Keys</span>
        <textarea id="amyAiKeyPoolInput" rows="6" autocomplete="off" spellcheck="false" placeholder="gemini:API_KEY_1&#10;gemini:API_KEY_2&#10;openrouter:API_KEY"></textarea>
        <small>Satu API per baris. Format: provider:API_KEY. Gemini dan OpenRouter dipakai lebih dahulu.</small>`;
      pool = poolField.querySelector("textarea");
      pool.value = saved.apiPoolText || "";
      body.insertBefore(poolField, actions || null);
    } else {
      poolField?.classList.add("amy-api-pool-field");
      pool.rows = 6;
    }

    let paid = body.querySelector("#amyAiPaidFallbackInput");
    let paidField = paid?.closest(".toggle-field");
    if (!paid) {
      paidField = document.createElement("label");
      paidField.className = "toggle-field form-toggle";
      paidField.innerHTML = `<input id="amyAiPaidFallbackInput" type="checkbox"><span>Gunakan DeepSeek sebagai fallback berbayar terakhir</span>`;
      paid = paidField.querySelector("input");
      paid.checked = Boolean(saved.paidFallback);
      body.insertBefore(paidField, actions || null);
    }

    if (providerField && poolField && providerField.nextElementSibling !== poolField) {
      providerField.insertAdjacentElement("afterend", poolField);
      poolField.insertAdjacentElement("afterend", paidField);
    }

    const saveButton = body.querySelector("#saveGeminiKeyBtn");
    if (saveButton && !saveButton.dataset.amyPreviewPoolSave) {
      saveButton.dataset.amyPreviewPoolSave = "1";
      saveButton.addEventListener("click", () => {
        writeSettings({
          apiPoolText: pool.value || "",
          paidFallback: Boolean(paid.checked),
          provider: body.querySelector("#aiProviderInput")?.value || saved.provider || "gemini"
        });
      });
    }

    const clearButton = body.querySelector("#clearGeminiKeyBtn");
    if (clearButton && !clearButton.dataset.amyPreviewPoolClear) {
      clearButton.dataset.amyPreviewPoolClear = "1";
      clearButton.addEventListener("click", () => {
        pool.value = "";
        paid.checked = false;
        writeSettings({ apiPoolText: "", paidFallback: false });
      });
    }
  }

  function mount() {
    const view = document.querySelector("#assistantView");
    const workspace = view?.querySelector(".assistant-workspace");
    const settings = document.querySelector("#assistantApiSettings");
    const headline = view?.querySelector(".assistant-chat-headline");
    if (!view || !workspace || !settings || !headline) return false;

    injectStyle();
    settings.classList.add("amy-preview-api-settings");

    if (workspace.firstElementChild !== settings) {
      workspace.insertBefore(settings, workspace.firstElementChild);
    }

    ensurePageHeader(view, headline);
    ensurePoolUi(settings);

    if (!hasStoredApi()) settings.open = true;
    mounted = true;
    return true;
  }

  function boot() {
    if (mount()) {
      setTimeout(mount, 120);
      setTimeout(mount, 500);
      setTimeout(mount, 1200);
      return;
    }
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

  window.addEventListener("focus", () => {
    if (mounted) setTimeout(mount, 0);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
