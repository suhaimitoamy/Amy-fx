"use strict";

(function () {
  if (window.__amyFxProfessionalMarketRepairV1) return;
  window.__amyFxProfessionalMarketRepairV1 = true;

  const VERSION = "1.0.0";
  const ZONE_KEY = "amyfx.bot.mapping.zones.v1";
  const INTEL_KEY = "amyfx.market.intel.v1";
  const MAX_LIVE_AGE_MS = 5 * 60 * 1000;
  const INACTIVE = /(SWEPT|CONSUMED|TOUCHED|TAKEN|MITIGATED|FILLED|INVALID|BROKEN|EXPIRED|HISTORICAL|INACTIVE|REPLACED)/i;

  const clean = value => String(value ?? "").trim();
  const lower = value => clean(value).toLowerCase().replace(/[^a-z0-9À-ÿ%./+\-\s]/gi, " ").replace(/\s+/g, " ").trim();

  function safeParse(value, fallback = null) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function readJson(key, fallback) {
    try { return safeParse(localStorage.getItem(key), fallback) ?? fallback; } catch { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function positiveNumber(value) {
    const parsed = number(value);
    return parsed !== null && parsed > 0 ? parsed : null;
  }

  function validTime(value) {
    const numeric = Number(value);
    const time = Number.isFinite(numeric) && numeric > 86_400_000 ? numeric : new Date(value || 0).getTime();
    return Number.isFinite(time) && time > 86_400_000 ? time : 0;
  }

  function latestTime(values) {
    const rows = values.map(validTime).filter(Boolean);
    return rows.length ? new Date(Math.max(...rows)).toISOString() : null;
  }

  function priceText(value) {
    const parsed = positiveNumber(value);
    return parsed ? new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(parsed) : "—";
  }

  function timeText(value) {
    const time = validTime(value);
    if (!time) return "waktu belum tersedia";
    try {
      return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Makassar",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date(time)) + " WITA";
    } catch {
      return new Date(time).toISOString();
    }
  }

  function intelState() {
    try {
      const state = window.AmyFXIntel?.read?.();
      if (state && typeof state === "object") return state;
    } catch {}
    if (window.AmyFXIntelState && typeof window.AmyFXIntelState === "object") return window.AmyFXIntelState;
    return readJson(INTEL_KEY, {});
  }

  function liveResult() {
    return window.AmyFXMarketState?.result || window.state?.result || window.lastMappingResult || null;
  }

  function partTimestamp(part) {
    const original = window.AmyFXIntel?.partTimestamp;
    try {
      const value = original?.(part);
      if (validTime(value)) return validTime(value);
    } catch {}
    return Math.max(
      validTime(part?.updated),
      validTime(part?.capturedAt),
      validTime(part?.captured_at),
      validTime(part?.analyzedAt),
      validTime(part?.storedAt)
    );
  }

  function partFresh(part) {
    const time = partTimestamp(part);
    const status = clean(part?.status || part?.statusText).toUpperCase();
    return Boolean(time && Date.now() - time <= MAX_LIVE_AGE_MS && !part?.dataStale && !/DATA USANG|STALE|EXPIRED|INVALID/.test(status));
  }

  function currentPrice(state = intelState()) {
    const values = [
      state?.liquidity?.currentPrice,
      state?.heatmap?.currentPrice,
      state?.mapping?.price,
      window.AmyFXMarketState?.price,
      window.state?.price,
      liveResult()?.price,
      localStorage.getItem("last_price")
    ].map(positiveNumber).filter(Boolean);
    return values[0] || null;
  }

  function levelActive(item) {
    const status = clean(item?.status || item?.state || "ACTIVE").toUpperCase();
    return item?.active !== false && !INACTIVE.test(status);
  }

  function normalizeLevel(item, type, price) {
    const level = positiveNumber(item?.price ?? item?.level ?? item?.value);
    if (!level || !levelActive(item)) return null;
    if (type === "BSL" && price && level <= price) return null;
    if (type === "SSL" && price && level >= price) return null;
    return {
      ...item,
      type,
      kind: type,
      price: level,
      distance: number(item?.distance ?? item?.distanceFromPrice) ?? (price ? level - price : 0),
      active: true,
      status: clean(item?.status || "ACTIVE").toUpperCase(),
      source: clean(item?.source || "Market Intel")
    };
  }

  function levelsFromPart(part, name, type, price) {
    if (!part || !partFresh(part)) return null;
    const rows = name === "heatmap"
      ? (Array.isArray(part.zones) ? part.zones.map(zone => ({ ...zone, type: zone.type || zone.liquidityType })) : [])
      : (Array.isArray(part.levels) ? part.levels : []);
    const candidates = rows
      .filter(item => clean(item?.type || item?.liquidityType).toUpperCase() === type)
      .map(item => normalizeLevel(item, type, price))
      .filter(Boolean)
      .sort((left, right) => Math.abs(left.distance) - Math.abs(right.distance));
    if (candidates[0]) return { ...candidates[0], sourceLabel: name === "liquidity" ? "Intel Liquidity nearest draw" : `${name} fallback` };
    const direct = normalizeLevel({ type, price: part?.[type.toLowerCase()], source: name }, type, price);
    return direct ? { ...direct, sourceLabel: `${name} fallback` } : null;
  }

  function canonicalNearestLevels(state = intelState()) {
    const price = currentPrice(state);
    const order = ["liquidity", "heatmap", "mapping"];
    const select = type => {
      for (const name of order) {
        const level = levelsFromPart(state?.[name], name, type, price);
        if (level) return level;
      }
      return null;
    };
    return { bsl: select("BSL"), ssl: select("SSL"), source: "Intel Liquidity → Heatmap → Mapping fallback" };
  }

  function patchIntel() {
    const intel = window.AmyFXIntel;
    if (!intel || intel.__amyCanonicalLiquidityRepairV1) return false;
    window.AmyFXIntel = {
      ...intel,
      nearestLevels: canonicalNearestLevels,
      __amyCanonicalLiquidityRepairV1: true
    };
    return true;
  }

  function normalizeZone(item, kind) {
    if (!item || typeof item !== "object") return null;
    let low = positiveNumber(item.bottom ?? item.low ?? item.min ?? item.zoneLow ?? item.priceLow ?? item.from);
    let high = positiveNumber(item.top ?? item.high ?? item.max ?? item.zoneHigh ?? item.priceHigh ?? item.to);
    const midpoint = positiveNumber(item.price ?? item.midpoint ?? item.mid ?? item.level ?? item.value);
    if (!low && midpoint) low = midpoint;
    if (!high && midpoint) high = midpoint;
    if (!low || !high) return null;
    if (low > high) [low, high] = [high, low];
    const status = clean(item.status || item.state || item.lifecycle || "ACTIVE").toUpperCase();
    if (item.active === false || INACTIVE.test(status)) return null;
    return {
      kind,
      type: clean(item.kind || item.type || item.zoneType || kind).toUpperCase(),
      low,
      high,
      midpoint: (low + high) / 2,
      direction: clean(item.direction || item.side || item.bias).toUpperCase(),
      timeframe: clean(item.timeframe || item.tf || "M15").toUpperCase(),
      status: status || "ACTIVE",
      source: clean(item.source || "Mapping engine"),
      updatedAt: latestTime([item.updatedAt, item.updated, item.capturedAt, item.timestamp])
    };
  }

  function flatten(values) {
    return values.flatMap(value => Array.isArray(value) ? value : value ? [value] : []);
  }

  function dedupeZones(rows) {
    const map = new Map();
    rows.filter(Boolean).forEach(row => {
      const key = `${row.kind}:${row.low.toFixed(3)}:${row.high.toFixed(3)}`;
      if (!map.has(key)) map.set(key, row);
    });
    return [...map.values()];
  }

  function zonesFromResult(result, kind) {
    const concepts = result?.marketConcepts || {};
    const mappingZones = result?.mappingZones || concepts?.mappingZones || {};
    const values = kind === "FVG" ? [
      concepts.nearestFairValueGaps,
      concepts.fairValueGaps,
      mappingZones.nearestFairValueGaps,
      mappingZones.allFairValueGaps,
      result?.nearestFairValueGaps,
      result?.fairValueGaps,
      result?.fvgs,
      result?.nearFvg,
      result?.nearFVG
    ] : [
      concepts.nearestOrderBlocks,
      concepts.orderBlocks,
      mappingZones.nearestOrderBlocks,
      mappingZones.allOrderBlocks,
      result?.nearestOrderBlocks,
      result?.orderBlocks,
      result?.obs,
      result?.nearOb,
      result?.nearOB
    ];
    return dedupeZones(flatten(values).map(item => normalizeZone(item, kind)));
  }

  function distanceToZone(zone, price) {
    if (!price) return 0;
    if (price >= zone.low && price <= zone.high) return 0;
    return Math.min(Math.abs(price - zone.low), Math.abs(price - zone.high));
  }

  function nearestZone(rows, price) {
    return [...rows].sort((left, right) => distanceToZone(left, price) - distanceToZone(right, price))[0] || null;
  }

  function publishZones() {
    const result = liveResult();
    if (!result || typeof result !== "object") return readJson(ZONE_KEY, {});
    const price = currentPrice();
    const fvgRows = zonesFromResult(result, "FVG");
    const obRows = zonesFromResult(result, "OB");
    if (!fvgRows.length && !obRows.length) return readJson(ZONE_KEY, {});
    const capturedAt = latestTime([
      result.capturedAt,
      result.captured_at,
      result.updatedAt,
      result.timestamp,
      window.AmyFXMarketState?.capturedAt,
      Date.now()
    ]);
    const snapshot = {
      schema: "AmyFXBotMappingZonesV1",
      schemaVersion: 1,
      capturedAt,
      storedAt: new Date().toISOString(),
      price,
      fvg: nearestZone(fvgRows, price),
      ob: nearestZone(obRows, price),
      zones: { FVG: fvgRows.slice(0, 20), OB: obRows.slice(0, 20) }
    };
    writeJson(ZONE_KEY, snapshot);
    window.AmyFXBotMappingZoneState = Object.freeze(snapshot);
    return snapshot;
  }

  function zoneSnapshot() {
    const live = publishZones();
    if (live?.schema) return live;
    return readJson(ZONE_KEY, {});
  }

  function zoneAnswer(kind) {
    const snapshot = zoneSnapshot();
    const zone = kind === "FVG" ? snapshot?.fvg : snapshot?.ob;
    const label = kind === "FVG" ? "FVG" : "Order Block";
    if (!zone) return `${label} aktif belum ditemukan pada output Mapping engine terbaru. Sumber: Mapping engine • ${timeText(snapshot?.capturedAt)}.`;
    const direction = zone.direction && !/NEUTRAL|WAIT/.test(zone.direction) ? ` ${zone.direction}` : "";
    return `${label} aktif terdekat berada di area ${priceText(zone.low)}–${priceText(zone.high)}${direction}. Sumber: Mapping engine · ${zone.source || kind} • ${timeText(snapshot.capturedAt)}.`;
  }

  function classify(question) {
    const value = lower(question);
    if (/\b(fvg|fair value gap)\b/.test(value)) return "FVG";
    if (/\b(order block|orderblock|ob)\b/.test(value)) return "OB";
    return "";
  }

  function answer(question) {
    const kind = classify(question);
    return kind ? zoneAnswer(kind) : null;
  }

  function syncCommandStrips() {
    patchIntel();
    const levels = canonicalNearestLevels();
    document.querySelectorAll?.(".amy-command-strip").forEach(strip => {
      strip.querySelectorAll?.(".amy-command-metric").forEach(metric => {
        const label = clean(metric.querySelector?.("small")?.textContent).toUpperCase();
        const value = metric.querySelector?.("b");
        if (!value) return;
        if (label === "BSL") value.textContent = levels.bsl ? Number(levels.bsl.price).toFixed(2) : "--";
        if (label === "SSL") value.textContent = levels.ssl ? Number(levels.ssl.price).toFixed(2) : "--";
      });
    });
  }

  function boot() {
    patchIntel();
    publishZones();
    syncCommandStrips();
    ["amyfx:mapping-state-change", "amyfx:market-update", "amyfx:candles-updated", "focus"].forEach(name => {
      window.addEventListener(name, () => {
        patchIntel();
        publishZones();
        syncCommandStrips();
      });
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        patchIntel();
        publishZones();
        syncCommandStrips();
      }
    });
    window.setInterval(() => {
      if (!document.hidden) {
        patchIntel();
        publishZones();
        syncCommandStrips();
      }
    }, 1_500);
  }

  window.AmyFXProfessionalMarketRepair = Object.freeze({
    version: VERSION,
    answer,
    classify,
    zones: zoneSnapshot,
    publishZones,
    nearestLevels: canonicalNearestLevels,
    patchIntel,
    syncCommandStrips,
    zoneKey: ZONE_KEY
  });

  window.dispatchEvent(new CustomEvent("amyfx:professional-market-repair-ready", { detail: { version: VERSION } }));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();