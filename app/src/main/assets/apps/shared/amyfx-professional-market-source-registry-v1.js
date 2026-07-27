"use strict";

(function () {
  if (window.__amyFxProfessionalMarketSourceRegistryV1) return;
  window.__amyFxProfessionalMarketSourceRegistryV1 = true;

  const VERSION = "1.0.0";
  const REGISTRY_KEY = "amyfx.bot.market.registry.v1";
  const AUDIT_KEY = "amyfx.bot.answer.audit.v1";
  const SESSION_KEY = "amyfx.bot.market.session.v1";
  const INTEL_KEY = "amyfx.market.intel.v1";
  const MAX_AUDIT = 60;
  const MAX_LIVE_AGE_MS = 5 * 60 * 1000;

  const clean = value => String(value ?? "").trim();
  const lower = value => clean(value).toLowerCase().replace(/[^a-z0-9À-ÿ%./+\-\s]/gi, " ").replace(/\s+/g, " ").trim();

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
    const next = { ...readSession(), ...patch, updatedAt: new Date().toISOString() };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch {}
    return next;
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

  function isoTime(value) {
    const time = validTime(value);
    return time ? new Date(time).toISOString() : null;
  }

  function latestTime(values) {
    const rows = values.map(validTime).filter(Boolean);
    return rows.length ? new Date(Math.max(...rows)).toISOString() : null;
  }

  function priceText(value) {
    const parsed = positiveNumber(value);
    return parsed ? new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(parsed) : "—";
  }

  function numberText(value, digits = 1) {
    const parsed = number(value);
    return parsed === null ? "—" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(parsed);
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

  function normalizeDirection(value) {
    const raw = clean(value).toUpperCase();
    if (!raw) return "";
    if (/BULL|BUY|UPTREND|UPWARD|NAIK/.test(raw)) return "BULLISH";
    if (/BEAR|SELL|DOWNTREND|DOWNWARD|TURUN/.test(raw)) return "BEARISH";
    if (/NO CLEAR|NEUTRAL|SIDEWAYS|RANGE|WAIT|MIXED|TRANSITION|BELUM JELAS/.test(raw)) return "NO CLEAR DIRECTION";
    return raw;
  }

  function directional(value) {
    const direction = normalizeDirection(value);
    return direction === "BULLISH" || direction === "BEARISH" ? direction : "";
  }

  function firstDirection(values) {
    for (const value of values) {
      const direction = normalizeDirection(value);
      if (direction) return direction;
    }
    return "";
  }

  function firstObject(values) {
    return values.find(value => value && typeof value === "object") || null;
  }

  function currentModule() {
    const path = location.pathname.toLowerCase();
    if (path.includes("/apps/mapping/")) return "mapping";
    if (path.includes("/apps/market-intel/")) return "intel";
    if (path.includes("/apps/journal/")) return "journal";
    if (path.includes("/apps/academy/")) return "academy";
    return "home";
  }

  function intelState(context) {
    const fromContext = context?.payload?.workspace?.market?.shared_intelligence;
    if (fromContext && typeof fromContext === "object" && Object.keys(fromContext).length) return fromContext;
    try {
      const state = window.AmyFXIntel?.read?.();
      if (state && typeof state === "object") return state;
    } catch {}
    if (window.AmyFXIntelState && typeof window.AmyFXIntelState === "object") return window.AmyFXIntelState;
    return readJson(INTEL_KEY, {});
  }

  function liveResult(context) {
    const market = context?.payload?.workspace?.market || {};
    return firstObject([
      market.live_state?.result,
      market.live_state,
      window.AmyFXMarketState?.result,
      window.state?.result,
      window.lastMappingResult
    ]);
  }

  function partTimestamp(part) {
    try {
      const fromIntel = window.AmyFXIntel?.partTimestamp?.(part);
      if (validTime(fromIntel)) return validTime(fromIntel);
    } catch {}
    return Math.max(
      validTime(part?.updated),
      validTime(part?.capturedAt),
      validTime(part?.captured_at),
      validTime(part?.analyzedAt),
      validTime(part?.storedAt)
    );
  }

  function partStale(part) {
    const status = clean(part?.status || part?.statusText).toUpperCase();
    return Boolean(part?.dataStale) || /DATA USANG|STALE|EXPIRED|INVALID/.test(status);
  }

  function partFresh(part) {
    const time = partTimestamp(part);
    return Boolean(time && Date.now() - time <= MAX_LIVE_AGE_MS && !partStale(part));
  }

  function normalizeLevel(item, type, currentPrice) {
    const price = positiveNumber(item?.price ?? item?.level ?? item?.value);
    if (!price) return null;
    const status = clean(item?.status || item?.state || "ACTIVE").toUpperCase();
    if (item?.active === false || /SWEPT|CONSUMED|TOUCHED|TAKEN|INVALID|BROKEN|EXPIRED|HISTORICAL|INACTIVE/.test(status)) return null;
    if (type === "BSL" && currentPrice && price <= currentPrice) return null;
    if (type === "SSL" && currentPrice && price >= currentPrice) return null;
    const rawDistance = number(item?.distance ?? item?.distanceFromPrice);
    return {
      type,
      kind: type,
      price,
      distance: rawDistance === null ? (currentPrice ? price - currentPrice : 0) : rawDistance,
      status: status || "ACTIVE",
      active: true,
      source: clean(item?.source || "Market Intel")
    };
  }

  function fallbackPrice(state, context) {
    const candidates = [
      context?.payload?.workspace?.market?.current_price,
      context?.payload?.workspace?.market?.live_state?.price,
      state?.mapping?.price,
      state?.liquidity?.currentPrice,
      state?.heatmap?.currentPrice,
      window.AmyFXMarketState?.price,
      localStorage.getItem("last_price")
    ].map(positiveNumber).filter(Boolean);
    return candidates[0] || null;
  }

  function bestPrice(state, context) {
    try {
      const value = positiveNumber(window.AmyFXIntel?.bestCurrentPrice?.(state));
      if (value) return value;
    } catch {}
    const candidates = ["mapping", "liquidity", "heatmap"].map(name => {
      const part = state?.[name];
      const value = positiveNumber(name === "mapping" ? part?.price : part?.currentPrice);
      return value ? { value, time: partTimestamp(part), fresh: partFresh(part) } : null;
    }).filter(Boolean);
    const fresh = candidates.filter(item => item.fresh).sort((a, b) => b.time - a.time)[0];
    const latest = candidates.sort((a, b) => b.time - a.time)[0];
    return (fresh || latest)?.value || fallbackPrice(state, context);
  }

  function fallbackNearest(state, type, price) {
    const parts = [
      { name: "Mapping", value: state?.mapping, rows: state?.mapping?.levels, direct: state?.mapping?.[type.toLowerCase()] },
      { name: "Liquidity", value: state?.liquidity, rows: state?.liquidity?.levels },
      { name: "Heatmap", value: state?.heatmap, rows: (state?.heatmap?.zones || []).map(zone => ({ ...zone, type: zone.type || zone.liquidityType })) }
    ].filter(part => part.value && partFresh(part.value)).sort((a, b) => partTimestamp(b.value) - partTimestamp(a.value));
    for (const part of parts) {
      const rows = Array.isArray(part.rows) ? part.rows : [];
      const candidates = rows
        .filter(item => clean(item?.type || item?.liquidityType).toUpperCase() === type)
        .map(item => normalizeLevel(item, type, price))
        .filter(Boolean)
        .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
      if (candidates[0]) return { ...candidates[0], sourceLabel: `${part.name} nearest draw`, capturedAt: isoTime(partTimestamp(part.value)) };
      const direct = normalizeLevel({ type, price: part.direct }, type, price);
      if (direct) return { ...direct, sourceLabel: `${part.name} nearest draw`, capturedAt: isoTime(partTimestamp(part.value)) };
    }
    return null;
  }

  function canonicalLiquidity(state, price) {
    let levels = null;
    try { levels = window.AmyFXIntel?.nearestLevels?.(state) || null; } catch {}
    const freshness = (() => {
      try { return window.AmyFXIntel?.freshness?.(state) || null; } catch { return null; }
    })();
    const capturedAt = latestTime([
      state?.mapping?.updated, state?.mapping?.capturedAt,
      state?.liquidity?.updated, state?.liquidity?.capturedAt,
      state?.heatmap?.updated, state?.heatmap?.capturedAt
    ]);
    const bsl = levels?.bsl ? { ...levels.bsl, type: "BSL", kind: "BSL", price: positiveNumber(levels.bsl.price ?? levels.bsl.level), sourceLabel: "Market Intel nearest draw", capturedAt } : fallbackNearest(state, "BSL", price);
    const ssl = levels?.ssl ? { ...levels.ssl, type: "SSL", kind: "SSL", price: positiveNumber(levels.ssl.price ?? levels.ssl.level), sourceLabel: "Market Intel nearest draw", capturedAt } : fallbackNearest(state, "SSL", price);
    return {
      bsl: bsl?.price ? bsl : null,
      ssl: ssl?.price ? ssl : null,
      state: freshness?.className === "live" || freshness?.label === "LIVE" ? "LIVE" : freshness?.className === "offline" ? "OFFLINE" : (bsl || ssl) ? "STRUCTURAL" : "STALE",
      source: clean(freshness?.source || "Market Intel"),
      capturedAt
    };
  }

  function weightedDominant(result) {
    const score = number(result?.biasEvidence?.normalized);
    if (score !== null && Math.abs(score) >= 0.18) return score > 0 ? "BULLISH" : "BEARISH";
    return "";
  }

  function dominantDirection(result, mapping, stored, outlook) {
    const forecast = result?.validatedMarketContext?.directionForecast || result?.validatedDirectionForecast;
    if (forecast?.active && directional(forecast.direction)) {
      return { value: directional(forecast.direction), source: "Mapping engine · Validated Direction Forecast", confidence: number(forecast.confidence) };
    }
    const explicit = firstDirection([
      result?.dominantDirection,
      stored?.dominantDirection,
      mapping?.dominantDirection
    ]);
    if (directional(explicit)) return { value: directional(explicit), source: "Mapping engine · arah dominan", confidence: number(stored?.directionConfidence) };
    const weighted = weightedDominant(result);
    if (weighted) return { value: weighted, source: "Mapping engine · weighted bias", confidence: number(result?.score) };
    const direction = firstDirection([
      result?.directionDecision?.bias,
      result?.final,
      mapping?.directionForecast,
      mapping?.directionDecision?.bias,
      mapping?.bias,
      outlook?.direction,
      outlook?.primaryDirection
    ]);
    return { value: direction || "NO CLEAR DIRECTION", source: "Mapping engine", confidence: number(result?.score) };
  }

  function timeframeDirection(result, mapping, stored) {
    const value = firstDirection([
      result?.validatedMarketContext?.marketState?.structureTrend,
      result?.st?.confirmedTrend,
      result?.st?.trend,
      stored?.timeframeDirection,
      mapping?.timeframeDirection,
      mapping?.structureDirection,
      mapping?.directionDecision?.signal,
      mapping?.direction
    ]);
    return value || "NO CLEAR DIRECTION";
  }

  function eventStory(result, stored) {
    const event = firstObject([
      result?.st?.lastEvent,
      result?.st?.lastConfirmedBreak,
      result?.st?.lastSweep,
      stored?.past?.event
    ]);
    if (!event) return stored?.past || null;
    const direction = normalizeDirection(event.dir || event.direction);
    const price = positiveNumber(event.price ?? event.level);
    const kind = clean(event.kind || event.breakType || event.type || "event struktur").replaceAll("_", " ");
    return {
      event: clone(event),
      text: `${kind}${direction && direction !== "NO CLEAR DIRECTION" ? ` ${direction}` : ""}${price ? ` di ${priceText(price)}` : ""}`,
      source: "Mapping engine · market structure"
    };
  }

  function setupStory(result, mapping, stored) {
    const setup = firstObject([
      result?.setupExecution,
      result?.experimentalBestSetup,
      result?.bestSetup,
      mapping?.setupExecution,
      mapping?.setup,
      stored?.setup
    ]);
    if (!setup) return null;
    return {
      state: clean(setup.state || setup.status || setup.lifecycleStage || "WAIT").toUpperCase(),
      direction: normalizeDirection(setup.direction || setup.dir),
      entryLow: positiveNumber(setup.entryLow ?? setup.zoneLow ?? setup.entry),
      entryHigh: positiveNumber(setup.entryHigh ?? setup.zoneHigh ?? setup.entry),
      invalidation: positiveNumber(setup.stopLoss ?? setup.sl ?? setup.invalidation),
      target1: positiveNumber(setup.target1 ?? setup.tp1 ?? setup.target),
      target2: positiveNumber(setup.target2 ?? setup.tp2),
      active: setup.active === true && !setup.terminal,
      reason: clean(setup.invalidationReason || setup.reason),
      source: "Mapping engine · setup lifecycle"
    };
  }

  function outlookStory(result, state, stored, dominant, liquidity) {
    const outlook = firstObject([
      state?.outlook,
      result?.marketOutlook,
      result?.tradeScenarios,
      stored?.outlook
    ]) || {};
    const scenarios = Array.isArray(outlook.scenarios) ? outlook.scenarios : [];
    const scenario = scenarios.find(item => clean(item?.status).toUpperCase() === "ACTIVE") || scenarios[0] || null;
    const setup = setupStory(result, state?.mapping || {}, stored);
    const direction = firstDirection([
      scenario?.side,
      outlook.direction,
      outlook.primaryDirection,
      setup?.direction,
      dominant?.value
    ]);
    const directionalTarget = direction === "BEARISH" ? liquidity.ssl : direction === "BULLISH" ? liquidity.bsl : null;
    return {
      status: clean(outlook.status || (scenario ? "ACTIVE" : setup?.state || "WAIT")).toUpperCase(),
      direction: direction || "NO CLEAR DIRECTION",
      target: positiveNumber(scenario?.target ?? setup?.target1 ?? directionalTarget?.price),
      target2: positiveNumber(setup?.target2),
      invalidation: positiveNumber(scenario?.invalidation ?? setup?.invalidation),
      zoneLow: positiveNumber(scenario?.zoneLow ?? setup?.entryLow),
      zoneHigh: positiveNumber(scenario?.zoneHigh ?? setup?.entryHigh),
      reason: clean(scenario?.reason || outlook.message || setup?.reason),
      expiresAt: isoTime(scenario?.expiresAt),
      source: scenario ? "Mapping engine · Market Outlook" : setup ? setup.source : "Mapping engine · draw on liquidity"
    };
  }

  function engineSnapshot(result, context, state) {
    if (!result || typeof result !== "object") return null;
    const mapping = state?.mapping || {};
    const stored = readJson(REGISTRY_KEY, {});
    const price = bestPrice(state, context) || positiveNumber(result.price);
    const liquidity = canonicalLiquidity(state, price);
    const dominant = dominantDirection(result, mapping, stored, state?.outlook || {});
    const tfDirection = timeframeDirection(result, mapping, stored);
    const past = eventStory(result, stored);
    const setup = setupStory(result, mapping, stored);
    const future = outlookStory(result, state, stored, dominant, liquidity);
    const capturedAt = latestTime([
      result.capturedAt, result.captured_at, result.updatedAt, result.timestamp,
      window.AmyFXMarketState?.capturedAt, mapping.updated, mapping.capturedAt
    ]);
    const validated = result.validatedMarketContext || {};
    const snapshot = {
      schema: "AmyFXBotMarketRegistryV1",
      schemaVersion: 1,
      pair: "XAU/USD",
      timeframe: clean(result.tf || result.timeframe || mapping.timeframe || "M15").toUpperCase(),
      capturedAt,
      storedAt: new Date().toISOString(),
      price,
      dataStale: Boolean(result.dataStale || partStale(mapping)),
      dominantDirection: dominant.value,
      directionSource: dominant.source,
      directionConfidence: dominant.confidence,
      timeframeDirection: tfDirection,
      structureState: clean(validated?.marketState?.state || mapping.marketState || result?.st?.confirmedTrend),
      structure: clone(result.st || validated?.marketState || null),
      regime: clean(result?.strategyRouter?.activeRegime || result?.marketRegime?.regime || mapping.regime),
      zone: clean(result?.dealingRange?.currentZone || result?.zone || mapping.zone),
      setup,
      past,
      future,
      outlook: clone(state?.outlook || result?.marketOutlook || result?.tradeScenarios || null),
      evidence: {
        forecast: clone(validated?.directionForecast || result?.validatedDirectionForecast || null),
        biasEvidence: clone(result?.biasEvidence || null),
        mappingExplanation: clone(result?.mappingExplanation || mapping.mappingExplanation || null),
        conflicts: clone(result?.conflicts || [])
      }
    };
    return snapshot;
  }

  function persistEngineSnapshot(context = null) {
    const state = intelState(context);
    const result = liveResult(context);
    if (!result) return readJson(REGISTRY_KEY, {});
    const snapshot = engineSnapshot(result, context, state);
    if (!snapshot) return readJson(REGISTRY_KEY, {});
    writeJson(REGISTRY_KEY, snapshot);
    window.AmyFXBotMarketRegistryState = Object.freeze(snapshot);
    window.dispatchEvent(new CustomEvent("amyfx:bot-market-registry-update", { detail: snapshot }));
    return snapshot;
  }

  function dataSnapshot(context = null) {
    const state = intelState(context);
    const live = liveResult(context);
    const stored = live ? (engineSnapshot(live, context, state) || readJson(REGISTRY_KEY, {})) : readJson(REGISTRY_KEY, {});
    if (live && stored?.schema) {
      writeJson(REGISTRY_KEY, stored);
      window.AmyFXBotMarketRegistryState = Object.freeze(stored);
    }
    const mapping = state?.mapping || {};
    const price = bestPrice(state, context) || positiveNumber(stored?.price);
    const liquidity = canonicalLiquidity(state, price);
    const dominant = live ? dominantDirection(live, mapping, stored, state?.outlook || {}) : {
      value: firstDirection([stored?.dominantDirection, mapping?.dominantDirection, mapping?.directionForecast, mapping?.directionDecision?.bias, mapping?.bias]) || "NO CLEAR DIRECTION",
      source: clean(stored?.directionSource || "Mapping engine"),
      confidence: number(stored?.directionConfidence)
    };
    const tfDirection = live ? timeframeDirection(live, mapping, stored) : firstDirection([stored?.timeframeDirection, mapping?.timeframeDirection, mapping?.directionDecision?.signal, mapping?.direction]) || "NO CLEAR DIRECTION";
    const past = live ? eventStory(live, stored) : stored?.past || null;
    const setup = live ? setupStory(live, mapping, stored) : stored?.setup || null;
    const future = live ? outlookStory(live, state, stored, dominant, liquidity) : outlookStory({}, state, stored, dominant, liquidity);
    const capturedAt = latestTime([liquidity.capturedAt, stored?.capturedAt, mapping?.updated, mapping?.capturedAt, state?.outlook?.generatedAt]);
    const conflicts = [];
    if (directional(dominant.value) && directional(tfDirection) && directional(dominant.value) !== directional(tfDirection)) {
      conflicts.push(`Arah dominan ${directional(dominant.value)} berbeda dengan arah ${clean(stored?.timeframe || mapping?.timeframe || "M15").toUpperCase()} ${directional(tfDirection)}.`);
    }
    const outlookDirection = directional(future?.direction);
    if (directional(dominant.value) && outlookDirection && directional(dominant.value) !== outlookDirection) {
      conflicts.push(`Arah dominan ${directional(dominant.value)} berbeda dengan Market Outlook ${outlookDirection}.`);
    }
    const legacyBsl = positiveNumber(mapping?.bsl);
    const legacySsl = positiveNumber(mapping?.ssl);
    if (liquidity.bsl && legacyBsl && Math.abs(liquidity.bsl.price - legacyBsl) > 0.01) conflicts.push(`BSL nearest draw ${priceText(liquidity.bsl.price)} berbeda dengan snapshot Mapping ${priceText(legacyBsl)}.`);
    if (liquidity.ssl && legacySsl && Math.abs(liquidity.ssl.price - legacySsl) > 0.01) conflicts.push(`SSL nearest draw ${priceText(liquidity.ssl.price)} berbeda dengan snapshot Mapping ${priceText(legacySsl)}.`);
    const dataState = liquidity.state === "LIVE" && !stored?.dataStale ? "LIVE" : stored?.dataStale ? "STALE" : liquidity.state;
    return {
      pair: "XAU/USD",
      timeframe: clean(stored?.timeframe || mapping?.timeframe || "M15").toUpperCase(),
      price,
      capturedAt,
      dataState,
      dominant,
      timeframeDirection: tfDirection,
      structureState: clean(stored?.structureState || mapping?.marketState),
      regime: clean(stored?.regime || mapping?.regime),
      zone: clean(stored?.zone || mapping?.zone),
      past,
      setup,
      future,
      liquidity,
      newsRisk: (() => { try { return clean(window.AmyFXIntel?.newsRisk?.(state) || "UNKNOWN").toUpperCase(); } catch { return "UNKNOWN"; } })(),
      session: (() => { try { return window.AmyFXIntel?.sessionInfo?.() || null; } catch { return null; } })(),
      conflicts,
      evidence: stored?.evidence || null,
      sources: {
        direction: dominant.source,
        liquidity: "Market Intel nearest draw",
        story: "Mapping engine",
        capturedAt
      }
    };
  }

  function provenance(snapshot, source) {
    return `Sumber: ${source} • ${timeText(snapshot.capturedAt)} • ${snapshot.dataState}.`;
  }

  function conflictText(snapshot, directionalOnly = false) {
    const rows = directionalOnly
      ? snapshot.conflicts.filter(item => /arah dominan|Market Outlook/i.test(item))
      : snapshot.conflicts;
    return rows.length ? ` Konflik data: ${rows.join(" ")} Karena itu status keputusan tetap WAIT sampai data kembali selaras.` : "";
  }

  function sourceMismatchText(snapshot) {
    const rows = snapshot.conflicts.filter(item => /^(BSL|SSL) nearest draw/i.test(item));
    return rows.length ? ` Perbedaan sumber terdeteksi: ${rows.join(" ")} Nearest draw live dipakai sebagai acuan resmi.` : "";
  }

  function answerBsl(snapshot) {
    if (!snapshot.liquidity.bsl) return `BSL aktif belum tersedia dari sumber live. ${provenance(snapshot, "Market Intel nearest draw")}`;
    const mismatch = snapshot.conflicts.find(item => /^BSL nearest draw/i.test(item));
    return `BSL aktif terdekat ${priceText(snapshot.liquidity.bsl.price)}.${mismatch ? ` ${mismatch} Saya memakai nearest draw live karena menjadi sumber resmi.` : ""} ${provenance(snapshot, "Market Intel nearest draw")}`;
  }

  function answerSsl(snapshot) {
    if (!snapshot.liquidity.ssl) return `SSL aktif belum tersedia dari sumber live. ${provenance(snapshot, "Market Intel nearest draw")}`;
    const mismatch = snapshot.conflicts.find(item => /^SSL nearest draw/i.test(item));
    return `SSL aktif terdekat ${priceText(snapshot.liquidity.ssl.price)}.${mismatch ? ` ${mismatch} Saya memakai nearest draw live karena menjadi sumber resmi.` : ""} ${provenance(snapshot, "Market Intel nearest draw")}`;
  }

  function answerDirection(snapshot) {
    const dominant = snapshot.dominant.value || "NO CLEAR DIRECTION";
    const local = snapshot.timeframeDirection || "NO CLEAR DIRECTION";
    const confidence = snapshot.dominant.confidence !== null && snapshot.dominant.confidence !== undefined ? ` (${numberText(snapshot.dominant.confidence, 0)}%)` : "";
    const base = directional(dominant)
      ? `Arah dominan engine ${directional(dominant)}${confidence}. Arah ${snapshot.timeframe} ${local}.`
      : `Arah dominan engine belum jelas. Arah ${snapshot.timeframe} ${local}.`;
    return `${base}${conflictText(snapshot, true)} ${provenance(snapshot, snapshot.dominant.source || "Mapping engine")}`;
  }

  function answerPast(snapshot) {
    if (!snapshot.past?.text) return `Riwayat struktur terakhir belum tersedia dari Mapping engine. ${provenance(snapshot, "Mapping engine")}`;
    return `Masa lalu market: ${snapshot.past.text}. Ini menjadi konteks struktur yang membawa harga ke kondisi sekarang. ${provenance(snapshot, snapshot.past.source || "Mapping engine")}`;
  }

  function answerFuture(snapshot) {
    const future = snapshot.future || {};
    if (!directional(future.direction) && !future.target && !future.zoneLow) return `Skenario berikutnya belum tervalidasi. Amy tidak akan membuat prediksi sendiri. ${provenance(snapshot, future.source || "Mapping engine")}`;
    const parts = [];
    if (directional(future.direction)) parts.push(`arah skenario ${directional(future.direction)}`);
    if (future.zoneLow && future.zoneHigh) parts.push(`area ${priceText(future.zoneLow)}–${priceText(future.zoneHigh)}`);
    if (future.target) parts.push(`target ${priceText(future.target)}`);
    if (future.target2) parts.push(`target lanjutan ${priceText(future.target2)}`);
    if (future.invalidation) parts.push(`invalidasi ${priceText(future.invalidation)}`);
    const reason = future.reason ? ` Alasan engine: ${future.reason}.` : "";
    return `Skenario berikutnya: ${parts.join(", ")}.${reason}${conflictText(snapshot, true)} ${provenance(snapshot, future.source || "Mapping engine")}`;
  }

  function answerTarget(snapshot) {
    const target = snapshot.future?.target || (directional(snapshot.dominant.value) === "BEARISH" ? snapshot.liquidity.ssl?.price : snapshot.liquidity.bsl?.price);
    if (!target) return `Target berikutnya belum tervalidasi. Amy tidak akan menebak angka. ${provenance(snapshot, "Mapping engine + Market Intel")}`;
    return `Target berikutnya ${priceText(target)}${snapshot.future?.target2 ? `, lalu ${priceText(snapshot.future.target2)}` : ""}. ${provenance(snapshot, snapshot.future?.source || "Mapping engine + Market Intel")}`;
  }

  function answerInvalidation(snapshot) {
    const invalidation = snapshot.future?.invalidation || snapshot.setup?.invalidation;
    if (!invalidation) return `Invalidasi belum tersedia pada skenario aktif. Amy tidak akan mengarang level. ${provenance(snapshot, "Mapping engine")}`;
    return `Invalidasi skenario berada di ${priceText(invalidation)}. ${provenance(snapshot, snapshot.future?.source || snapshot.setup?.source || "Mapping engine")}`;
  }

  function answerWhy(snapshot) {
    const evidence = snapshot.evidence || {};
    const forecast = evidence.forecast || {};
    const mappingExplanation = evidence.mappingExplanation || {};
    const reasons = [];
    if (snapshot.structureState) reasons.push(`struktur ${snapshot.structureState}`);
    if (snapshot.regime) reasons.push(`karakter market ${snapshot.regime}`);
    if (snapshot.zone) reasons.push(`harga berada di ${snapshot.zone}`);
    if (number(forecast.confidence) !== null) reasons.push(`confidence forecast ${numberText(forecast.confidence, 0)}%`);
    if (clean(mappingExplanation.reason)) reasons.push(clean(mappingExplanation.reason));
    if (!reasons.length) return `Alasan arah belum cukup tersedia dari engine. Amy tidak akan membuat alasan tambahan. ${provenance(snapshot, snapshot.dominant.source || "Mapping engine")}`;
    return `Arah tersebut berasal dari ${reasons.join(", ")}.${conflictText(snapshot, true)} ${provenance(snapshot, snapshot.dominant.source || "Mapping engine")}`;
  }

  function answerSummary(snapshot) {
    const dominant = directional(snapshot.dominant.value);
    const local = snapshot.timeframeDirection || "NO CLEAR DIRECTION";
    if (!snapshot.price && !dominant && !snapshot.liquidity.bsl && !snapshot.liquidity.ssl) {
      return `Data market belum cukup untuk dirangkum. Amy tidak akan menebak arah atau level. ${provenance(snapshot, "Mapping engine + Market Intel")}`;
    }
    const rows = [];
    if (snapshot.past?.text) rows.push(`Sebelumnya terjadi ${snapshot.past.text}.`);
    rows.push(dominant ? `Market hari ini dominan ${dominant}.` : "Arah dominan market hari ini belum jelas.");
    rows.push(`Arah ${snapshot.timeframe} ${local}.`);
    if (snapshot.price) rows.push(`Harga terakhir ${priceText(snapshot.price)}.`);
    if (snapshot.structureState) rows.push(`Kondisi struktur ${snapshot.structureState}.`);
    if (snapshot.liquidity.bsl || snapshot.liquidity.ssl) {
      rows.push(`BSL terdekat ${snapshot.liquidity.bsl ? priceText(snapshot.liquidity.bsl.price) : "belum tersedia"} dan SSL terdekat ${snapshot.liquidity.ssl ? priceText(snapshot.liquidity.ssl.price) : "belum tersedia"}.`);
    }
    if (snapshot.future?.target) rows.push(`Target skenario ${priceText(snapshot.future.target)}.`);
    if (snapshot.future?.invalidation) rows.push(`Invalidasi ${priceText(snapshot.future.invalidation)}.`);
    if (snapshot.future?.zoneLow && snapshot.future?.zoneHigh) rows.push(`Area konteks ${priceText(snapshot.future.zoneLow)}–${priceText(snapshot.future.zoneHigh)}.`);
    if (snapshot.newsRisk && snapshot.newsRisk !== "UNKNOWN") rows.push(`Risiko news ${snapshot.newsRisk}.`);
    if (snapshot.session?.label) rows.push(`Sesi ${snapshot.session.label}.`);
    return `${rows.join(" ")}${conflictText(snapshot, true)}${sourceMismatchText(snapshot)} ${provenance(snapshot, "Mapping engine + Market Intel nearest draw")}`;
  }

  function answerFreshness(snapshot) {
    return `Status data market ${snapshot.dataState}. Data terakhir ${timeText(snapshot.capturedAt)}. Angka live hanya diambil dari sumber resmi; data kosong atau konflik tidak akan ditebak.`;
  }

  function answerSources(snapshot) {
    return `Sumber resmi Amy Bot: arah dan skenario dari Mapping engine; BSL/SSL serta harga dari Market Intel nearest draw; news dan sesi dari Market Intel. Data terakhir ${timeText(snapshot.capturedAt)} dengan status ${snapshot.dataState}.`;
  }

  function classify(question) {
    const value = lower(question)
      .replace(/\b(dimana)\b/g, "di mana")
      .replace(/\b(kemana|kemna)\b/g, "ke mana")
      .replace(/\b(maping|mapp?ing)\b/g, "mapping");
    const session = readSession();
    const marketTerms = /market|mapping|xau|gold|arah|bias|bsl|ssl|likuiditas|liquidity|target|invalidasi|skenario|struktur|harga|masa lalu|masa depan|ke depan|hari ini|sekarang|outlook|domin(?:an)?/;
    const followUp = /^(target berikutnya|targetnya|invalidasinya|kenapa|alasannya|arahnya|selanjutnya|terus|masa lalunya|masa depannya|sumbernya|datanya)$/;
    if (!marketTerms.test(value) && !(session.lastArea === "market" && followUp.test(value))) return null;
    if (/\bbsl\b|buy[ -]?side liquidity|likuiditas atas/.test(value) && /\bssl\b|sell[ -]?side liquidity|likuiditas bawah/.test(value)) return { intent: "both", value };
    if (/\bbsl\b|buy[ -]?side liquidity|likuiditas atas/.test(value)) return { intent: "bsl", value };
    if (/\bssl\b|sell[ -]?side liquidity|likuiditas bawah/.test(value)) return { intent: "ssl", value };
    if (/masa lalu|sebelumnya|riwayat market|yang sudah terjadi/.test(value) || (session.lastArea === "market" && /masa lalunya/.test(value))) return { intent: "past", value };
    if (/masa depan|ke depan|kedepan|outlook|skenario berikut|harga berikut|selanjutnya/.test(value) || (session.lastArea === "market" && /masa depannya|selanjutnya|terus/.test(value))) return { intent: "future", value };
    if (/invalidasi|batas salah|stop loss|\bsl\b/.test(value) || (session.lastArea === "market" && /invalidasinya/.test(value))) return { intent: "invalidation", value };
    if (/target|tp|draw on liquidity|dol/.test(value) || (session.lastArea === "market" && /targetnya|target berikutnya/.test(value))) return { intent: "target", value };
    if (/kenapa|alasan|dasar arah|bukti/.test(value) || (session.lastArea === "market" && /kenapa|alasannya/.test(value))) return { intent: "why", value };
    if (/sumber|ambil dari mana|data dari mana/.test(value) || (session.lastArea === "market" && /sumbernya/.test(value))) return { intent: "sources", value };
    if (/fresh|stale|usang|status data|data live/.test(value) || (session.lastArea === "market" && /datanya/.test(value))) return { intent: "freshness", value };
    if (/arah|bias|domin(?:an)?|bullish|bearish|ke mana/.test(value) || (session.lastArea === "market" && /arahnya/.test(value))) return { intent: "direction", value };
    if (/market hari ini|market sekarang|kondisi market|ringkas market|status market|mapping sekarang|harga saat ini|hari ini gimana/.test(value)) return { intent: "summary", value };
    if (/market|mapping|xau|gold/.test(value)) return { intent: "summary", value };
    return null;
  }

  function audit(question, intent, snapshot, answer) {
    const rows = readJson(AUDIT_KEY, []);
    const next = [{
      at: new Date().toISOString(),
      question: clean(question).slice(0, 240),
      intent,
      selected: {
        price: snapshot.price,
        dominantDirection: snapshot.dominant.value,
        timeframeDirection: snapshot.timeframeDirection,
        bsl: snapshot.liquidity.bsl?.price || null,
        ssl: snapshot.liquidity.ssl?.price || null,
        target: snapshot.future?.target || null,
        invalidation: snapshot.future?.invalidation || snapshot.setup?.invalidation || null
      },
      sources: snapshot.sources,
      dataState: snapshot.dataState,
      conflicts: snapshot.conflicts,
      answer: clean(answer).slice(0, 800)
    }, ...(Array.isArray(rows) ? rows : [])].slice(0, MAX_AUDIT);
    writeJson(AUDIT_KEY, next);
    window.AmyFXBotLastAudit = Object.freeze(next[0]);
  }

  function answerMarket(question, context = null) {
    const route = classify(question);
    if (!route) return null;
    const snapshot = dataSnapshot(context);
    let answer = "";
    if (route.intent === "bsl") answer = answerBsl(snapshot);
    else if (route.intent === "ssl") answer = answerSsl(snapshot);
    else if (route.intent === "both") answer = `${answerBsl(snapshot)} ${answerSsl(snapshot)}`;
    else if (route.intent === "direction") answer = answerDirection(snapshot);
    else if (route.intent === "past") answer = answerPast(snapshot);
    else if (route.intent === "future") answer = answerFuture(snapshot);
    else if (route.intent === "target") answer = answerTarget(snapshot);
    else if (route.intent === "invalidation") answer = answerInvalidation(snapshot);
    else if (route.intent === "why") answer = answerWhy(snapshot);
    else if (route.intent === "sources") answer = answerSources(snapshot);
    else if (route.intent === "freshness") answer = answerFreshness(snapshot);
    else answer = answerSummary(snapshot);
    writeSession({ lastArea: "market", lastIntent: route.intent, lastQuestion: clean(question) });
    audit(question, route.intent, snapshot, answer);
    return answer;
  }

  function install() {
    const bot = window.AmyFXProfessionalBot || window.AmyFXMappingIntentHotfix;
    if (!bot || typeof bot.answer !== "function") return false;
    if (bot.__amyProfessionalMarketSourceRegistryV1) return true;
    const originalAnswer = bot.answer.bind(bot);
    const wrapped = Object.freeze({
      ...bot,
      answer(question, context) {
        const marketAnswer = answerMarket(question, context);
        return marketAnswer ?? originalAnswer(question, context);
      },
      marketSourceRegistry: Object.freeze({ version: VERSION, snapshot: dataSnapshot, answer: answerMarket, auditKey: AUDIT_KEY }),
      __amyProfessionalMarketSourceRegistryV1: true
    });
    window.AmyFXProfessionalBot = wrapped;
    window.AmyFXMappingIntentHotfix = wrapped;
    window.dispatchEvent(new CustomEvent("amyfx:professional-market-source-registry-ready", { detail: { version: VERSION } }));
    window.AmyFXProfessionalBotHandlerLock?.lock?.();
    return true;
  }

  function boot() {
    persistEngineSnapshot();
    install();
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      persistEngineSnapshot();
      if (install() || attempts >= 200) window.clearInterval(timer);
    }, 50);
    window.setTimeout(() => window.clearInterval(timer), 15_000);
    ["amyfx:mapping-state-change", "amyfx:market-update", "amyfx:candles-updated", "focus"].forEach(name => {
      window.addEventListener(name, () => { persistEngineSnapshot(); install(); });
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) { persistEngineSnapshot(); install(); }
    });
    window.setInterval(() => {
      if (!document.hidden && currentModule() === "mapping") persistEngineSnapshot();
    }, 2_500);
  }

  window.AmyFXMarketSourceRegistry = Object.freeze({
    version: VERSION,
    snapshot: dataSnapshot,
    answer: answerMarket,
    publish: persistEngineSnapshot,
    auditKey: AUDIT_KEY,
    registryKey: REGISTRY_KEY,
    install
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
