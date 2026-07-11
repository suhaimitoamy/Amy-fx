(function () {
  if (window.AmyFXIntel) return;

  const STORE_KEY = 'amyfx.market.intel.v1';
  const MAX_AGE = 5 * 60 * 1000;

  function safeParse(value, fallback) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function read() {
    return safeParse(localStorage.getItem(STORE_KEY) || '{}', {});
  }

  function write(part, payload) {
    const state = read();
    state[part] = { ...payload, storedAt: Date.now() };
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('amyfx:market-update', { detail: state }));
    return state;
  }

  function sessionInfo(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date).split(':').map(Number);
    const minutes = parts[0] * 60 + parts[1];
    if (minutes >= 6 * 60 && minutes < 12 * 60) return { id: 'ASIA', label: 'ASIA ACTIVE' };
    if (minutes >= 13 * 60 && minutes < 17 * 60) return { id: 'LONDON', label: 'LONDON ACTIVE' };
    if (minutes >= 19 * 60 + 30 && minutes < 23 * 60) return { id: 'NEW_YORK', label: 'NEW YORK ACTIVE' };
    return { id: 'OFF_SESSION', label: 'OFF-SESSION' };
  }

  function freshness(state) {
    const stamps = ['heatmap', 'liquidity', 'news', 'mapping']
      .map(key => Number(state[key]?.storedAt || 0)).filter(Boolean);
    if (!navigator.onLine) return { label: 'OFFLINE', className: 'offline' };
    if (!stamps.length) return { label: 'WAITING', className: 'stale' };
    const age = Date.now() - Math.max(...stamps);
    if (age > MAX_AGE) return { label: 'STALE', className: 'stale' };
    return { label: 'LIVE', className: 'live' };
  }

  function nearestLevels(state) {
    const levels = state.liquidity?.levels || [];
    const bsl = levels.filter(x => x.type === 'BSL').sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0];
    const ssl = levels.filter(x => x.type === 'SSL').sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0];
    return { bsl, ssl };
  }

  function newsRisk(state) {
    const items = state.news?.items || [];
    const high = /fomc|powell|cpi|nfp|payroll|interest rate|suku bunga|fed decision|war|tariff/i;
    const medium = /inflation|ppi|pce|yield|treasury|jobless|gdp|geopolitical|sanction/i;
    if (items.some(item => high.test(item.text || ''))) return 'HIGH';
    if (items.some(item => medium.test(item.text || ''))) return 'ELEVATED';
    return items.length ? 'NORMAL' : 'UNKNOWN';
  }

  function briefing(state = read()) {
    const fresh = freshness(state);
    if (fresh.className !== 'live') {
      return { tone: 'wait', title: 'DATA ' + fresh.label, lines: ['Briefing ditahan sampai data market kembali segar.'] };
    }
    const { bsl, ssl } = nearestLevels(state);
    const bslDist = bsl ? Math.abs(Number(bsl.distance)) : Infinity;
    const sslDist = ssl ? Math.abs(Number(ssl.distance)) : Infinity;
    const pressure = bslDist < sslDist ? 'ABOVE PRICE' : sslDist < bslDist ? 'BELOW PRICE' : 'BALANCED';
    const draw = bslDist < sslDist ? bsl : ssl;
    const mapping = state.mapping || {};
    const action = mapping.direction || mapping.status || 'WAIT';
    return {
      tone: String(action).includes('BUY') ? 'buy' : String(action).includes('SELL') ? 'sell' : 'wait',
      title: 'RULE-BASED MARKET BRIEFING',
      lines: [
        `Liquidity pressure: ${pressure}`,
        `Nearest draw: ${draw ? `${draw.type} ${Number(draw.price).toFixed(2)}` : 'WAITING DATA'}`,
        `Mapping: ${mapping.bias || 'WAIT'} · ${action}`,
        `News risk: ${newsRisk(state)} · ${sessionInfo().label}`
      ]
    };
  }

  function mountStrip(target) {
    if (!target) return;
    const paint = () => {
      const state = read();
      const { bsl, ssl } = nearestLevels(state);
      const fresh = freshness(state);
      const price = Number(state.liquidity?.currentPrice || state.heatmap?.currentPrice || state.mapping?.price || 0);
      target.innerHTML = `
        <div class="amy-command-main"><span>XAU/USD</span><strong>${price ? price.toFixed(2) : '--'}</strong></div>
        <div class="amy-command-metric"><small>SESSION</small><b>${sessionInfo().id}</b></div>
        <div class="amy-command-metric"><small>BSL</small><b class="red">${bsl ? '+' + Math.abs(bsl.distance).toFixed(1) : '--'}</b></div>
        <div class="amy-command-metric"><small>SSL</small><b class="green">${ssl ? '−' + Math.abs(ssl.distance).toFixed(1) : '--'}</b></div>
        <div class="amy-command-metric"><small>NEWS</small><b>${newsRisk(state)}</b></div>
        <div class="amy-data-state ${fresh.className}"><i></i>${fresh.label}</div>`;
    };
    paint();
    window.addEventListener('amyfx:market-update', paint);
    window.addEventListener('online', paint);
    window.addEventListener('offline', paint);
    target._amyPaint = paint;
  }

  function mountBriefing(target) {
    if (!target) return;
    const paint = () => {
      const data = briefing();
      target.className = `amy-briefing ${data.tone}`;
      target.innerHTML = `<div class="amy-briefing-title">${data.title}</div>${data.lines.map(line => `<div>${line}</div>`).join('')}`;
    };
    paint();
    window.addEventListener('amyfx:market-update', paint);
    target._amyPaint = paint;
  }

  window.AmyFXIntel = { read, write, sessionInfo, freshness, nearestLevels, newsRisk, briefing, mountStrip, mountBriefing };
})();
