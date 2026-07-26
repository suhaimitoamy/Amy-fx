"use strict";

(function () {
  if (window.__amyPreviewAiSettingsV2) return;
  window.__amyPreviewAiSettingsV2 = true;

  const SETTINGS_KEY = "tradingLibraryManager.assistantSettings.v1";
  const PROVIDERS = ["gemini", "openrouter", "deepseek"];
  const LABELS = Object.freeze({
    gemini: "Gemini",
    openrouter: "OpenRouter",
    deepseek: "DeepSeek"
  });
  const MODELS = Object.freeze({
    gemini: "gemini-3.6-flash",
    openrouter: "openrouter/auto",
    deepseek: "deepseek-v4-flash"
  });

  const cooldowns = new Map();
  let cursor = 0;
  let mounted = false;
  let processing = false;

  const qs = (selector, root = document) => root.querySelector(selector);
  const unique = list => [...new Set((list || []).map(cleanKey).filter(Boolean))];

  function cleanKey(value) {
    return String(value || "")
      .trim()
      .replace(/^Bearer\s+/i, "")
      .replace(/^["'`]+|["'`,;]+$/g, "");
  }

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

  function parseImport(text) {
    const result = { gemini: [], openrouter: [], deepseek: [] };
    const tokens = String(text || "").match(
      /(?:sk-or-v1-[A-Za-z0-9_-]{20,}|AQ\.[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,})/g
    ) || [];

    tokens.forEach(raw => {
      const key = cleanKey(raw);
      if (key.startsWith("sk-or-v1-")) result.openrouter.push(key);
      else if (key.startsWith("AQ.") || key.startsWith("AIza")) result.gemini.push(key);
      else if (key.startsWith("sk-")) result.deepseek.push(key);
    });

    PROVIDERS.forEach(provider => { result[provider] = unique(result[provider]); });
    return result;
  }

  function countKeys(config) {
    return PROVIDERS.reduce((sum, provider) => sum + (config[provider]?.length || 0), 0);
  }

  function loadConfig() {
    const saved = readSettings();
    const legacy = parseLegacyPool(saved.apiPoolText);
    const legacyProvider = String(saved.provider || saved.aiProvider || "gemini").toLowerCase();
    const legacyKey = cleanKey(saved.apiKey || "");
    if (legacyKey && legacy[legacyProvider]) legacy[legacyProvider].unshift(legacyKey);

    return {
      primary: PROVIDERS.includes(saved.primaryProvider)
        ? saved.primaryProvider
        : (PROVIDERS.includes(legacyProvider) ? legacyProvider : "gemini"),
      gemini: unique([...(saved.geminiKeys || []), ...legacy.gemini]),
      openrouter: unique([...(saved.openrouterKeys || []), ...legacy.openrouter]),
      deepseek: unique([saved.deepseekKey, ...(saved.deepseekKeys || []), ...legacy.deepseek]),
      models: { ...MODELS }
    };
  }

  function manualConfig() {
    const current = loadConfig();
    return {
      primary: qs('input[name="amyAiPrimaryV2"]:checked')?.value || current.primary,
      gemini: unique(String(qs("#amyAiGeminiManual")?.value || "").split(/\r?\n|,/)),
      openrouter: unique(String(qs("#amyAiOpenRouterManual")?.value || "").split(/\r?\n|,/)),
      deepseek: unique(String(qs("#amyAiDeepSeekManual")?.value || "").split(/\r?\n|,/)),
      models: { ...MODELS }
    };
  }

  function configFromUi() {
    const current = manualConfig();
    const imported = parseImport(qs("#amyAiPasteAll")?.value || "");
    if (!countKeys(imported)) return current;
    return {
      primary: current.primary,
      gemini: imported.gemini,
      openrouter: imported.openrouter,
      deepseek: imported.deepseek,
      models: { ...MODELS }
    };
  }

  function serializePool(config) {
    return [
      ...config.gemini.map(key => `gemini:${key}|${MODELS.gemini}`),
      ...config.openrouter.map(key => `openrouter:${key}|${MODELS.openrouter}`),
      ...config.deepseek.map(key => `deepseek:${key}|${MODELS.deepseek}`)
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
      state.geminiModel = MODELS[config.primary];
    } catch (_) {}

    const provider = qs("#aiProviderInput");
    const key = qs("#geminiApiKeyInput");
    const model = qs("#geminiModelInput");
    if (provider) provider.value = config.primary;
    if (key) key.value = first;
    if (model) model.value = MODELS[config.primary];
  }

  function renderManual(config = loadConfig()) {
    const fields = {
      gemini: qs("#amyAiGeminiManual"),
      openrouter: qs("#amyAiOpenRouterManual"),
      deepseek: qs("#amyAiDeepSeekManual")
    };
    PROVIDERS.forEach(provider => {
      const field = fields[provider];
      if (field && document.activeElement !== field) field.value = config[provider].join("\n");
    });
    const primary = qs(`input[name="amyAiPrimaryV2"][value="${config.primary}"]`);
    if (primary) primary.checked = true;
  }

  function saveConfig(showMessage = true) {
    const previous = readSettings();
    const config = configFromUi();
    const first = config[config.primary]?.[0]
      || config.gemini[0]
      || config.openrouter[0]
      || config.deepseek[0]
      || "";

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...previous,
      provider: config.primary,
      primaryProvider: config.primary,
      apiKey: first,
      model: MODELS[config.primary],
      geminiKeys: config.gemini,
      openrouterKeys: config.openrouter,
      deepseekKey: config.deepseek[0] || "",
      deepseekKeys: config.deepseek,
      models: { ...MODELS },
      apiPoolText: serializePool(config),
      paidFallback: config.deepseek.length > 0
    }));

    const importField = qs("#amyAiPasteAll");
    if (importField) importField.value = "";
    renderManual(config);
    syncLegacyState(config);
    renderCounts(config);
    updateHeader();
    if (showMessage) setMessage(`${countKeys(config)} API tersimpan hanya di perangkat.`, "ok");
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
    const importField = qs("#amyAiPasteAll");
    if (importField) importField.value = "";
    renderManual(loadConfig());
    PROVIDERS.forEach(provider => setProviderStatus(provider, "Belum diisi", ""));
    renderCounts(loadConfig());
    updateHeader();
    setMessage("Semua API dihapus dari perangkat.");
  }

  function credentialList(config = loadConfig()) {
    const rows = [];
    PROVIDERS.forEach(provider => {
      (config[provider] || []).forEach((key, index) => rows.push({
        id: `${provider}:${index}:${key.slice(-8)}`,
        provider,
        key,
        model: MODELS[provider]
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

  function setMessage(text, type = "") {
    const target = qs("#amyAiMessageV2") || qs("#assistantMessage");
    if (!target) return;
    target.textContent = String(text || "");
    target.dataset.type = type;
  }

  function setProviderStatus(provider, text, kind = "") {
    const target = qs(`#amyAiStatusV2-${provider}`);
    if (!target) return;
    target.textContent = text;
    target.dataset.kind = kind;
  }

  function renderCounts(config = loadConfig()) {
    PROVIDERS.forEach(provider => {
      const count = config[provider]?.length || 0;
      const target = qs(`#amyAiCountV2-${provider}`);
      if (target) target.textContent = `${count} API`;
    });
  }

  function updateHeader(text = "") {
    const config = loadConfig();
    const total = countKeys(config);
    const badge = qs("#amyAiBadgeV2");
    const summary = qs("#assistantApiSummary");
    const value = text || (total ? `${total} API • ${LABELS[config.primary]} utama` : "Belum tersambung");
    if (badge) {
      badge.textContent = total ? `${total} tersimpan` : "Belum ada API";
      badge.dataset.ready = total ? "true" : "false";
    }
    if (summary) summary.textContent = value;
  }

  function updateImportPreview() {
    const imported = parseImport(qs("#amyAiPasteAll")?.value || "");
    const total = countKeys(imported);
    const preview = qs("#amyAiImportPreview");
    if (preview) {
      preview.textContent = total
        ? `Terdeteksi: ${imported.gemini.length} Gemini • ${imported.openrouter.length} OpenRouter • ${imported.deepseek.length} DeepSeek`
        : "Tempel teks apa adanya. Nomor dan judul provider boleh ikut.";
      preview.dataset.ready = total ? "true" : "false";
    }
  }

  function humanError(error) {
    const status = Number(error?.status || 0);
    const raw = String(error?.message || "Koneksi gagal.").replace(/\s+/g, " ").trim();
    const prefix = status === 400 ? "Format permintaan/model ditolak"
      : status === 401 ? "API tidak valid atau sudah dicabut"
        : status === 402 ? "Saldo/kredit provider tidak cukup"
          : status === 403 ? "API diblokir atau izin belum sesuai"
            : status === 404 ? "Model tidak tersedia untuk akun ini"
              : status === 408 ? "Provider terlalu lama merespons"
                : status === 429 ? "Batas pemakaian API tercapai"
                  : status >= 500 ? "Server provider sedang bermasalah"
                    : "Koneksi gagal";
    return `${prefix}${raw ? ` — ${raw}` : ""}`.slice(0, 260);
  }

  async function responseError(response) {
    let message = "";
    try {
      const data = await response.clone().json();
      const value = data?.error?.message || data?.error || data?.message || data?.detail || "";
      message = typeof value === "string" ? value : JSON.stringify(value);
    } catch (_) {
      try { message = (await response.text()).slice(0, 220); } catch (_) {}
    }
    const error = new Error(message ? `HTTP ${response.status}: ${message}` : `HTTP ${response.status}`);
    error.status = response.status;
    return error;
  }

  async function fetchTimed(url, options, timeout = 24000) {
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
      const networkError = new Error(error?.message || "Transport native tidak dapat menghubungi provider.");
      networkError.status = Number(error?.status || 0);
      throw networkError;
    } finally {
      clearTimeout(timer);
    }
  }

  function partsText(parts) {
    return (parts || []).map(part => part?.text || "").filter(Boolean).join("\n\n").trim();
  }

  async function callGemini(item, parts, options = {}) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(item.model)}:generateContent`;
    const generationConfig = { maxOutputTokens: options.test ? 32 : 1600 };
    if (options.json) generationConfig.responseMimeType = "application/json";
    const response = await fetchTimed(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": item.key
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig
      })
    }, options.test ? 18000 : 28000);
    if (!response.ok) throw await responseError(response);
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n").trim();
    if (!text) throw new Error("Respons Gemini kosong atau diblokir safety filter.");
    return text;
  }

  async function callOpenAiCompatible(item, parts, options = {}) {
    const endpoint = item.provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.deepseek.com/chat/completions";
    const content = item.provider === "openrouter" && typeof partsToOpenAIContent === "function"
      ? partsToOpenAIContent(parts)
      : partsText(parts);
    const payload = {
      model: item.model,
      messages: [
        {
          role: "system",
          content: "Kamu adalah asisten jurnal trading Amy FX. Jawab dalam bahasa Indonesia, jelas, praktis, dan tidak memberi kepastian sinyal buy atau sell."
        },
        { role: "user", content }
      ],
      max_tokens: options.test ? 32 : 1600
    };
    if (item.provider === "deepseek") payload.thinking = { type: "disabled" };
    if (options.json) payload.response_format = { type: "json_object" };

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${item.key}`
    };
    if (item.provider === "openrouter") {
      headers["HTTP-Referer"] = "https://appassets.androidplatform.net/assets/";
      headers["X-OpenRouter-Title"] = "Amy FX Preview";
    }

    const response = await fetchTimed(endpoint, {
      method: "POST",
      credentials: "omit",
      headers,
      body: JSON.stringify(payload)
    }, options.test ? 18000 : 28000);
    if (!response.ok) throw await responseError(response);
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || data?.output_text || "";
    if (!String(text).trim()) throw new Error(`Respons ${LABELS[item.provider]} kosong.`);
    return String(text).trim();
  }

  async function callOne(item, parts, options = {}) {
    return item.provider === "gemini"
      ? callGemini(item, parts, options)
      : callOpenAiCompatible(item, parts, options);
  }

  function setCooldown(item, status) {
    const duration = status === 401 || status === 403
      ? 10 * 60 * 1000
      : status === 429
        ? 90 * 1000
        : 20 * 1000;
    cooldowns.set(item.id, Date.now() + duration);
  }

  async function testProvider(provider, config = loadConfig()) {
    const keys = config[provider] || [];
    if (!keys.length) {
      setProviderStatus(provider, "Belum diisi", "");
      return { provider, success: 0, total: 0, lastError: "" };
    }

    setProviderStatus(provider, `Menguji 0/${keys.length}`, "testing");
    let success = 0;
    let lastError = "";
    for (let index = 0; index < keys.length; index += 1) {
      const item = {
        id: `${provider}:${index}:${keys[index].slice(-8)}`,
        provider,
        key: keys[index],
        model: MODELS[provider]
      };
      setProviderStatus(provider, `Menguji ${index + 1}/${keys.length}`, "testing");
      try {
        await callOne(item, [{ text: "Balas tepat: OK" }], { test: true });
        cooldowns.delete(item.id);
        success += 1;
      } catch (error) {
        lastError = humanError(error);
      }
    }

    if (success) setProviderStatus(provider, `${success}/${keys.length} aktif`, "ok");
    else setProviderStatus(provider, lastError || "Semua API gagal", "error");
    return { provider, success, total: keys.length, lastError };
  }

  async function testAllProviders() {
    const config = saveConfig(false);
    if (!countKeys(config)) {
      setMessage("Belum ada API. Tempel semua API lalu tekan Simpan & Tes.", "error");
      return [];
    }

    const button = qs("#amyAiSaveTestV2");
    if (button) {
      button.disabled = true;
      button.textContent = "Sedang mengetes...";
    }
    setMessage("Menguji API melalui transport native Android...");

    try {
      const results = [];
      for (const provider of PROVIDERS) results.push(await testProvider(provider, config));
      const active = results.reduce((sum, row) => sum + row.success, 0);
      const total = results.reduce((sum, row) => sum + row.total, 0);
      setMessage(active
        ? `${active}/${total} API berhasil. Rotasi otomatis aktif.`
        : "Semua API gagal. Lihat pesan merah pada provider yang bermasalah.", active ? "ok" : "error");
      updateHeader(active ? `${active}/${total} API terhubung` : "Semua API gagal");
      return results;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Simpan & Tes";
      }
    }
  }

  async function testSingleProvider(provider) {
    const config = saveConfig(false);
    const button = qs(`[data-amy-test-provider="${provider}"]`);
    if (button) button.disabled = true;
    try {
      const result = await testProvider(provider, config);
      if (result.success) setMessage(`${LABELS[provider]}: ${result.success}/${result.total} API aktif.`, "ok");
      else setMessage(`${LABELS[provider]} gagal: ${result.lastError || "API belum diisi"}`, "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function callRotating(parts, options = {}) {
    const config = loadConfig();
    const list = credentialList(config);
    if (!list.length) throw new Error("Belum ada API. Buka Pengaturan API lalu tempel minimal satu API.");

    const failures = [];
    const started = Date.now();
    let attempted = 0;
    for (const item of list) {
      if (Date.now() - started > 65000) break;
      if (!options.ignoreCooldown && (cooldowns.get(item.id) || 0) > Date.now()) continue;
      attempted += 1;
      updateHeader(`Mencoba ${LABELS[item.provider]} ${attempted}/${list.length}`);
      setProviderStatus(item.provider, "Menghubungkan...", "testing");
      try {
        const answer = await callOne(item, parts, options);
        cooldowns.delete(item.id);
        cursor = (cursor + 1) % Math.max(1, list.length);
        setProviderStatus(item.provider, "Terhubung", "ok");
        updateHeader(`${LABELS[item.provider]} terhubung • Rotasi aktif`);
        return answer;
      } catch (error) {
        setCooldown(item, Number(error?.status || 0));
        const message = humanError(error);
        setProviderStatus(item.provider, message, "error");
        failures.push(`${LABELS[item.provider]}: ${message}`);
      }
    }

    updateHeader("Semua API gagal");
    if (!attempted) throw new Error("Semua API sedang cooldown. Tes provider untuk mencoba ulang.");
    throw new Error(failures.slice(-3).join(" | "));
  }

  function providerRow(provider) {
    return `
      <div class="amy-ai-provider-row-v2" data-provider="${provider}">
        <div class="amy-ai-provider-main-v2">
          <span class="amy-ai-provider-name-v2">${LABELS[provider]}</span>
          <span class="amy-ai-provider-model-v2">${MODELS[provider]}</span>
        </div>
        <span class="amy-ai-provider-count-v2" id="amyAiCountV2-${provider}">0 API</span>
        <button type="button" class="amy-ai-test-one-v2" data-amy-test-provider="${provider}">Tes</button>
        <span class="amy-ai-provider-status-v2" id="amyAiStatusV2-${provider}">Belum dites</span>
      </div>`;
  }

  function injectStyle() {
    if (qs("#amyAiSettingsV2Style")) return;
    const style = document.createElement("style");
    style.id = "amyAiSettingsV2Style";
    style.textContent = `
      #assistantApiSettings>.assistant-api-body,#amyAiOverhaulPanel{display:none!important}
      #amyAiSettingsV2{display:grid;gap:12px;padding:14px;border-top:1px solid rgba(255,255,255,.08);background:#090b0a;color:#f5f5f5}
      .amy-ai-head-v2{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.amy-ai-head-v2 h3{margin:0;font-size:1rem}.amy-ai-head-v2 p{margin:4px 0 0;color:#929a95;font-size:.73rem;line-height:1.45}
      #amyAiBadgeV2{flex:0 0 auto;border:1px solid #343a36;border-radius:999px;padding:6px 9px;color:#a6aea9;font-size:.67rem;font-weight:850}#amyAiBadgeV2[data-ready="true"]{border-color:rgba(66,211,138,.38);color:#73e0a9;background:rgba(66,211,138,.08)}
      .amy-ai-import-v2{display:grid;gap:8px}.amy-ai-import-v2 label{font-size:.76rem;font-weight:850}.amy-ai-import-v2 textarea,#amyAiSettingsV2 details textarea{display:block!important;position:static!important;width:100%!important;box-sizing:border-box!important;border:1px solid #303632!important;border-radius:12px!important;background:#111411!important;color:#f7f7f7!important;padding:12px!important;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;resize:vertical!important;outline:none!important}.amy-ai-import-v2 textarea{min-height:128px!important}.amy-ai-import-v2 textarea:focus,#amyAiSettingsV2 details textarea:focus{border-color:#d4af37!important;box-shadow:0 0 0 3px rgba(212,175,55,.1)!important}
      .amy-ai-import-bottom-v2{display:flex;align-items:center;justify-content:space-between;gap:8px}.amy-ai-import-bottom-v2 small{color:#89918c;font-size:.68rem;line-height:1.35}.amy-ai-import-bottom-v2 small[data-ready="true"]{color:#73e0a9}.amy-ai-clipboard-v2{min-height:36px;border:1px solid #343a36;border-radius:10px;background:#151915;color:#d7dcd9;padding:7px 10px;font-size:.7rem;font-weight:850}
      .amy-ai-primary-v2{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.amy-ai-primary-v2 label{position:relative}.amy-ai-primary-v2 input{position:absolute;opacity:0;pointer-events:none}.amy-ai-primary-v2 span{display:flex;align-items:center;justify-content:center;min-height:40px;border:1px solid #303632;border-radius:11px;background:#121512;color:#9ea5a0;font-size:.7rem;font-weight:850}.amy-ai-primary-v2 input:checked+span{border-color:#d4af37;background:rgba(212,175,55,.11);color:#f2d777}
      .amy-ai-provider-list-v2{display:grid;gap:7px}.amy-ai-provider-row-v2{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;border:1px solid #282d29;border-radius:12px;background:#101310;padding:10px}.amy-ai-provider-main-v2{min-width:0}.amy-ai-provider-name-v2{display:block;font-size:.78rem;font-weight:900}.amy-ai-provider-model-v2{display:block;margin-top:2px;color:#7f8882;font-size:.62rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.amy-ai-provider-count-v2{color:#aeb5b1;font-size:.65rem;font-weight:800}.amy-ai-test-one-v2{min-height:34px;border:1px solid #3a413c;border-radius:9px;background:#181c19;color:#e7eae8;padding:6px 10px;font-size:.68rem;font-weight:850}.amy-ai-provider-status-v2{grid-column:1/-1;color:#858d88;font-size:.65rem;line-height:1.35;overflow-wrap:anywhere}.amy-ai-provider-status-v2[data-kind="testing"]{color:#e2c96f}.amy-ai-provider-status-v2[data-kind="ok"]{color:#73e0a9}.amy-ai-provider-status-v2[data-kind="error"]{color:#ff8f96}
      .amy-ai-actions-v2{display:grid;grid-template-columns:1.3fr 1fr;gap:8px}.amy-ai-actions-v2 button{min-height:48px;border-radius:12px;padding:10px;font-size:.77rem;font-weight:900}.amy-ai-save-test-v2{border:0;background:#d4af37;color:#10110f}.amy-ai-save-v2{border:1px solid #3a413c;background:#161a17;color:#f2f4f3}
      #amyAiMessageV2{min-height:19px;margin:0;color:#929a95;font-size:.7rem;line-height:1.45;overflow-wrap:anywhere}#amyAiMessageV2[data-type="ok"]{color:#73e0a9}#amyAiMessageV2[data-type="error"]{color:#ff8f96}
      #amyAiSettingsV2 details{border-top:1px solid #252a26;padding-top:10px}#amyAiSettingsV2 summary{cursor:pointer;color:#a8afaa;font-size:.72rem;font-weight:850}#amyAiSettingsV2 details>div{display:grid;gap:9px;margin-top:10px}#amyAiSettingsV2 details label{display:grid;gap:5px;color:#969e99;font-size:.68rem;font-weight:800}#amyAiSettingsV2 details textarea{min-height:76px!important}.amy-ai-clear-v2{min-height:40px;border:1px solid rgba(255,110,120,.28);border-radius:10px;background:rgba(255,110,120,.06);color:#ff9299;font-size:.7rem;font-weight:850}
      #assistantView .assistant-chat-bar{position:static!important;bottom:auto!important}#assistantView .assistant-chat-input textarea{pointer-events:auto!important;opacity:1!important;visibility:visible!important}
      @media(max-width:520px){#amyAiSettingsV2{padding:12px}.amy-ai-head-v2{display:grid}.amy-ai-primary-v2{grid-template-columns:1fr}.amy-ai-provider-row-v2{grid-template-columns:minmax(0,1fr) auto}.amy-ai-test-one-v2{grid-row:1;grid-column:2}.amy-ai-provider-count-v2{grid-column:1/-1}.amy-ai-actions-v2{grid-template-columns:1fr}.amy-ai-import-bottom-v2{align-items:flex-start;flex-direction:column}.amy-ai-clipboard-v2{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function mountPanel() {
    const details = qs("#assistantApiSettings");
    if (!details) return false;
    injectStyle();

    let panel = qs("#amyAiSettingsV2");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "amyAiSettingsV2";
      panel.innerHTML = `
        <div class="amy-ai-head-v2">
          <div><h3>Pengaturan API</h3><p>Tempel semua API sekaligus. Amy FX akan mengenali provider secara otomatis.</p></div>
          <span id="amyAiBadgeV2">Belum ada API</span>
        </div>
        <div class="amy-ai-import-v2">
          <label for="amyAiPasteAll">Tempel semua API di sini</label>
          <textarea id="amyAiPasteAll" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Gemini:\n1. AIza...\n2. AQ....\n\nOpenRouter:\nsk-or-v1-...\n\nDeepSeek:\nsk-..."></textarea>
          <div class="amy-ai-import-bottom-v2">
            <small id="amyAiImportPreview">Tempel teks apa adanya. Nomor dan judul provider boleh ikut.</small>
            <button type="button" class="amy-ai-clipboard-v2" id="amyAiClipboardV2">Tempel dari Clipboard</button>
          </div>
        </div>
        <div class="amy-ai-primary-v2" aria-label="Provider utama">
          ${PROVIDERS.map(provider => `<label><input type="radio" name="amyAiPrimaryV2" value="${provider}"><span>${LABELS[provider]} utama</span></label>`).join("")}
        </div>
        <div class="amy-ai-provider-list-v2">
          ${PROVIDERS.map(providerRow).join("")}
        </div>
        <div class="amy-ai-actions-v2">
          <button type="button" class="amy-ai-save-test-v2" id="amyAiSaveTestV2">Simpan & Tes</button>
          <button type="button" class="amy-ai-save-v2" id="amyAiSaveV2">Simpan Saja</button>
        </div>
        <p id="amyAiMessageV2" role="status"></p>
        <details>
          <summary>Edit manual per provider</summary>
          <div>
            <label>Gemini<textarea id="amyAiGeminiManual" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea></label>
            <label>OpenRouter<textarea id="amyAiOpenRouterManual" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea></label>
            <label>DeepSeek<textarea id="amyAiDeepSeekManual" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea></label>
            <button type="button" class="amy-ai-clear-v2" id="amyAiClearV2">Hapus Semua API dari Perangkat</button>
          </div>
        </details>`;
      details.appendChild(panel);

      qs("#amyAiPasteAll", panel)?.addEventListener("input", updateImportPreview);
      qs("#amyAiSaveTestV2", panel)?.addEventListener("click", testAllProviders);
      qs("#amyAiSaveV2", panel)?.addEventListener("click", () => saveConfig(true));
      qs("#amyAiClearV2", panel)?.addEventListener("click", clearConfig);
      qs("#amyAiClipboardV2", panel)?.addEventListener("click", async () => {
        try {
          const text = await navigator.clipboard.readText();
          const field = qs("#amyAiPasteAll");
          if (field) field.value = text;
          updateImportPreview();
          setMessage("Isi clipboard sudah ditempel. Tekan Simpan & Tes.");
        } catch (_) {
          qs("#amyAiPasteAll")?.focus();
          setMessage("Clipboard tidak dapat dibaca otomatis. Tekan lama pada kotak lalu pilih Tempel.");
        }
      });
      panel.addEventListener("click", event => {
        const button = event.target.closest?.("[data-amy-test-provider]");
        if (button) testSingleProvider(button.dataset.amyTestProvider);
      });
      panel.addEventListener("change", event => {
        if (event.target.matches?.('input[name="amyAiPrimaryV2"]')) {
          const config = saveConfig(false);
          setMessage(`${LABELS[config.primary]} dijadikan provider utama.`, "ok");
        }
      });
    }

    const config = loadConfig();
    renderManual(config);
    renderCounts(config);
    updateHeader();
    details.open = true;
    syncLegacyState(config);
    mounted = true;
    return true;
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
        try {
          state.aiPopupLastQuestion = text;
          state.aiPopupLastAnswer = safe;
        } catch (_) {}
        if (assistantSurface && loadingId && typeof updateAssistantChatMessage === "function") {
          updateAssistantChatMessage(loadingId, safe, { ...extra, transient: false });
        } else if (!assistantSurface && typeof renderAiPopupText === "function") {
          renderAiPopupText(safe);
        }
        return safe;
      };

      try {
        if (assistantSurface && typeof appendAssistantChat === "function") {
          appendAssistantChat("user", text);
          loadingId = appendAssistantChat("assistant", "Menghubungkan ke AI...", { transient: true })?.id || "";
        } else if (typeof renderAiPopupText === "function") {
          renderAiPopupText("Menghubungkan ke AI...");
        }
        if (typeof hydrateMaterialContentsForQuery === "function") {
          await hydrateMaterialContentsForQuery(text, { maxItems: 80 });
        }
        if (typeof handleAiActionCommand === "function") {
          const action = await handleAiActionCommand(text, { surface });
          if (action) return finish(action.text || "Selesai.", action.extra || {});
        }
        if (typeof buildLocalAssistantQuickAnswer === "function") {
          const quick = await buildLocalAssistantQuickAnswer(text);
          if (quick) return typeof quick === "object" ? finish(quick.text, quick.extra || {}) : finish(quick);
        }
        if (typeof runAssistantQuestion !== "function") {
          throw new Error("Runtime Asisten belum siap. Tutup lalu buka kembali halaman Asisten.");
        }
        const answer = await runAssistantQuestion(text, null, {
          mode: typeof state !== "undefined" ? state.assistantMode : "coach"
        });
        return finish(answer);
      } catch (error) {
        return finish(`AI gagal merespons: ${humanError(error)}`);
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
    setTimeout(patchRuntime, 900);
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
