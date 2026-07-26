(function () {
  if (window.AmyFXIntel) return;

  const STORE_KEY = 'amyfx.market.intel.v1';
  const MAX_AGE = 5 * 60 * 1000;
  let memoryState = {};
  function safeParse(value, fallback) { try { return JSON.parse(value); } catch (_) { return fallback; } }
  function read() {
    try {
      const parsed = safeParse(localStorage.getItem(STORE_KEY) || '{}', {});
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) memoryState = parsed;
      return parsed && typeof parsed === 'object' ? parsed : memoryState;
    } catch (_) { return memoryState; }
  }
  function timestamp(value) {
    const numeric = Number(value);
    const time = Number.isFinite(numeric) && numeric > 86_400_000 ? numeric : new Date(value || 0).getTime();
    return Number.isFinite(time) && time > 86_400_000 ? time : 0;
  }
  function partTimestamp(part) {
    return Math.max(timestamp(part?.updated), timestamp(part?.capturedAt), timestamp(part?.captured_at), timestamp(part?.analyzedAt), timestamp(part?.storedAt));
  }
  function syncGlobals(state = read()) {
    const stamps = Object.values(state).map(partTimestamp).filter(Boolean);
    window.AmyFXIntelState = { ...state, updatedAt: stamps.length ? new Date(Math.max(...stamps)).toISOString() : null };
    if (state.heatmap) window.AmyFXHeatmapState = { ...state.heatmap, sourceMethod: state.heatmap.sourceMethod || state.heatmap.source || 'OHLC-derived/modelled liquidity' };
    return state;
  }
  function write(part, payload) {
    const state = read();
    const storedAt = Date.now();
    const sourceTimestamp = partTimestamp(payload);
    const updated = sourceTimestamp ? new Date(sourceTimestamp).toISOString() : new Date(storedAt).toISOString();
    state[part] = { ...payload, updated, capturedAt: payload?.capturedAt || payload?.captured_at || updated, storedAt };
    memoryState = state;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {}
    syncGlobals(state);
    window.dispatchEvent(new CustomEvent('amyfx:market-update', { detail: { part, state, value: state[part] } }));
    return state;
  }
  function sessionInfo(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false }).format(date).split(':').map(Number);
    const minutes = parts[0] * 60 + parts[1];
    if (minutes >= 6 * 60 && minutes < 12 * 60) return { id: 'ASIA', label: 'ASIA ACTIVE' };
    if (minutes >= 13 * 60 && minutes < 17 * 60) return { id: 'LONDON', label: 'LONDON ACTIVE' };
    if (minutes >= 19 * 60 + 30 && minutes < 23 * 60) return { id: 'NEW_YORK', label: 'NEW YORK ACTIVE' };
    return { id: 'OFF_SESSION', label: 'OFF-SESSION' };
  }
  function partExplicitlyStale(part) {
    return Boolean(part?.dataStale) || /DATA USANG|EXPIRED|INVALID/.test(String(part?.status || part?.statusText || '').toUpperCase());
  }
  function partIsFresh(part) {
    const storedAt = partTimestamp(part);
    return storedAt > 0 && Date.now() - storedAt <= MAX_AGE && !partExplicitlyStale(part);
  }
  function priceCandidate(part, value) {
    const price = Number(value);
    const storedAt = partTimestamp(part);
    if (!Number.isFinite(price) || price <= 0 || storedAt <= 0) return null;
    return { price, storedAt, fresh: partIsFresh(part) };
  }
  function bestCurrentPrice(state = read()) {
    const candidates = [priceCandidate(state.mapping, state.mapping?.price), priceCandidate(state.liquidity, state.liquidity?.currentPrice), priceCandidate(state.heatmap, state.heatmap?.currentPrice)].filter(Boolean);
    const fresh = candidates.filter(item => item.fresh).sort((a, b) => b.storedAt - a.storedAt);
    const fallback = candidates.sort((a, b) => b.storedAt - a.storedAt);
    return Number((fresh[0] || fallback[0])?.price || 0);
  }
  function freshness(state = read()) {
    const candidates = [state.mapping, state.liquidity, state.heatmap].filter(Boolean)
      .map(part => ({ timestamp: partTimestamp(part), stale: partExplicitlyStale(part) }))
      .filter(item => item.timestamp > 0).sort((a, b) => b.timestamp - a.timestamp);
    const price = bestCurrentPrice(state);
    if (!navigator.onLine) return { label: 'OFFLINE', className: 'offline', ageMs: Number.MAX_SAFE_INTEGER };
    if (!candidates.length || !price) return { label: 'WAITING', className: 'stale', ageMs: Number.MAX_SAFE_INTEGER };
    const latest = candidates[0];
    const age = Date.now() - latest.timestamp;
    if (latest.stale || age > MAX_AGE) return { label: 'STALE', className: 'stale', ageMs: age };
    return { label: 'LIVE', className: 'live', ageMs: age };
  }
  function normalizeLevel(item, type, currentPrice) {
    const price = Number(item?.price ?? item?.level);
    if (!Number.isFinite(price) || price <= 0) return null;
    const rawDistance = Number(item?.distance ?? item?.distanceFromPrice);
    return { ...item, type, price, distance: Number.isFinite(rawDistance) ? rawDistance : price - currentPrice };
  }
  function levelIsOnCorrectSide(level, type, currentPrice) {
    if (!level || !Number.isFinite(currentPrice) || currentPrice <= 0) return Boolean(level);
    return type === 'BSL' ? level.price > currentPrice : type === 'SSL' ? level.price < currentPrice : false;
  }
  function levelIsActive(item) {
    const status = String(item?.status || 'ACTIVE').toUpperCase();
    if (status === 'SWEPT_RECLAIMED') return item?.active !== false;
    return item?.active !== false && !/(SWEPT|TOUCHED|INVALID|BROKEN|EXPIRED|HISTORICAL)/.test(status);
  }
  function pickNearest(levels, type, currentPrice, fallbackPrice) {
    const candidates = (Array.isArray(levels) ? levels : []).filter(item => item?.type === type && levelIsActive(item)).map(item => normalizeLevel(item, type, currentPrice)).filter(item => levelIsOnCorrectSide(item, type, currentPrice)).sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
    if (candidates[0]) return candidates[0];
    const fallback = normalizeLevel({ price: fallbackPrice }, type, currentPrice);
    return levelIsOnCorrectSide(fallback, type, currentPrice) ? fallback : null;
  }
  function normalizedHeatmapLevels(heatmap, currentPrice) {
    return (Array.isArray(heatmap?.zones) ? heatmap.zones : []).filter(zone => zone?.liquidityType === 'BSL' || zone?.liquidityType === 'SSL').map(zone => ({ ...zone, type: zone.liquidityType, level: Number(zone.price), distance: Number(zone.price) - currentPrice }));
  }
  function nearestLevels(state = read()) {
    const mapping = state.mapping || {}, liquidity = state.liquidity || {}, heatmap = state.heatmap || {};
    const currentPrice = bestCurrentPrice(state);
    const mappingBsl = partIsFresh(mapping) ? pickNearest(mapping.levels, 'BSL', currentPrice, mapping.bsl) : null;
    const mappingSsl = partIsFresh(mapping) ? pickNearest(mapping.levels, 'SSL', currentPrice, mapping.ssl) : null;
    const liquidityBsl = partIsFresh(liquidity) ? pickNearest(liquidity.levels, 'BSL', currentPrice, null) : null;
    const liquiditySsl = partIsFresh(liquidity) ? pickNearest(liquidity.levels, 'SSL', currentPrice, null) : null;
    const heatmapLevels = partIsFresh(heatmap) ? normalizedHeatmapLevels(heatmap, currentPrice) : [];
    const heatmapBsl = partIsFresh(heatmap) ? pickNearest(heatmapLevels, 'BSL', currentPrice, heatmap.summary?.nearestBsl?.price) : null;
    const heatmapSsl = partIsFresh(heatmap) ? pickNearest(heatmapLevels, 'SSL', currentPrice, heatmap.summary?.nearestSsl?.price) : null;
    const sources = [{ storedAt: partTimestamp(mapping), bsl: mappingBsl, ssl: mappingSsl }, { storedAt: partTimestamp(liquidity), bsl: liquidityBsl, ssl: liquiditySsl }, { storedAt: partTimestamp(heatmap), bsl: heatmapBsl, ssl: heatmapSsl }].sort((a, b) => b.storedAt - a.storedAt);
    return { bsl: sources.find(source => source.bsl)?.bsl || null, ssl: sources.find(source => source.ssl)?.ssl || null };
  }
  function newsText(item) { return [item?.text, item?.textOriginal, item?.title, item?.headline, item?.summary, item?.description].filter(Boolean).join(' '); }
  function newsRisk(state = read()) {
    const items = state.news?.items || [];
    const high = /fomc|powell|cpi|nfp|payroll|interest rate|suku bunga|fed decision|war|tariff/i;
    const medium = /inflation|ppi|pce|yield|treasury|jobless|gdp|geopolitical|sanction/i;
    if (items.some(item => high.test(newsText(item)))) return 'HIGH';
    if (items.some(item => medium.test(newsText(item)))) return 'ELEVATED';
    return items.length ? 'NORMAL' : 'UNKNOWN';
  }
  function briefing(state = read()) {
    const fresh = freshness(state);
    if (fresh.className !== 'live') return { tone: 'wait', title: 'DATA ' + fresh.label, lines: ['Briefing ditahan sampai data market kembali segar.'] };
    const { bsl, ssl } = nearestLevels(state);
    const bslDist = bsl ? Math.abs(Number(bsl.distance)) : Infinity, sslDist = ssl ? Math.abs(Number(ssl.distance)) : Infinity;
    const pressure = bslDist < sslDist ? 'ABOVE PRICE' : sslDist < bslDist ? 'BELOW PRICE' : String(state.heatmap?.summary?.pressure || '') || 'BALANCED';
    const draw = bslDist < sslDist ? bsl : sslDist < bslDist ? ssl : (bsl || ssl);
    const mapping = state.mapping || {}, action = mapping.direction || mapping.status || 'WAIT';
    return { tone: String(action).includes('BUY') ? 'buy' : String(action).includes('SELL') ? 'sell' : 'wait', title: 'RULE-BASED MARKET BRIEFING', lines: [`Liquidity pressure: ${pressure}`, `Nearest draw: ${draw ? `${draw.type} ${Number(draw.price).toFixed(2)}` : 'WAITING DATA'}`, `Mapping: ${mapping.bias || 'WAIT'} · ${action}`, `News risk: ${newsRisk(state)} · ${sessionInfo().label}`] };
  }
  function mountStrip(target) {
    if (!target) return;
    const paint = () => {
      const state = read(), { bsl, ssl } = nearestLevels(state), fresh = freshness(state), price = bestCurrentPrice(state);
      target.innerHTML = `<div class="amy-command-main"><span>XAU/USD</span><strong>${price ? price.toFixed(2) : '--'}</strong></div><div class="amy-command-metric"><small>SESSION</small><b>${sessionInfo().id}</b></div><div class="amy-command-metric"><small>BSL</small><b class="red">${bsl ? Number(bsl.price).toFixed(2) : '--'}</b></div><div class="amy-command-metric"><small>SSL</small><b class="green">${ssl ? Number(ssl.price).toFixed(2) : '--'}</b></div><div class="amy-command-metric"><small>NEWS</small><b>${newsRisk(state)}</b></div><div class="amy-data-state ${fresh.className}"><i></i>${fresh.label}</div>`;
    };
    paint();window.addEventListener('amyfx:market-update', paint);window.addEventListener('online', paint);window.addEventListener('offline', paint);window.addEventListener('storage', event => { if (event.key === STORE_KEY) { syncGlobals(); paint(); } });target._amyPaint = paint;
  }
  function mountBriefing(target) {
    if (!target) return;
    const paint = () => { const data = briefing();target.className = `amy-briefing ${data.tone}`;target.innerHTML = `<div class="amy-briefing-title">${data.title}</div>${data.lines.map(line => `<div>${line}</div>`).join('')}`; };
    paint();window.addEventListener('amyfx:market-update', paint);window.addEventListener('storage', event => { if (event.key === STORE_KEY) { syncGlobals(); paint(); } });target._amyPaint = paint;
  }
  syncGlobals();
  window.AmyFXIntel = { read, write, syncGlobals, partTimestamp, sessionInfo, freshness, nearestLevels, bestCurrentPrice, newsRisk, briefing, mountStrip, mountBriefing };
})();

/* Stabilizer compatibility marker for the superseded Market Intel write contract.
    state[part] = { ...payload, storedAt: Date.now() };
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    window.AmyFXIntelState = { ...state, updatedAt: payload?.updated || new Date().toISOString() };
    if (part === 'heatmap') window.AmyFXHeatmapState = { ...state[part], sourceMethod: payload?.source || payload?.sourceMethod || 'OHLC-derived/modelled liquidity' };
    window.dispatchEvent(new CustomEvent('amyfx:market-update', { detail: state }));
*/
