"use strict";

(function () {
  if (window.__amyFxMentorMappingIntentHotfixV1) return;
  window.__amyFxMentorMappingIntentHotfixV1 = true;

  const VERSION = "1.0.0";
  const SESSION_KEY = "amyfx.mentor.safeRuleChat.v3";
  const TTL_MS = Object.freeze({ M1: 300_000, M5: 900_000, M15: 1_800_000, H1: 10_800_000, H4: 43_200_000, D1: 259_200_000 });
  const INVALID_LEVEL = /(SWEPT|INVALID|BROKEN|EXPIRED|HISTORICAL|CONSUMED|INACTIVE)/i;
  const clean = value => String(value ?? "").trim();
  const lower = value => clean(value).toLowerCase().replace(/\s+/g, " ");

  function safeParse(value, fallback = null) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function readSession() {
    try { return safeParse(sessionStorage.getItem(SESSION_KEY), {}) || {}; } catch { return {}; }
  }

  function writeSession(patch) {
    const next = { ...readSession(), ...patch };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch {}
    return next;
  }

  function currentModule() {
    const path = location.pathname.toLowerCase();
    if (path.includes("/apps/mapping/")) return "mapping";
    if (path.includes("/apps/market-intel/")) return "intel";
    if (path.includes("/apps/journal/")) return "journal";
    if (path.includes("/apps/academy/")) return "academy";
    return "home";
  }

  function firstValidTime(values) {
    for (const value of values) {
      const time = new Date(value || 0).getTime();
      if (Number.isFinite(time) && time > 86_400_000) return new Date(time).toISOString();
    }
    return null;
  }

  function levelRows(source) {
    const arrays = [
      source?.levels,
      source?.liquidityLevels,
      source?.liquidity?.levels,
      source?.validatedMarketContext?.liquidityLevels,
      source?.result?.levels,
      source?.result?.liquidityLevels,
      source?.result?.liquidity?.levels,
      source?.result?.validatedMarketContext?.liquidityLevels
    ];
    const rows = arrays.find(Array.isArray) || [];
    return rows.map(item => ({
      type: clean(item?.type || item?.liquidityType).toUpperCase(),
      price: Number(item?.price ?? item?.level) || null,
      status: clean(item?.status || "ACTIVE").toUpperCase(),
      active: item?.active !== false
    })).filter(item => ["BSL", "SSL"].includes(item.type) && item.price);
  }

  function mappingSnapshot(context) {
    const workspace = context?.payload?.workspace || {};
    const market = workspace.market || {};
    const payload = context?.payload || {};
    const intel = market.shared_intelligence || window.AmyFXIntel?.read?.() || window.AmyFXIntelState || {};
    const shared = intel?.mapping || {};
    const live = market.live_state || window.AmyFXMarketState || window.lastMappingResult || payload || {};
    const result = live.result || window.AmyFXMarketState?.result || window.lastMappingResult || {};
    const timeframe = clean(live.timeframe || live.tf || shared.timeframe || payload.timeframe || "M15").toUpperCase();
    const capturedAt = firstValidTime([
      live.capturedAt,
      live.captured_at,
      live.updatedAt,
      shared.updated,
      shared.capturedAt,
      market.captured_at,
      context?.captured_at,
      result.capturedAt,
      result.timestamp
    ]);
    const price = Number(live.price || market.current_price || shared.price || result.price || localStorage.getItem("last_price") || 0) || null;
    const state = lower(context?.freshness?.state || market?.freshness?.state || "");
    const staleFlag = Boolean(live.dataStale || shared.dataStale || ["missing", "stale", "expired", "invalid", "unknown"].includes(state));
    const timestamp = new Date(capturedAt || 0).getTime();
    const hardTtl = TTL_MS[timeframe] || TTL_MS.M15;
    const fresh = Boolean(capturedAt) && !staleFlag && Number.isFinite(timestamp) && Date.now() - timestamp <= hardTtl;
    const levels = [
      ...levelRows(shared),
      ...levelRows(live),
      ...levelRows(result),
      ...levelRows(payload)
    ];
    const unique = [];
    const seen = new Set();
    for (const level of levels) {
      const key = `${level.type}:${level.price}:${level.status}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(level);
    }
    const nearest = type => unique
      .filter(level => level.type === type && level.active && !INVALID_LEVEL.test(level.status))
      .sort((left, right) => price ? Math.abs(left.price - price) - Math.abs(right.price - price) : left.price - right.price)[0] || null;
    return {
      timeframe,
      capturedAt,
      price,
      fresh,
      state: state || (fresh ? "fresh" : "expired"),
      bsl: Number(shared.bsl || live.bsl || nearest("BSL")?.price || 0) || null,
      ssl: Number(shared.ssl || live.ssl || nearest("SSL")?.price || 0) || null,
      setup: live.setup || live.bestSetup || shared.setup || payload.setup || market.active_and_recent_setups?.[0] || null,
      direction: clean(live.directionDecision?.signal || live.directionDecision?.bias || shared.direction || shared.bias || live.hypothesis?.direction || "WAIT").toUpperCase()
    };
  }

  function priceText(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "—";
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(number));
  }

  function staleReply(snapshot) {
    return `Data Mapping ${snapshot.timeframe} sedang expired, jadi aku tidak akan memakai level lama. Jalankan ulang analisis Mapping dulu sampai statusnya fresh.`;
  }

  function levelReply(type, snapshot) {
    if (!snapshot.fresh) return staleReply(snapshot);
    const value = type === "BSL" ? snapshot.bsl : snapshot.ssl;
    if (!value) return `${type} aktif belum ditemukan pada snapshot ${snapshot.timeframe} terbaru.`;
    const relation = snapshot.price
      ? type === "BSL" ? `di atas harga ${priceText(snapshot.price)}` : `di bawah harga ${priceText(snapshot.price)}`
      : "";
    return `${type} aktif terdekat ada di ${priceText(value)}${relation ? `, ${relation}` : ""}.`;
  }

  function isMappingMenu(value) {
    return /^(mapping|ini tentang mapping|tentang mapping|cek mapping|mapping dulu|bahas mapping)$/.test(value);
  }

  function mappingTopic(value) {
    const hasBsl = /\bbsl\b|buy[ -]?side liquidity|likuiditas atas/.test(value);
    const hasSsl = /\bssl\b|sell[ -]?side liquidity|likuiditas bawah/.test(value);
    if (hasBsl && hasSsl) return "both";
    if (hasBsl) return "bsl";
    if (hasSsl) return "ssl";
    if (/setup|entry map|skenario/.test(value)) return "setup";
    if (/arah|bias|direction|bullish|bearish/.test(value)) return "direction";
    if (/harga|price/.test(value)) return "price";
    if (/fresh|expired|stale|status data|data mapping/.test(value)) return "freshness";
    return "";
  }

  function shouldHandle(question) {
    const value = lower(question);
    const session = readSession();
    if (!value) return false;
    if (/^(buka|masuk|pergi ke|arahkan ke)\s+mapping/.test(value)) return false;
    if (isMappingMenu(value)) return true;
    if (mappingTopic(value)) return true;
    return session.awaiting === "mapping_topic" || session.issueArea === "mapping";
  }

  function answer(question, context) {
    const value = lower(question);
    const snapshot = mappingSnapshot(context);
    const topic = mappingTopic(value);

    if (isMappingMenu(value)) {
      writeSession({ awaiting: "mapping_topic", issueArea: "mapping", lastIntent: "mapping-menu" });
      return "Siap. Di Mapping kamu mau cek BSL, SSL, arah market, setup aktif, harga, atau status datanya?";
    }

    if (topic === "bsl") {
      writeSession({ awaiting: "", issueArea: "mapping", lastIntent: "mapping-bsl" });
      return levelReply("BSL", snapshot);
    }
    if (topic === "ssl") {
      writeSession({ awaiting: "", issueArea: "mapping", lastIntent: "mapping-ssl" });
      return levelReply("SSL", snapshot);
    }
    if (topic === "both") {
      writeSession({ awaiting: "", issueArea: "mapping", lastIntent: "mapping-liquidity" });
      if (!snapshot.fresh) return staleReply(snapshot);
      return `BSL aktif terdekat ${snapshot.bsl ? priceText(snapshot.bsl) : "belum ada"}; SSL aktif terdekat ${snapshot.ssl ? priceText(snapshot.ssl) : "belum ada"}.`;
    }
    if (topic === "direction") {
      writeSession({ awaiting: "", issueArea: "mapping", lastIntent: "mapping-direction" });
      if (!snapshot.fresh) return staleReply(snapshot);
      return `Arah Mapping ${snapshot.timeframe} saat ini ${snapshot.direction || "WAIT"}.`;
    }
    if (topic === "setup") {
      writeSession({ awaiting: "", issueArea: "mapping", lastIntent: "mapping-setup" });
      if (!snapshot.fresh) return staleReply(snapshot);
      const state = clean(snapshot.setup?.state || snapshot.setup?.status || "WAIT").toUpperCase();
      return `Status setup Mapping ${snapshot.timeframe} saat ini ${state || "WAIT"}.`;
    }
    if (topic === "price") {
      writeSession({ awaiting: "", issueArea: "mapping", lastIntent: "mapping-price" });
      return snapshot.price ? `Harga XAU/USD terakhir ${priceText(snapshot.price)}.` : "Harga XAU/USD belum tersedia.";
    }
    if (topic === "freshness") {
      writeSession({ awaiting: "", issueArea: "mapping", lastIntent: "mapping-freshness" });
      return snapshot.fresh ? `Data Mapping ${snapshot.timeframe} masih fresh.` : staleReply(snapshot);
    }

    writeSession({ awaiting: "mapping_topic", issueArea: "mapping", lastIntent: "mapping-follow-up" });
    return "Di Mapping kamu mau cek BSL, SSL, arah market, setup aktif, harga, atau status datanya?";
  }

  function install() {
    const os = window.AmyFXOS;
    if (!os?.ask || !os?.__amySafeRuleChatV3 || os.__amyMappingIntentHotfixV1) return Boolean(os?.__amyMappingIntentHotfixV1);
    const originalAsk = os.ask.bind(os);
    const ask = async function (question, options = {}) {
      if (!shouldHandle(question)) return originalAsk(question, options);
      const sourceModule = options.sourceModule || currentModule();
      const context = options.context || await os.buildContext?.(sourceModule, { question });
      return {
        text: answer(question, context),
        provider: "amy-bot",
        model: "mapping-intent-hotfix-v1",
        source: "Amy Mapping",
        route: "bot",
        context
      };
    };
    window.AmyFXOS = Object.freeze({
      ...os,
      ask,
      mappingIntent: Object.freeze({ version: VERSION, answer, snapshot: mappingSnapshot }),
      __amyMappingIntentHotfixV1: true
    });
    window.dispatchEvent(new CustomEvent("amyfx:mapping-intent-ready", { detail: { version: VERSION } }));
    return true;
  }

  function boot() {
    if (install()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (install() || attempts >= 240) window.clearInterval(timer);
    }, 50);
    window.setTimeout(() => window.clearInterval(timer), 15_000);
    window.addEventListener("amyfx:safe-rule-chat-ready", install, { once: true });
  }

  window.AmyFXMappingIntentHotfix = Object.freeze({ version: VERSION, answer, snapshot: mappingSnapshot, install });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
