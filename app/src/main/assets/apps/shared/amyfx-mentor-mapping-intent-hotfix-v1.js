"use strict";

(function () {
  if (window.__amyFxMentorMappingIntentHotfixV1) return;
  window.__amyFxMentorMappingIntentHotfixV1 = true;

  const VERSION = "2.0.0";
  const SESSION_KEY = "amyfx.mentor.safeRuleChat.v3";
  const SNAPSHOT_KEY = "amyfx.mapping.snapshot.v2";
  const JOURNAL_DB = "tradingLibraryManager.files";
  const JOURNAL_STORE = "metadata";
  const JOURNAL_RECORD = "journals.v2";
  const LEGACY_JOURNAL_KEY = "tradingLibraryManager.journals.v1";
  const TTL_MS = Object.freeze({ M1: 300_000, M5: 900_000, M15: 1_800_000, H1: 10_800_000, H4: 43_200_000, D1: 259_200_000 });
  const INACTIVE_STATUS = /(SWEPT|CONSUMED|TOUCHED|TAKEN|MITIGATED|FILLED|INVALID|BROKEN|EXPIRED|HISTORICAL|INACTIVE|REPLACED)/i;
  const NON_MAPPING = /\b(jurnal|journal|academy|belajar|materi|api|gemini|openrouter|deepseek|berita|news|heatmap|profil|update|versi|library|koleksi)\b/i;
  const clean = value => String(value ?? "").trim();
  const lower = value => clean(value).toLowerCase().replace(/\s+/g, " ");

  function safeParse(value, fallback = null) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
  }

  function readJson(key, fallback) {
    try { return safeParse(localStorage.getItem(key), fallback) ?? fallback; } catch { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
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

  function validTime(value) {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) && time > 86_400_000 ? time : 0;
  }

  function firstTime(values) {
    const rows = values.map(validTime).filter(Boolean);
    return rows.length ? new Date(Math.max(...rows)).toISOString() : null;
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function priceText(value) {
    const parsed = number(value);
    return parsed ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(parsed)) : "—";
  }

  function rangeText(row) {
    if (!row) return "—";
    if (number(row.low) && number(row.high) && Math.abs(row.high - row.low) > 0.0001) return `${priceText(row.low)}–${priceText(row.high)}`;
    return priceText(row.price || row.low || row.high);
  }

  function pathValue(source, path) {
    return path.split(".").reduce((value, key) => value?.[key], source);
  }

  function valuesAt(sources, paths) {
    const values = [];
    sources.forEach(source => paths.forEach(path => {
      const value = pathValue(source, path);
      if (value !== undefined && value !== null) values.push(value);
    }));
    return values;
  }

  function arraysAt(sources, paths) {
    return valuesAt(sources, paths).filter(Array.isArray).flat();
  }

  function normalizeStatus(item, kind) {
    if (item?.invalid === true || item?.broken === true) return "INVALID";
    if (item?.swept === true || item?.consumed === true || item?.touched === true || item?.taken === true) return "CONSUMED";
    if (item?.mitigated === true || item?.filled === true) return kind === "BSL" || kind === "SSL" ? "CONSUMED" : "MITIGATED";
    const raw = clean(item?.status || item?.state || item?.lifecycle || item?.validity || "ACTIVE").toUpperCase();
    if (/SWEPT|CONSUMED|TOUCHED|TAKEN/.test(raw)) return "CONSUMED";
    if (/MITIGATED|FILLED/.test(raw)) return kind === "BSL" || kind === "SSL" ? "CONSUMED" : "MITIGATED";
    if (/INVALID|BROKEN|EXPIRED|HISTORICAL|INACTIVE/.test(raw)) return "INVALID";
    if (/REPLACED/.test(raw)) return "REPLACED";
    return item?.active === false ? "INACTIVE" : "ACTIVE";
  }

  function statusWeight(status) {
    return ({ ACTIVE: 1, REPLACED: 2, INACTIVE: 3, MITIGATED: 4, CONSUMED: 5, INVALID: 6 })[status] || 1;
  }

  function normalizeLevel(item, typeHint = "") {
    const type = clean(item?.type || item?.liquidityType || item?.kind || typeHint).toUpperCase();
    if (!/^(BSL|SSL)$/.test(type)) return null;
    const price = number(item?.price ?? item?.level ?? item?.value ?? item?.y);
    if (!price) return null;
    const status = normalizeStatus(item, type);
    return {
      kind: type,
      type,
      price,
      low: price,
      high: price,
      status,
      active: status === "ACTIVE" && item?.active !== false,
      strength: Number(item?.strength ?? item?.score) || null,
      updatedAt: firstTime([item?.updatedAt, item?.updated_at, item?.capturedAt, item?.timestamp]),
      source: clean(item?.source || "mapping")
    };
  }

  function normalizeZone(item, kind) {
    let low = number(item?.low ?? item?.bottom ?? item?.min ?? item?.zoneLow ?? item?.priceLow ?? item?.from);
    let high = number(item?.high ?? item?.top ?? item?.max ?? item?.zoneHigh ?? item?.priceHigh ?? item?.to);
    const price = number(item?.price ?? item?.level ?? item?.midpoint ?? item?.mid ?? item?.value);
    if (!low && price) low = price;
    if (!high && price) high = price;
    if (!low || !high) return null;
    if (low > high) [low, high] = [high, low];
    const status = normalizeStatus(item, kind);
    return {
      kind,
      type: clean(item?.type || item?.zoneType || kind).toUpperCase(),
      low,
      high,
      price: price || (low + high) / 2,
      status,
      active: status === "ACTIVE" && item?.active !== false,
      side: clean(item?.side || item?.direction || item?.bias).toUpperCase(),
      timeframe: clean(item?.timeframe || item?.tf).toUpperCase(),
      updatedAt: firstTime([item?.updatedAt, item?.updated_at, item?.capturedAt, item?.timestamp]),
      source: clean(item?.source || "mapping")
    };
  }

  function dedupe(rows) {
    const map = new Map();
    rows.filter(Boolean).forEach(row => {
      const key = row.kind === "BSL" || row.kind === "SSL"
        ? `${row.kind}:${row.price.toFixed(3)}`
        : `${row.kind}:${row.low.toFixed(3)}:${row.high.toFixed(3)}`;
      const previous = map.get(key);
      if (!previous) { map.set(key, row); return; }
      const previousTime = validTime(previous.updatedAt);
      const nextTime = validTime(row.updatedAt);
      if (nextTime > previousTime + 1000 || (nextTime === previousTime && statusWeight(row.status) >= statusWeight(previous.status))) map.set(key, row);
    });
    return [...map.values()];
  }

  function normalizeDirection(value) {
    const raw = clean(value).toUpperCase();
    if (!raw) return "";
    if (/BULL|BUY|UPTREND|UPWARD|NAIK/.test(raw)) return "BULLISH";
    if (/BEAR|SELL|DOWNTREND|DOWNWARD|TURUN/.test(raw)) return "BEARISH";
    if (/NO CLEAR|NEUTRAL|SIDEWAYS|RANGE|WAIT|MIXED/.test(raw)) return "NO CLEAR DIRECTION";
    return raw;
  }

  function sourcesFrom(context) {
    const workspace = context?.payload?.workspace || {};
    const market = workspace.market || {};
    const intel = market.shared_intelligence || window.AmyFXIntel?.read?.() || window.AmyFXIntelState || readJson("amyfx.market.intel.v1", {});
    const shared = intel?.mapping || {};
    const live = market.live_state || window.AmyFXMarketState || window.lastMappingResult || {};
    const result = live?.result || window.AmyFXMarketState?.result || window.lastMappingResult || {};
    const persisted = readJson(SNAPSHOT_KEY, {});
    const analyses = Array.isArray(market.recent_analyses) ? market.recent_analyses : readJson("amy_mapping_analyses", []);
    const latestAnalysis = Array.isArray(analyses) ? analyses[0] || analyses.at?.(-1) || {} : {};
    const embedded = market.mapping_snapshot || market.mapping || null;
    return [shared, latestAnalysis, result, live, context?.payload || {}, embedded, persisted]
      .filter(value => value && typeof value === "object");
  }

  function collectLevels(sources) {
    const paths = [
      "levels", "liquidityLevels", "liquidity.levels", "validatedMarketContext.liquidityLevels",
      "result.levels", "result.liquidityLevels", "result.liquidity.levels", "result.validatedMarketContext.liquidityLevels",
      "components.liquidity", "mapping.levels"
    ];
    const rows = arraysAt(sources, paths).map(item => normalizeLevel(item));
    sources.forEach(source => {
      ["BSL", "SSL"].forEach(type => {
        const direct = number(source?.[type.toLowerCase()] ?? source?.[`active${type}`] ?? source?.[`next${type}`]);
        if (direct) rows.push(normalizeLevel({ type, price: direct, status: "ACTIVE", source: "direct" }, type));
      });
    });
    return dedupe(rows);
  }

  function collectZones(sources, kind) {
    const paths = kind === "OB"
      ? ["orderBlocks", "order_blocks", "obs", "obZones", "zones.orderBlocks", "zones.OB", "validatedMarketContext.orderBlocks", "result.orderBlocks", "components.orderBlocks", "components.ob"]
      : kind === "FVG"
        ? ["fairValueGaps", "fair_value_gaps", "fvgs", "fvgZones", "zones.fvg", "zones.FVG", "validatedMarketContext.fairValueGaps", "result.fvgs", "components.fvgs", "components.fvg"]
        : ["supplyDemandZones", "supply_demand_zones", "supplyDemand", "sndZones", "zones.supplyDemand", "zones.SND", "validatedMarketContext.supplyDemandZones", "result.supplyDemandZones", "components.supplyDemand", "components.snd"];
    return dedupe(arraysAt(sources, paths).map(item => normalizeZone(item, kind)));
  }

  function activeLevel(rows, type, price) {
    const active = rows.filter(row => row.kind === type && row.active && !INACTIVE_STATUS.test(row.status));
    const directional = price ? active.filter(row => type === "BSL" ? row.price > price : row.price < price) : active;
    const candidates = price ? directional : active;
    return candidates.sort((left, right) => {
      if (!price) return type === "BSL" ? left.price - right.price : right.price - left.price;
      return Math.abs(left.price - price) - Math.abs(right.price - price);
    })[0] || null;
  }

  function inactiveLevel(rows, type, active, price) {
    const inactive = rows.filter(row => row.kind === type && (!row.active || INACTIVE_STATUS.test(row.status)));
    const relevant = inactive.filter(row => {
      if (!active || !price) return true;
      return type === "BSL" ? row.price > price && row.price < active.price : row.price < price && row.price > active.price;
    });
    return (relevant.length ? relevant : inactive).sort((left, right) => {
      const timeDiff = validTime(right.updatedAt) - validTime(left.updatedAt);
      return timeDiff || (price ? Math.abs(left.price - price) - Math.abs(right.price - price) : 0);
    })[0] || null;
  }

  function activeZone(rows, price) {
    return rows.filter(row => row.active && !INACTIVE_STATUS.test(row.status)).sort((left, right) => {
      if (!price) return validTime(right.updatedAt) - validTime(left.updatedAt);
      return Math.abs(left.price - price) - Math.abs(right.price - price);
    })[0] || null;
  }

  function inactiveZone(rows, price) {
    return rows.filter(row => !row.active || INACTIVE_STATUS.test(row.status)).sort((left, right) => {
      const timeDiff = validTime(right.updatedAt) - validTime(left.updatedAt);
      return timeDiff || (price ? Math.abs(left.price - price) - Math.abs(right.price - price) : 0);
    })[0] || null;
  }

  function firstText(sources, paths) {
    for (const value of valuesAt(sources, paths)) {
      const normalized = normalizeDirection(value);
      if (normalized) return normalized;
    }
    return "";
  }

  function firstObject(sources, paths) {
    return valuesAt(sources, paths).find(value => value && typeof value === "object") || null;
  }

  function compactSnapshot(snapshot) {
    return {
      schema: "AmyFXMappingSnapshotV2",
      schemaVersion: 2,
      pair: snapshot.pair,
      timeframe: snapshot.timeframe,
      capturedAt: snapshot.capturedAt,
      storedAt: new Date().toISOString(),
      price: snapshot.price,
      quoteFresh: snapshot.quoteFresh,
      structuralValid: snapshot.structuralValid,
      direction: snapshot.direction,
      higherTimeframeDirection: snapshot.higherTimeframeDirection,
      structure: snapshot.structure,
      setup: clone(snapshot.setup),
      invalidation: clone(snapshot.invalidation),
      targets: clone(snapshot.targets),
      levels: clone(snapshot.levels.slice(0, 100)),
      zones: {
        OB: clone(snapshot.zones.OB.slice(0, 30)),
        FVG: clone(snapshot.zones.FVG.slice(0, 30)),
        SND: clone(snapshot.zones.SND.slice(0, 30))
      }
    };
  }

  function mappingSnapshot(context, options = {}) {
    const sources = sourcesFrom(context);
    const price = valuesAt(sources, ["price", "current_price", "currentPrice", "marketPrice", "close"]).map(number).find(Boolean)
      || number(localStorage.getItem("last_price"));
    const timeframe = clean(valuesAt(sources, ["timeframe", "tf", "mapping.timeframe"])[0] || "M15").toUpperCase();
    const capturedAt = firstTime(valuesAt(sources, ["capturedAt", "captured_at", "updatedAt", "updated", "timestamp"]));
    const levels = collectLevels(sources);
    const zones = { OB: collectZones(sources, "OB"), FVG: collectZones(sources, "FVG"), SND: collectZones(sources, "SND") };
    const direction = firstText(sources, [
      "directionDecision.signal", "directionDecision.bias", "direction", "bias", "hypothesis.direction", "hypothesis.bias",
      "validatedMarketContext.directionForecast.signal", "validatedMarketContext.directionForecast.bias", "result.directionDecision.signal"
    ]);
    const higherTimeframeDirection = firstText(sources, [
      "higherTimeframeDirection", "higherTimeframeBias", "htfDirection", "htfBias", "topDownBias",
      "multiTimeframe.H4.bias", "multiTimeframe.H1.bias", "mtf.H4.bias", "mtf.H1.bias",
      "validatedMarketContext.higherTimeframeBias", "directionDecision.higherTimeframeBias"
    ]);
    const setup = firstObject(sources, ["setup", "bestSetup", "setupExecution", "experimentalBestSetup", "entryMap.setup"]);
    const structure = valuesAt(sources, ["structure", "marketStructure", "validatedMarketContext.structure", "facts.structure"])[0] || null;
    const invalidation = valuesAt(sources, ["invalidation", "setup.invalidation", "bestSetup.invalidation", "setupExecution.invalidation", "invalidLevel"])[0] || null;
    const targets = valuesAt(sources, ["targets", "target", "setup.targets", "bestSetup.targets", "setupExecution.targets"])[0] || null;
    const age = capturedAt ? Math.max(0, Date.now() - validTime(capturedAt)) : Number.MAX_SAFE_INTEGER;
    const quoteFresh = Boolean(capturedAt) && age <= (TTL_MS[timeframe] || TTL_MS.M15);
    const structuralValid = Boolean(levels.some(row => row.active) || zones.OB.some(row => row.active) || zones.FVG.some(row => row.active) || zones.SND.some(row => row.active) || direction || higherTimeframeDirection || setup);
    const snapshot = {
      pair: "XAU/USD",
      timeframe,
      capturedAt,
      price,
      quoteFresh,
      structuralValid,
      direction: direction || "NO CLEAR DIRECTION",
      higherTimeframeDirection: higherTimeframeDirection || "",
      structure,
      setup,
      invalidation,
      targets,
      levels,
      zones
    };
    snapshot.bsl = activeLevel(levels, "BSL", price);
    snapshot.ssl = activeLevel(levels, "SSL", price);
    snapshot.previousBsl = inactiveLevel(levels, "BSL", snapshot.bsl, price);
    snapshot.previousSsl = inactiveLevel(levels, "SSL", snapshot.ssl, price);
    snapshot.activeOb = activeZone(zones.OB, price);
    snapshot.previousOb = inactiveZone(zones.OB, price);
    snapshot.activeFvg = activeZone(zones.FVG, price);
    snapshot.previousFvg = inactiveZone(zones.FVG, price);
    snapshot.activeSnd = activeZone(zones.SND, price);
    snapshot.previousSnd = inactiveZone(zones.SND, price);

    const shouldPersist = options.persist !== false && structuralValid && (currentModule() === "mapping" || Boolean(window.AmyFXMarketState?.capturedAt));
    if (shouldPersist) {
      const stored = compactSnapshot(snapshot);
      writeJson(SNAPSHOT_KEY, stored);
      window.AmyFXMappingSnapshotV2 = Object.freeze(stored);
    }
    return snapshot;
  }

  function inactivePhrase(row, liquidity = false) {
    if (!row) return "";
    if (/CONSUMED/.test(row.status)) return liquidity ? "sudah tersapu" : "sudah digunakan";
    if (/MITIGATED/.test(row.status)) return "sudah termitigasi";
    if (/REPLACED/.test(row.status)) return "sudah digantikan";
    return "sudah invalid";
  }

  function levelReply(type, snapshot) {
    const active = type === "BSL" ? snapshot.bsl : snapshot.ssl;
    const previous = type === "BSL" ? snapshot.previousBsl : snapshot.previousSsl;
    if (active && previous) return `${type} ${priceText(previous.price)} ${inactivePhrase(previous, true)} dan tidak lagi menjadi acuan. ${type} aktif berikutnya berada di ${priceText(active.price)}.`;
    if (active) return `${type} aktif terdekat berada di ${priceText(active.price)}.`;
    if (previous) return `${type} terakhir ${priceText(previous.price)} ${inactivePhrase(previous, true)}. ${type} aktif berikutnya belum ditemukan.`;
    return `${type} aktif belum ditemukan pada data Mapping terakhir.`;
  }

  function zoneReply(kind, label, snapshot) {
    const active = kind === "OB" ? snapshot.activeOb : kind === "FVG" ? snapshot.activeFvg : snapshot.activeSnd;
    const previous = kind === "OB" ? snapshot.previousOb : kind === "FVG" ? snapshot.previousFvg : snapshot.previousSnd;
    if (active && previous) return `${label} ${rangeText(previous)} ${inactivePhrase(previous)} dan tidak lagi menjadi acuan. ${label} aktif berikutnya berada di area ${rangeText(active)}.`;
    if (active) return `${label} aktif terdekat berada di area ${rangeText(active)}.`;
    if (previous) return `${label} terakhir ${rangeText(previous)} ${inactivePhrase(previous)}. ${label} aktif berikutnya belum ditemukan.`;
    return `${label} aktif belum ditemukan pada data Mapping terakhir.`;
  }

  function mappingTopic(value) {
    const hasBsl = /\bbsl\b|buy[ -]?side liquidity|likuiditas atas/.test(value);
    const hasSsl = /\bssl\b|sell[ -]?side liquidity|likuiditas bawah/.test(value);
    if (hasBsl && hasSsl) return "both";
    if (hasBsl) return "bsl";
    if (hasSsl) return "ssl";
    if (/\b(order block|ob)\b/.test(value)) return "ob";
    if (/\b(fvg|fair value gap)\b/.test(value)) return "fvg";
    if (/\b(snd|supply demand|supply|demand)\b/.test(value)) return "snd";
    if (/arah market (besar|besarnya)|arah besar|bias besar|htf|higher timeframe|timeframe besar/.test(value)) return "direction-large";
    if (/arah|bias|direction|bullish|bearish/.test(value)) return "direction";
    if (/struktur|structure|mss|bos|choch/.test(value)) return "structure";
    if (/invalidasi|invalidation/.test(value)) return "invalidation";
    if (/target|tp|draw on liquidity|dol/.test(value)) return "target";
    if (/setup|entry map|skenario/.test(value)) return "setup";
    if (/harga|price/.test(value)) return "price";
    if (/fresh|expired|stale|status data|data mapping/.test(value)) return "freshness";
    if (/rangkum|ringkas|hasil mapping|kondisi market|status market|market sekarang/.test(value)) return "summary";
    return "";
  }

  function isMappingMenu(value) {
    return /^(mapping|ini tentang mapping|tentang mapping|cek mapping|mapping dulu|bahas mapping)$/.test(value);
  }

  function shouldHandle(question) {
    const value = lower(question);
    if (!value) return false;
    if (/^(buka|masuk|pergi ke|arahkan ke)\s+mapping/.test(value)) return false;
    if (NON_MAPPING.test(value) && !/mapping|bsl|ssl|order block|\bob\b|fvg|snd|arah market|harga xau/.test(value)) {
      writeSession({ awaiting: "", issueArea: "", lastIntent: "other-module" });
      return false;
    }
    if (isMappingMenu(value) || mappingTopic(value)) return true;
    const session = readSession();
    return session.awaiting === "mapping_topic" && /^(bsl|ssl|ob|fvg|snd|arah|arah besar|setup|harga|freshness|struktur|invalidasi|target)$/.test(value);
  }

  function mappingSummary(snapshot) {
    const direction = snapshot.direction === "NO CLEAR DIRECTION" && snapshot.higherTimeframeDirection
      ? `M15 belum jelas, tetapi arah besarnya ${snapshot.higherTimeframeDirection}`
      : snapshot.direction;
    const liquidity = `BSL ${snapshot.bsl ? priceText(snapshot.bsl.price) : "belum ada"} dan SSL ${snapshot.ssl ? priceText(snapshot.ssl.price) : "belum ada"}`;
    const extras = [snapshot.activeOb ? `OB ${rangeText(snapshot.activeOb)}` : "", snapshot.activeFvg ? `FVG ${rangeText(snapshot.activeFvg)}` : "", snapshot.activeSnd ? `SND ${rangeText(snapshot.activeSnd)}` : ""].filter(Boolean).join(", ");
    return `Arah Mapping ${snapshot.timeframe}: ${direction || "belum terbaca"}. ${liquidity}.${extras ? ` Area aktif lainnya: ${extras}.` : ""}`;
  }

  function answer(question, context) {
    const value = lower(question);
    if (/^(halo|hai|hello|pagi|siang|sore|malam|tes|test|permisi)$/.test(value)) return greeting();
    const snapshot = mappingSnapshot(context);
    const topic = mappingTopic(value);

    if (isMappingMenu(value)) {
      writeSession({ awaiting: "mapping_topic", issueArea: "mapping", lastIntent: "mapping-menu" });
      return "Di Mapping kamu mau cek BSL, SSL, OB, FVG, SND, struktur, arah market, setup, invalidasi, target, harga, atau status datanya?";
    }

    writeSession({ awaiting: "", issueArea: "", lastIntent: topic ? `mapping-${topic}` : "mapping-summary" });
    if (topic === "bsl") return levelReply("BSL", snapshot);
    if (topic === "ssl") return levelReply("SSL", snapshot);
    if (topic === "both") return `${levelReply("BSL", snapshot)} ${levelReply("SSL", snapshot)}`;
    if (topic === "ob") return zoneReply("OB", "OB", snapshot);
    if (topic === "fvg") return zoneReply("FVG", "FVG", snapshot);
    if (topic === "snd") return zoneReply("SND", "SND", snapshot);
    if (topic === "direction-large") {
      if (snapshot.higherTimeframeDirection) return `Arah market besarnya saat ini ${snapshot.higherTimeframeDirection}. Arah ${snapshot.timeframe} ${snapshot.direction}.`;
      return `Arah timeframe besar belum tersedia. Arah ${snapshot.timeframe} terakhir ${snapshot.direction}.`;
    }
    if (topic === "direction") {
      if (snapshot.direction === "NO CLEAR DIRECTION" && snapshot.higherTimeframeDirection) return `Arah ${snapshot.timeframe} saat ini belum jelas, tetapi arah market besarnya masih ${snapshot.higherTimeframeDirection}.`;
      return `Arah Mapping ${snapshot.timeframe} saat ini ${snapshot.direction || "belum terbaca"}.`;
    }
    if (topic === "structure") return snapshot.structure ? `Struktur market saat ini ${clean(typeof snapshot.structure === "string" ? snapshot.structure : snapshot.structure?.state || snapshot.structure?.trend || JSON.stringify(snapshot.structure))}.` : "Struktur market belum tersedia pada data Mapping terakhir.";
    if (topic === "setup") {
      const state = clean(snapshot.setup?.state || snapshot.setup?.status || snapshot.setup?.signal || "WAIT").toUpperCase();
      return `Status setup Mapping ${snapshot.timeframe} saat ini ${state}.`;
    }
    if (topic === "invalidation") return snapshot.invalidation ? `Invalidasi setup saat ini berada di ${typeof snapshot.invalidation === "number" ? priceText(snapshot.invalidation) : clean(snapshot.invalidation?.price ? priceText(snapshot.invalidation.price) : JSON.stringify(snapshot.invalidation))}.` : "Invalidasi setup belum tersedia pada data Mapping terakhir.";
    if (topic === "target") return snapshot.targets ? `Target Mapping saat ini ${clean(Array.isArray(snapshot.targets) ? snapshot.targets.map(item => typeof item === "number" ? priceText(item) : priceText(item?.price || item?.level) || clean(item)).join(", ") : typeof snapshot.targets === "number" ? priceText(snapshot.targets) : JSON.stringify(snapshot.targets))}.` : "Target Mapping belum tersedia pada data terakhir.";
    if (topic === "price") return snapshot.price ? `Harga XAU/USD terakhir ${priceText(snapshot.price)}${snapshot.quoteFresh ? "." : ". Harga live perlu diperbarui."}` : "Harga XAU/USD belum tersedia.";
    if (topic === "freshness") return snapshot.quoteFresh
      ? `Harga live ${snapshot.timeframe} masih fresh. Level Mapping tetap berlaku sampai tersapu, termitigasi, digantikan, atau invalid.`
      : `Harga live ${snapshot.timeframe} perlu diperbarui, tetapi level Mapping tidak otomatis expired. Level tetap berlaku sampai tersapu, termitigasi, digantikan, atau invalid.`;
    return mappingSummary(snapshot);
  }

  function greeting() {
    let hour = new Date().getHours();
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Makassar", hour: "2-digit", hour12: false }).formatToParts(new Date());
      hour = Number(parts.find(part => part.type === "hour")?.value || hour);
    } catch {}
    const period = hour < 11 ? "pagi" : hour < 15 ? "siang" : hour < 19 ? "sore" : "malam";
    return `Hai, selamat ${period}. Aku Amy, asisten Anda. Ada yang bisa kubantu?`;
  }

  function enrichContext(context) {
    const snapshot = compactSnapshot(mappingSnapshot(context));
    const base = context && typeof context === "object" ? context : {};
    const workspace = base?.payload?.workspace || {};
    return {
      ...base,
      payload: {
        ...(base.payload || {}),
        workspace: {
          ...workspace,
          market: { ...(workspace.market || {}), mapping_snapshot: snapshot, mapping: snapshot }
        }
      }
    };
  }

  function install() {
    const os = window.AmyFXOS;
    if (!os?.ask || os.__amyMappingLifecycleV2) return Boolean(os?.__amyMappingLifecycleV2);
    const originalAsk = os.ask.bind(os);
    const originalBuild = typeof os.buildContext === "function" ? os.buildContext.bind(os) : null;

    const buildContext = async function (sourceModule = currentModule(), options = {}) {
      const base = originalBuild ? await originalBuild(sourceModule, options) : {};
      return enrichContext(base);
    };

    const ask = async function (question, options = {}) {
      const value = lower(question);
      if (/^(halo|hai|hello|pagi|siang|sore|malam|tes|test|permisi)$/.test(value)) {
        return { text: greeting(), provider: "amy-bot", model: "mapping-lifecycle-v2", source: "Amy", route: "bot", context: options.context || null };
      }
      if (!shouldHandle(question)) return originalAsk(question, options);
      const sourceModule = options.sourceModule || currentModule();
      const context = enrichContext(options.context || (originalBuild ? await originalBuild(sourceModule, { question }) : {}));
      return { text: answer(question, context), provider: "amy-bot", model: "mapping-lifecycle-v2", source: "Amy Mapping", route: "bot", context };
    };

    window.AmyFXOS = Object.freeze({
      ...os,
      buildContext,
      ask,
      mappingIntent: Object.freeze({ version: VERSION, answer, snapshot: mappingSnapshot }),
      __amyMappingIntentHotfixV1: true,
      __amyMappingLifecycleV2: true
    });
    window.dispatchEvent(new CustomEvent("amyfx:mapping-intent-ready", { detail: { version: VERSION } }));
    return true;
  }

  function repairWelcome() {
    const expected = greeting();
    const marked = document.querySelector("[data-amy-safe-welcome] > div");
    if (marked && marked.textContent !== expected) marked.textContent = expected;
    document.querySelectorAll(".amy-os-message--amy > div").forEach(node => {
      if (/Kamu bisa langsung menulis seperti sedang chat dengan customer service/i.test(node.textContent || "") && node.textContent !== expected) node.textContent = expected;
    });
  }

  function isProfileVisible() {
    const list = document.querySelector("#main-content .profile-list");
    const active = document.querySelector(".nav-btn[data-target='profil'].active");
    return Boolean(list && active);
  }

  function storedSnapshot() {
    return readJson(SNAPSHOT_KEY, {});
  }

  let journalPromise = null;
  function journalRows() {
    if (journalPromise) return journalPromise;
    journalPromise = new Promise(resolve => {
      const fallback = readJson(LEGACY_JOURNAL_KEY, []);
      if (!window.indexedDB) { resolve(Array.isArray(fallback) ? fallback : []); return; }
      let request;
      try { request = indexedDB.open(JOURNAL_DB); } catch { resolve(Array.isArray(fallback) ? fallback : []); return; }
      const finish = rows => resolve(Array.isArray(rows) ? rows : Array.isArray(fallback) ? fallback : []);
      request.onerror = () => finish(fallback);
      request.onupgradeneeded = () => { try { request.transaction?.abort(); } catch {} finish(fallback); };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(JOURNAL_STORE)) { db.close(); finish(fallback); return; }
        try {
          const tx = db.transaction(JOURNAL_STORE, "readonly");
          const get = tx.objectStore(JOURNAL_STORE).get(JOURNAL_RECORD);
          get.onsuccess = () => { const rows = get.result?.value; db.close(); finish(rows); };
          get.onerror = () => { db.close(); finish(fallback); };
        } catch { db.close(); finish(fallback); }
      };
      setTimeout(() => finish(fallback), 2500);
    });
    return journalPromise;
  }

  function journalMetrics(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const result = item => lower(item?.result);
    const win = list.filter(item => result(item) === "win").length;
    const loss = list.filter(item => result(item) === "loss").length;
    const be = list.filter(item => /^(be|break even|breakeven)$/.test(result(item))).length;
    const completed = win + loss + be;
    return { total: list.length, winRate: completed ? Math.round((win / completed) * 1000) / 10 : null };
  }

  function keyCount() {
    const settings = window.AmyFXOS?.getGlobalSettings?.() || readJson("amyfx.globalAiSettings.v1", {});
    return Array.isArray(settings?.key_refs) ? settings.key_refs.filter(row => row?.status !== "disabled").length : 0;
  }

  async function repairCommandCenter() {
    const section = document.querySelector("[data-amy-command-center]");
    if (!section) return;
    const profile = isProfileVisible();
    section.hidden = !profile;
    if (!profile) return;
    const list = document.querySelector("#main-content .profile-list");
    if (list && section.nextElementSibling !== list) list.insertAdjacentElement("beforebegin", section);

    const snapshot = storedSnapshot();
    const hasMapping = Boolean(snapshot?.structuralValid || snapshot?.levels?.some?.(row => row.active) || snapshot?.direction);
    const time = section.querySelector("[data-cc-time]");
    if (time) time.textContent = snapshot?.capturedAt ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", dateStyle: "medium", timeStyle: "short", hour12: false }).format(new Date(snapshot.capturedAt)) + " WITA" : "Belum ada data";
    const freshnessLabel = section.querySelector("[data-cc-freshness]")?.previousElementSibling;
    if (freshnessLabel) freshnessLabel.textContent = "Data Mapping";
    const freshness = section.querySelector("[data-cc-freshness]");
    if (freshness) {
      freshness.textContent = hasMapping ? (snapshot.quoteFresh ? "DATA LIVE TERSEDIA" : "LEVEL AKTIF TERSEDIA") : "BELUM ADA DATA";
      const card = freshness.closest("[data-state]");
      if (card) card.dataset.state = hasMapping ? (snapshot.quoteFresh ? "fresh" : "stale") : "missing";
    }

    const rows = await journalRows();
    const journal = journalMetrics(rows);
    const journalLabel = section.querySelector("[data-cc-journal]")?.previousElementSibling;
    if (journalLabel) journalLabel.textContent = "Jurnal Trading";
    const journalNode = section.querySelector("[data-cc-journal]");
    if (journalNode) journalNode.textContent = journal.total ? `${journal.total} trade${journal.winRate == null ? "" : ` • ${journal.winRate}% WR`}` : "Belum ada jurnal";

    const keys = keyCount();
    const mentor = section.querySelector("[data-cc-mentor]");
    if (mentor) mentor.textContent = keys ? `${keys} key siap` : "Belum ada key";
    const migrationLabel = section.querySelector("[data-cc-migration]")?.previousElementSibling;
    if (migrationLabel) migrationLabel.textContent = "Status sistem";
    const migration = section.querySelector("[data-cc-migration]");
    if (migration) migration.textContent = keys ? "API siap digunakan" : "Periksa pengaturan API";
  }

  function repairHealth() {
    const snapshot = storedSnapshot();
    const health = document.querySelector("[data-amy-health]");
    if (!health) return;
    const module = currentModule().toUpperCase();
    const hasMapping = Boolean(snapshot?.structuralValid || snapshot?.levels?.some?.(row => row.active));
    const next = hasMapping ? `${module} • DATA MAPPING TERSEDIA` : `${module} • BELUM ADA DATA MARKET`;
    if (/EXPIRED|BELUM ADA DATA LIVE|HOME •/i.test(health.textContent || "")) health.textContent = next;
  }

  let scheduled = false;
  function scheduleUiRepair() {
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      repairWelcome();
      repairHealth();
      repairCommandCenter();
      if (currentModule() === "mapping") mappingSnapshot(null, { persist: true });
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run); else setTimeout(run, 0);
  }

  function boot() {
    const installed = install();
    scheduleUiRepair();
    let attempts = 0;
    const timer = installed ? 0 : window.setInterval(() => {
      attempts += 1;
      const ready = install();
      scheduleUiRepair();
      if (ready || attempts >= 240) window.clearInterval(timer);
    }, 50);
    if (timer) window.setTimeout(() => window.clearInterval(timer), 15_000);
    window.addEventListener("amyfx:safe-rule-chat-ready", install, { once: true });
    ["amyfx:mapping-state-change", "amyfx:market-update", "amyfx:home-stats-change", "amyfx:open-mentor", "focus"]
      .forEach(name => window.addEventListener(name, scheduleUiRepair));
    window.addEventListener("amyfx:journal-state-change", () => {
      journalPromise = null;
      scheduleUiRepair();
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleUiRepair(); });
    const target = document.body || document.documentElement;
    if (target && typeof MutationObserver === "function") new MutationObserver(scheduleUiRepair).observe(target, { childList: true, subtree: true });
    window.setInterval(() => { if (!document.hidden) scheduleUiRepair(); }, 30_000);
  }

  window.AmyFXMappingIntentHotfix = Object.freeze({ version: VERSION, answer, snapshot: mappingSnapshot, install, greeting, scheduleUiRepair });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
