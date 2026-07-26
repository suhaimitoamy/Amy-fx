"use strict";

(function () {
  if (window.__amyPreviewAiNativeTransportV1) return;
  window.__amyPreviewAiNativeTransportV1 = true;

  const browserFetch = window.fetch.bind(window);
  const allowedHosts = new Set([
    "generativelanguage.googleapis.com",
    "openrouter.ai",
    "api.deepseek.com"
  ]);
  const pending = new Map();
  let sequence = 0;

  function hasNativeBridge() {
    return Boolean(window.AmyNative && typeof window.AmyNative.request === "function");
  }

  function normalizeUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    if (typeof Request !== "undefined" && input instanceof Request) return input.url;
    return String(input || "");
  }

  function isAiRequest(input) {
    try {
      const url = new URL(normalizeUrl(input), location.href);
      return url.protocol === "https:" && allowedHosts.has(url.hostname);
    } catch (_) {
      return false;
    }
  }

  function headersObject(input, init) {
    const output = {};
    try {
      const requestHeaders = typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : null;
      if (requestHeaders) requestHeaders.forEach((value, key) => { output[key] = value; });
      new Headers(init?.headers || {}).forEach((value, key) => { output[key] = value; });
    } catch (_) {}
    return output;
  }

  async function bodyText(input, init) {
    if (typeof init?.body === "string") return init.body;
    if (init?.body == null && typeof Request !== "undefined" && input instanceof Request) {
      try { return await input.clone().text(); } catch (_) { return ""; }
    }
    if (init?.body == null) return "";
    if (init.body instanceof URLSearchParams) return init.body.toString();
    if (typeof Blob !== "undefined" && init.body instanceof Blob) return await init.body.text();
    return String(init.body);
  }

  function createResponse(payload) {
    const status = Number(payload.status) || (payload.ok ? 200 : 500);
    return new Response(String(payload.body || ""), {
      status: Math.min(599, Math.max(200, status)),
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  function rejectRequest(id, error) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    entry.cleanupAbort?.();
    entry.reject(error instanceof Error ? error : new Error(String(error || "Koneksi native AI gagal.")));
  }

  window.AmyNativeAITransport = {
    supported: hasNativeBridge,
    onResult(rawPayload) {
      let payload;
      try {
        payload = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
      } catch (_) {
        return;
      }
      const id = String(payload?.id || "");
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      clearTimeout(entry.timer);
      entry.cleanupAbort?.();
      if (!payload.ok && Number(payload.status) === 0) {
        entry.reject(new Error(payload.error || "Koneksi native AI gagal."));
        return;
      }
      entry.resolve(createResponse(payload));
    }
  };

  async function nativeFetch(input, init = {}) {
    if (!hasNativeBridge()) return browserFetch(input, init);
    const url = new URL(normalizeUrl(input), location.href).href;
    const method = String(init.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
    const headers = headersObject(input, init);
    const body = await bodyText(input, init);
    const id = `amy-ai-${Date.now()}-${++sequence}`;
    const timeoutMs = 70000;

    return new Promise((resolve, reject) => {
      let cleanupAbort = null;
      const signal = init.signal || (input instanceof Request ? input.signal : null);
      if (signal?.aborted) {
        reject(new DOMException("Permintaan dibatalkan.", "AbortError"));
        return;
      }
      if (signal) {
        const onAbort = () => rejectRequest(id, new DOMException("Permintaan dibatalkan.", "AbortError"));
        signal.addEventListener("abort", onAbort, { once: true });
        cleanupAbort = () => signal.removeEventListener("abort", onAbort);
      }
      const timer = setTimeout(() => {
        rejectRequest(id, new Error("Timeout transport native AI."));
      }, timeoutMs + 3000);
      pending.set(id, { resolve, reject, timer, cleanupAbort });
      try {
        window.AmyNative.request(JSON.stringify({
          id,
          url,
          method,
          headers,
          body,
          timeoutMs
        }));
      } catch (error) {
        rejectRequest(id, error);
      }
    });
  }

  window.fetch = function amyPreviewFetch(input, init) {
    if (!isAiRequest(input)) return browserFetch(input, init);
    return nativeFetch(input, init || {});
  };
})();
