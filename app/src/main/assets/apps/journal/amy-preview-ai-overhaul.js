"use strict";

(function () {
  if (window.__amyPreviewAiOverhaulV1) return;
  window.__amyPreviewAiOverhaulV1 = true;

  const SETTINGS_KEY = "tradingLibraryManager.assistantSettings.v1";
  const DEFAULTS = Object.freeze({
    gemini: "gemini-3.5-flash",
    openrouter: "google/gemini-3.5-flash",
    deepseek: "deepseek-v4-flash"
  });
  const LABELS = Object.freeze({
    gemini: "Gemini",
    openrouter: "OpenRouter",
    deepseek: "DeepSeek"
  });
  const cooldowns = new Map();
  let cursor = 0;
  let mounted = false;
  let processing = false;

  const qs = (selector, root = document) => root.querySelector(selector);
  const cleanKey = value => String(value || "").trim().replace(/^Bearer\s+/i, "");
  const splitKeys = value => String(value || "")
    .split(/\r?\n|,/)
    .map(cleanKey)
    .filter(Boolean);
  const unique = list => [...new Set((list || []).filter(Boolean))];

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function parseLegacyPool(text) {
    const result = { gemini: [], openrouter: [], deepseek: [] };
    String(text || "").split(/\r?\n/).forEach(line => {
      const raw = line.trim();
      if (!raw || raw.startsWith("#")) return;
      const separator = raw.includes("|") ? "|" : ":";
      const index = raw.indexOf(separator);
      if (index <= 0) return;
      const provider = raw.slice(0, index).trim().toLowerCase()
        .replace("google", "gemini")
        .replace("open_router", "openrouter");
      const key = cleanKey(raw.slice(index + 1).split("|")[0]);
      if (result[provider] && key) result[provider].push(key);
    });
    return result;
  }

  function loadConfig() {
    const saved = readSettings();
    const legacy = parseLegacyPool(saved.apiPoolText);
    const provider = String(saved.provider || saved.aiProvider || "gemini").toLowerCase();
    const legacyKey = cleanKey(saved.apiKey || "");
    if (legacyKey && legacy[provider]) legacy[provider].unshift(legacyKey);
    return {
      primary: ["gemini", "openrouter", "deepseek"].includes(saved.primaryProvider)
        ? saved.primaryProvider
        : (["gemini", "openrouter", "deepseek"].includes(provider) ? provider : "gemini"),
      gemini: unique([...(saved.geminiKeys || []), ...legacy.gemini]),
      openrouter: unique([...(saved.openrouterKeys || []), ...legacy.openrouter]),
      deepseek: unique([saved.deepseekKey, ...(saved.deepseekKeys || []), ...legacy.deepseek].map(cleanKey)),
      models: {
        gemini: DEFAULTS.gemini,
        openrouter: DEFAULTS.openrouter,
        deepseek: DEFAULTS.deepseek
      }
    };
  }

  function configFromUi() {
    const current = loadConfig();
    return {
      primary: qs('input[name="amyAiPrimary"]:checked')?.value || current.primary,
      gemini: unique(splitKeys(qs("#amyAiGeminiKeys")?.value)),
      openrouter: unique(splitKeys(qs("#amyAiOpenRouterKeys")?.value)),
      deepseek: unique(splitKeys(qs("#amyAiDeepSeekKey")?.value)),
      models: { ...DEFAULTS }
    };
  }

  function serializePool(config) {
    return [
      ...config.gemini.map(key => `gemini:${key}|${DEFAULTS.gemini}`),
      ...config.openrouter.map(key => `openrouter:${key}|${DEFAULTS.openrouter}`),
      ...config.deepseek.map(key => `deepseek:${key}|${DEFAULTS.deepseek}`)
    ].join("\n");
  }

  function syncLegacyState(config = loadConfig()) {
    const first = config[config.primary]?.[0]
      || config.gemini[0]
      || config.openrouter[0]
      || config.deepseek[0]
      || "";
    try {
      state.aiProvider = config.primary;
      state.geminiApiKey = first;
      state.geminiModel = DEFAULTS[config.primary];
    } catch (_) {}
    const provider = qs("#aiProviderInput");
    const key = qs("#geminiApiKeyInput");
    const model = qs("#geminiModelInput");
    if (provider) provider.value = config.primary;
    if (key) key.value = first;
    if (model) model.value = DEFAULTS[config.primary];
  }

  function credentialList(config = loadConfig()) {
    const rows = [];
    ["gemini", "openrouter", "deepseek"].forEach(provider => {
      (config[provider] || []).forEach((key, index) => rows.push({
        id: `${provider}:${index}:${key.slice(-8)}`,
        provider,
        key,
        model: DEFAULTS[provider]
      }));
    });
    if (!rows.length) return rows;
    const ordered = [
      ...rows.filter(row => row.provider === config.primary),
      ...rows.filter(row => row.provider !== config.primary)
    ];
    const offset = cursor % ordered.length;
    return [...ordered.slice(offset), ...ordered.slice(0, offset)];
  }

  function saveConfig(showMessage = true) {
    const previous = readSettings();
    const config = configFromUi();
    const first = config[config.primary][0]
      || config.gemini[0]
      || config.openrouter[0]
      || config.deepseek[0]
      || "";
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...previous,
      provider: config.primary,
      primaryProvider: config.primary,
      apiKey: first,
      model: DEFAULTS[config.primary],
      geminiKeys: config.gemini,
      openrouterKeys: config.openrouter,
      deepseekKey: config.deepseek[0] || "",
      deepseekKeys: config.deepseek,
      models: { ...DEFAULTS },
      apiPoolText: serializePool(config),
      paidFallback: config.deepseek.length > 0
    }));
    syncLegacyState(config);
    updateSummary();
    if (showMessage) setMessage(`${credentialList(config).length} API tersimpan. Rotasi otomatis aktif.`, "ok");
    return config;
  }

  function clearConfig() {
    const previous = readSettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...previous,
      apiKey: "",
      apiPoolText: "",
      geminiKeys: [],
      openrouterKeys: [],
      deepseekKey: "",
      deepseekKeys: []
    }));
    ["#amyAiGeminiKeys", "#amyAiOpenRouterKeys", "#amyAiDeepSeekKey"].forEach(selector => {
      const field = qs(selector);
      if (field) field.value = "";
    });
    syncLegacyState(loadConfig());
    renderProviderStatuses({});
    updateSummary();
    setMessage("Semua API dihapus dari perangkat.");
  }

  function setMessage(text, type = "") {
    const target = qs("#amyAiConnectionMessage") || qs("#assistantMessage");
    if (!target) return;
    target.textContent = text || "";
    target.dataset.type = type;
  }

  function updateSummary(text = "") {
    const config = loadConfig();
    const count = credentialList(config).length;
    const summary = qs("#assistantApiSummary");
    if (summary) summary.textContent = text || `${count} API aktif • ${LABELS[config.primary]} utama`;
    const badge = qs("#amyAiConnectionBadge");
    if (badge) {
      badge.textContent = count ? `${count} API siap` : "Belum ada API";
      badge.classList.toggle("is-ready", count > 0);
    }
  }

  function providerCard(provider, title, hint) {
    const id = provider === "gemini"
      ? "amyAiGeminiKeys"
      : provider === "openrouter"
        ? "amyAiOpenRouterKeys"
        : "amyAiDeepSeekKey";
    const placeholder = provider === "gemini"
      ? "Tempel API Gemini di sini.\nSatu API per baris."
      : provider === "openrouter"
        ? "Tempel API OpenRouter di sini.\nSatu API per baris."
        : "Tempel API DeepSeek di sini.";
    return `
      <section class="amy-ai-provider-card" data-provider="${provider}">
        <div class="amy-ai-provider-head">
          <div><strong>${title}</strong><small>${hint}</small></div>
          <span class="amy-ai-provider-status" id="amyAiStatus-${provider}">Belum dites</span>
        </div>
        <textarea id="${id}" rows="${provider === "deepseek" ? 3 : 5}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${placeholder}"></textarea>
        <label class="amy-ai-primary-choice">
          <input type="radio" name="amyAiPrimary" value="${provider}">
          <span>Jadikan ${title} sebagai API utama</span>
        </label>
      </section>`;
  }

  function injectStyle() {
    if (qs("#amyPreviewAiOverhaulStyle")) return;
    const style = document.createElement("style");
    style.id = "amyPreviewAiOverhaulStyle";
    style.textContent = `
      #assistantApiSettings > .assistant-api-body{display:none!important}
      #amyAiOverhaulPanel{display:grid;gap:14px;border-top:1px solid rgba(212,175,55,.18);padding:14px;background:linear-gradient(180deg,rgba(5,14,9,.98),rgba(3,8,5,.98))}
      .amy-ai-overhaul-intro{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid rgba(57,255,136,.16);border-radius:16px;background:rgba(57,255,136,.055);padding:12px}
      .amy-ai-overhaul-intro strong{display:block;color:#f9fafb;font-size:.94rem}.amy-ai-overhaul-intro p{margin:4px 0 0;color:rgba(229,231,235,.62);font-size:.74rem;line-height:1.45}
      #amyAiConnectionBadge{flex:0 0 auto;border:1px solid rgba(248,113,113,.32);border-radius:999px;color:#ff858d;padding:7px 10px;font-size:.68rem;font-weight:900;white-space:nowrap}
      #amyAiConnectionBadge.is-ready{border-color:rgba(57,255,136,.32);background:rgba(57,255,136,.08);color:#70e9a4}
      .amy-ai-provider-list{display:grid;gap:11px}.amy-ai-provider-card{display:grid;gap:10px;min-width:0;overflow:visible;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(255,255,255,.025);padding:12px}
      .amy-ai-provider-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.amy-ai-provider-head div{min-width:0}.amy-ai-provider-head strong{display:block;color:#f9fafb;font-size:.9rem}.amy-ai-provider-head small{display:block;margin-top:3px;color:rgba(229,231,235,.55);font-size:.68rem;line-height:1.35}
      .amy-ai-provider-status{flex:0 0 auto;max-width:48%;border-radius:999px;background:rgba(255,255,255,.05);color:rgba(229,231,235,.62);padding:6px 9px;font-size:.64rem;font-weight:850;text-align:right}.amy-ai-provider-status.is-testing{color:#d4af37;background:rgba(212,175,55,.08)}.amy-ai-provider-status.is-ok{color:#70e9a4;background:rgba(57,255,136,.08)}.amy-ai-provider-status.is-error{color:#ff858d;background:rgba(248,113,113,.08)}
      #amyAiOverhaulPanel textarea{position:static!important;display:block!important;width:100%!important;min-width:0!important;min-height:72px!important;height:auto!important;border:1px solid rgba(212,175,55,.24)!important;border-radius:14px!important;background:#071009!important;color:#f9fafb!important;padding:13px!important;font-family:"JetBrains Mono",monospace!important;font-size:15px!important;line-height:1.5!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;resize:vertical!important;outline:none!important}
      #amyAiOverhaulPanel textarea:focus{border-color:#d4af37!important;box-shadow:0 0 0 3px rgba(212,175,55,.1)!important}
      .amy-ai-primary-choice{display:flex;align-items:center;gap:9px;min-height:38px;color:rgba(229,231,235,.68);font-size:.72rem;font-weight:800}.amy-ai-primary-choice input{width:18px!important;min-width:18px!important;min-height:18px!important;height:18px!important;margin:0;padding:0!important;accent-color:#d4af37}
      .amy-ai-model-note{border:1px solid rgba(212,175,55,.15);border-radius:14px;background:rgba(212,175,55,.05);color:rgba(229,231,235,.65);padding:10px 11px;font-size:.7rem;line-height:1.5}
      .amy-ai-overhaul-actions{position:static!important;display:grid!important;grid-template-columns:1.15fr 1fr!important;gap:9px!important;width:100%!important;margin:0!important;border:0!important;background:transparent!important;padding:0!important;box-shadow:none!important;backdrop-filter:none!important}.amy-ai-overhaul-actions button{position:static!important;width:100%!important;min-height:48px!important;border-radius:14px!important;padding:10px!important;font-size:.78rem!important;font-weight:900!important}
      #amyAiSaveAllBtn{background:#d4af37;color:#111}#amyAiTestAllBtn{border:1px solid rgba(57,255,136,.24);background:rgba(57,255,136,.065);color:#e9fff1}#amyAiClearAllBtn{grid-column:1/-1;border:1px solid rgba(248,113,113,.28);background:rgba(248,113,113,.055);color:#ff858d}
      #amyAiConnectionMessage{min-height:20px;margin:0;color:rgba(229,231,235,.7);font-size:.72rem;line-height:1.45}#amyAiConnectionMessage[data-type="error"]{color:#ff858d}#amyAiConnectionMessage[data-type="ok"]{color:#70e9a4}
      #assistantView .assistant-chat-log{min-height:110px!important}#assistantView .assistant-chat-bar{position:static!important;bottom:auto!important;z-index:auto!important}#assistantView .assistant-chat-input textarea{pointer-events:auto!important;opacity:1!important;visibility:visible!important}
      @media(max-width:520px){#amyAiOverhaulPanel{padding:12px}.amy-ai-overhaul-intro{align-items:flex-start}.amy-ai-provider-head{display:grid}.amy-ai-provider-status{max-width:100%;justify-self:start;text-align:left}.amy-ai-overhaul-actions{grid-template-columns:1fr!important}#amyAiClearAllBtn{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function mountPanel() {
    const details = qs("#assistantApiSettings");
    if (!details) return false;
    injectStyle();
    let panel = qs("#amyAiOverhaulPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "amyAiOverhaulPanel";
      panel.innerHTML = `
        <div class="amy-ai-overhaul-intro">
          <div><strong>Sambungkan AI</strong><p>Tempel API langsung. Model aktif dipilih otomatis.</p></div>
          <span id="amyAiConnectionBadge">Belum ada API</span>
        </div>
        <div class="amy-ai-provider-list">
          ${providerCard("gemini", "Gemini", `Model aktif: ${DEFAULTS.gemini}`)}
          ${providerCard("openrouter", "OpenRouter", `Model aktif: ${DEFAULTS.openrouter}`)}
          ${providerCard("deepseek", "DeepSeek", `Model aktif: ${DEFAULTS.deepseek}`)}
        </div>
        <div class="amy-ai-model-note">AI utama dicoba lebih dahulu. Jika limit, timeout, atau error, sistem otomatis berpindah ke API berikutnya.</div>
        <div class="amy-ai-overhaul-actions">
          <button id="amyAiSaveAllBtn" type="button">Simpan Semua API</button>
          <button id="amyAiTestAllBtn" type="button">Tes Semua API</button>
          <button id="amyAiClearAllBtn" type="button">Hapus Semua API</button>
        </div>
        <p id="amyAiConnectionMessage" role="status"></p>`;
      details.append(panel);
      qs("#amyAiSaveAllBtn", panel)?.addEventListener("click", () => saveConfig(true));
      qs("#amyAiTestAllBtn", panel)?.addEventListener("click", testAllProviders);
      qs("#amyAiClearAllBtn", panel)?.addEventListener("click", clearConfig);
      panel.addEventListener("input", updateDraftSummary);
      panel.addEventListener("change", updateDraftSummary);
    }
    const config = loadConfig();
    const fields = {
      gemini: qs("#amyAiGeminiKeys"),
      openrouter: qs("#amyAiOpenRouterKeys"),
      deepseek: qs("#amyAiDeepSeekKey")
    };
    if (fields.gemini && document.activeElement !== fields.gemini) fields.gemini.value = config.gemini.join("\n");
    if (fields.openrouter && document.activeElement !== fields.openrouter) fields.openrouter.value = config.openrouter.join("\n");
    if (fields.deepseek && document.activeElement !== fields.deepseek) fields.deepseek.value = config.deepseek.join("\n");
    const primary = qs(`input[name="amyAiPrimary"][value="${config.primary}"]`);
    if (primary) primary.checked = true;
    details.open = true;
    syncLegacyState(config);
    updateSummary();
    mounted = true;
    return true;
  }

  function updateDraftSummary() {
    const count = credentialList(configFromUi()).length;
    const badge = qs("#amyAiConnectionBadge");
    if (badge) {
      badge.textContent = count ? `${count} API siap disimpan` : "Belum ada API";
      badge.classList.toggle("is-ready", count > 0);
    }
  }

  function setProviderStatus(provider, text, kind = "") {
    const target = qs(`#amyAiStatus-${provider}`);
    if (!target) return;
    target.textContent = text;
    target.className = `amy-ai-provider-status${kind ? ` is-${kind}` : ""}`;
  }

  function renderProviderStatuses(statuses = {}) {
    ["gemini", "openrouter", "deepseek"].forEach(provider => {
      const row = statuses[provider];
      setProviderStatus(provider, row?.text || "Belum dites", row?.kind || "");
    });
  }

  async function responseError(response) {
    let message = "";
    try {
      const data = await response.clone().json();
      message = data?.error?.message || data?.message || data?.detail || "";
    } catch (_) {
      try { message = (await response.text()).slice(0, 240); } catch (_) {}
    }
    const error = new Error(message ? `HTTP ${response.status}: ${message}` : `HTTP ${response.status}`);
    error.status = response.status;
    return error;
  }

  async function fetchTimed(url, options, timeout = 22000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutError = new Error("Timeout. API terlalu lama merespons.");
        timeoutError.status = 408;
        throw timeoutError;
      }
      const networkError = new Error(error?.message === "Failed to fetch"
        ? "Koneksi ditolak atau API tidak dapat dijangkau dari perangkat."
        : (error?.message || "Koneksi API gagal."));
      networkError.status = 0;
      throw networkError;
    } finally {
      clearTimeout(timer);
    }
  }

  function partsText(parts) {
    return (parts || []).map(part => part?.text || "").filter(Boolean).join("\n\n").trim();
  }

  async function callGemini(item, parts, options = {}) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(item.model)}:generateContent?key=${encodeURIComponent(item.key)}`;
    const generationConfig = { maxOutputTokens: options.test ? 40 : 1600 };
    if (options.json) generationConfig.responseMimeType = "application/json";
    const response = await fetchTimed(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig })
    }, options.test ? 16000 : 22000);
    if (!response.ok) throw await responseError(response);
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n").trim();
    if (!text) throw new Error("Respons Gemini kosong.");
    return text;
  }

  async function callOpenAI(item, parts, options = {}) {
    const endpoint = item.provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.deepseek.com/chat/completions";
    const content = item.provider === "openrouter" && typeof partsToOpenAIContent === "function"
      ? partsToOpenAIContent(parts)
      : partsText(parts);
    const payload = {
      model: item.model,
      messages: [
        { role: "system", content: "Kamu adalah asisten jurnal trading Amy FX. Jawab dalam bahasa Indonesia, jelas, praktis, dan tidak memberi kepastian sinyal buy atau sell." },
        { role: "user", content }
      ],
      max_tokens: options.test ? 40 : 1600
    };
    if (item.provider === "deepseek") payload.thinking = { type: "disabled" };
    if (options.json) payload.response_format = { type: "json_object" };
    const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${item.key}` };
    if (item.provider === "openrouter") {
      headers["HTTP-Referer"] = location.href;
      headers["X-Title"] = "Amy FX Preview";
    }
    const response = await fetchTimed(endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers,
      body: JSON.stringify(payload)
    }, options.test ? 16000 : 22000);
    if (!response.ok) throw await responseError(response);
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || data?.output_text || "";
    if (!String(text).trim()) throw new Error(`Respons ${LABELS[item.provider]} kosong.`);
    return String(text).trim();
  }

  async function callOne(item, parts, options = {}) {
    return item.provider === "gemini" ? callGemini(item, parts, options) : callOpenAI(item, parts, options);
  }

  function setCooldown(item, status) {
    const duration = status === 401 || status === 403 ? 600000 : status === 429 ? 90000 : 20000;
    cooldowns.set(item.id, Date.now() + duration);
  }

  async function callRotating(parts, options = {}) {
    const config = saveConfig(false);
    const list = credentialList(config);
    if (!list.length) throw new Error("Belum ada API. Isi minimal satu API lalu tekan Simpan Semua API.");
    const failures = [];
    const started = Date.now();
    let attempted = 0;
    for (const item of list) {
      if (Date.now() - started > 62000) break;
      if (!options.ignoreCooldown && (cooldowns.get(item.id) || 0) > Date.now()) continue;
      attempted += 1;
      updateSummary(`Mencoba ${LABELS[item.provider]} • ${attempted}/${list.length}`);
      setProviderStatus(item.provider, "Menghubungkan...", "testing");
      try {
        const answer = await callOne(item, parts, options);
        cooldowns.delete(item.id);
        cursor = (cursor + 1) % Math.max(1, list.length);
        setProviderStatus(item.provider, "Terhubung", "ok");
        updateSummary(`${LABELS[item.provider]} terhubung • Rotasi aktif`);
        return answer;
      } catch (error) {
        setCooldown(item, error.status);
        setProviderStatus(item.provider, error.message || "Gagal", "error");
        failures.push(`${LABELS[item.provider]}: ${error.message || "gagal"}`);
      }
    }
    updateSummary("Semua API gagal");
    if (!attempted) throw new Error("Semua API sedang cooldown. Tekan Tes Semua API untuk mencoba ulang.");
    throw new Error(failures.slice(-4).join(" | "));
  }

  async function testAllProviders() {
    const config = saveConfig(false);
    const list = credentialList(config);
    renderProviderStatuses({});
    if (!list.length) return setMessage("Isi minimal satu API terlebih dahulu.", "error");
    const button = qs("#amyAiTestAllBtn");
    if (button) { button.disabled = true; button.textContent = "Sedang mengetes..."; }
    setMessage("Mengetes setiap provider. Tunggu sampai semua hasil tampil.");
    const grouped = list.reduce((map, item) => {
      (map[item.provider] ||= []).push(item);
      return map;
    }, {});
    const results = [];
    for (const provider of ["gemini", "openrouter", "deepseek"]) {
      const items = grouped[provider] || [];
      if (!items.length) {
        setProviderStatus(provider, "API belum diisi");
        continue;
      }
      let success = false;
      const errors = [];
      for (let index = 0; index < items.length; index += 1) {
        setProviderStatus(provider, `Tes ${index + 1}/${items.length}`, "testing");
        try {
          await callOne(items[index], [{ text: "Balas tepat: KONEKSI BERHASIL" }], { test: true });
          cooldowns.delete(items[index].id);
          success = true;
          break;
        } catch (error) {
          errors.push(error.message || "gagal");
        }
      }
      if (success) {
        setProviderStatus(provider, "Koneksi berhasil", "ok");
        results.push(`${LABELS[provider]} berhasil`);
      } else {
        setProviderStatus(provider, errors.at(-1) || "Semua API gagal", "error");
        results.push(`${LABELS[provider]} gagal`);
      }
    }
    saveConfig(false);
    const anySuccess = results.some(text => text.includes("berhasil"));
    setMessage(results.join(" • "), anySuccess ? "ok" : "error");
    if (button) { button.disabled = false; button.textContent = "Tes Semua API"; }
  }

  function patchRuntime() {
    window.callAI = callRotating;
    window.saveGeminiSettings = function (showMessage = true) { return saveConfig(showMessage); };
    window.clearGeminiSettings = clearConfig;
    window.testGeminiConnection = testAllProviders;
    window.processAssistantInput = async function (question, surface = "assistant") {
      const assistantSurface = surface === "assistant";
      const text = String(question || "").trim();
      if (!text || processing) return "";
      processing = true;
      try { state.isAiProcessing = true; } catch (_) {}
      let loadingId = "";
      const finish = (answer, extra = {}) => {
        const safe = String(answer || "Tidak ada jawaban.");
        try { state.aiPopupLastQuestion = text; state.aiPopupLastAnswer = safe; } catch (_) {}
        if (assistantSurface && loadingId && typeof updateAssistantChatMessage === "function") {
          updateAssistantChatMessage(loadingId, safe, { ...extra, transient: false });
        } else if (!assistantSurface && typeof renderAiPopupText === "function") {
          renderAiPopupText(safe);
        }
        return safe;
      };
      try {
        saveConfig(false);
        if (assistantSurface && typeof appendAssistantChat === "function") {
          appendAssistantChat("user", text);
          loadingId = appendAssistantChat("assistant", "Menghubungkan ke AI...", { transient: true })?.id || "";
        } else if (typeof renderAiPopupText === "function") {
          renderAiPopupText("Menghubungkan ke AI...");
        }
        if (typeof hydrateMaterialContentsForQuery === "function") await hydrateMaterialContentsForQuery(text, { maxItems: 80 });
        if (typeof handleAiActionCommand === "function") {
          const action = await handleAiActionCommand(text, { surface });
          if (action) return finish(action.text || "Selesai.", action.extra || {});
        }
        if (typeof buildLocalAssistantQuickAnswer === "function") {
          const quick = await buildLocalAssistantQuickAnswer(text);
          if (quick) return typeof quick === "object" ? finish(quick.text, quick.extra || {}) : finish(quick);
        }
        if (typeof runAssistantQuestion !== "function") throw new Error("Runtime Asisten belum siap. Tutup lalu buka kembali halaman Asisten.");
        const answer = await runAssistantQuestion(text, null, { mode: typeof state !== "undefined" ? state.assistantMode : "coach" });
        return finish(answer);
      } catch (error) {
        return finish(`AI gagal merespons: ${error.message || "proses gagal"}`);
      } finally {
        processing = false;
        try { state.isAiProcessing = false; } catch (_) {}
      }
    };
  }

  function apply() {
    if (typeof state === "undefined" || typeof runAssistantQuestion !== "function") return false;
    mountPanel();
    patchRuntime();
    syncLegacyState(loadConfig());
    setTimeout(patchRuntime, 250);
    setTimeout(patchRuntime, 800);
    setTimeout(patchRuntime, 1600);
    return true;
  }

  function boot() {
    const timer = setInterval(() => { if (apply()) clearInterval(timer); }, 100);
    setTimeout(() => clearInterval(timer), 15000);
  }

  document.addEventListener("click", event => {
    if (event.target.closest?.('[data-view="assistant"]')) {
      setTimeout(() => { mountPanel(); patchRuntime(); }, 80);
    }
  }, true);

  window.addEventListener("focus", () => {
    if (mounted) setTimeout(() => { mountPanel(); patchRuntime(); }, 0);
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();