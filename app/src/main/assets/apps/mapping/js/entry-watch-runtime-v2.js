const CARD_ID = 'amy-entry-watch-card';
const SYNC_MS = 1000;

let lastSignature = '';

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function price(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '-';
}

function readCanonical() {
  const state = window.state;
  const result = state?.result;
  if (!result) return null;
  const snapshot = result.mappingSnapshot;
  const scenario = snapshot?.scenario || result.entryMap?.scenario;
  const execution = snapshot?.execution || result.setupExecution;
  if (!scenario) return null;
  return { state, result, snapshot, scenario, execution };
}

function requirementMarkup(requirements) {
  return (Array.isArray(requirements) ? requirements : []).map(item =>
    `<div class="${item.passed ? 'active' : 'locked'}">
      <span>${item.passed ? '✓' : '○'}</span>
      <small>${safe(item.label)}</small>
      <em>${safe(item.detail || '')}</em>
    </div>`
  ).join('');
}

function isTerminalScenario(canonical) {
  if (canonical.result?.entryWatch?.terminal) return true;
  const status = String(canonical.scenario?.status || '').toUpperCase();
  return ['SL HIT', 'TP2 HIT', 'TP1 / BE', 'EXPIRED'].some(value =>
    status.includes(value)
  );
}

function statusClass(canonical) {
  if (canonical.execution?.active) return 'entry';
  if (isTerminalScenario(canonical)) return 'break';
  if (canonical.scenario?.direction && canonical.scenario.direction !== 'WAIT') return 'testing';
  return 'watch';
}

function actionText(canonical) {
  if (canonical.execution?.active) return `ENTRY ${canonical.execution.direction}`;
  if (isTerminalScenario(canonical)) return 'WAIT';
  if (canonical.scenario?.direction && canonical.scenario.direction !== 'WAIT') {
    return `PANTAU ${canonical.scenario.direction}`;
  }
  return 'WAIT';
}

function cardHtml(canonical) {
  const { snapshot, scenario, execution } = canonical;
  const requirements = requirementMarkup(scenario.requirements);
  const entryPlan = execution?.active
    ? `<div class="entry-watch-transition"><b>Setup dikunci dari closed candle</b>
        <span>Entry ${price(execution.entryLow)}–${price(execution.entryHigh)}</span>
        <small>SL ${price(execution.stopLoss)} · TP1 ${price(execution.target1)} · TP2 ${price(execution.target2)}</small>
      </div>`
    : '';
  const poi = scenario.poi
    ? `${scenario.poi.kind || 'POI'} ${price(scenario.poi.bottom)}–${price(scenario.poi.top)}`
    : 'Confluence tambahan belum ada';
  const target = scenario.target
    ? `${scenario.target.type} ${scenario.target.subtype || ''} @ ${price(scenario.target.level)} · ${Number(scenario.target.rr || 0).toFixed(2)}R`
    : 'Target struktural ≥ 2R belum tersedia';

  return `<section class="card entry-watch-card ${statusClass(canonical)}" id="${CARD_ID}">
    <div class="entry-watch-head">
      <div><div class="kicker">CAUSAL ENTRY WATCH · READ ONLY</div><h2>${safe(scenario.status || 'WAIT')}</h2></div>
      <span class="entry-watch-badge">${safe(actionText(canonical))}</span>
    </div>
    <div class="entry-watch-lifecycle entry-watch-requirements">${requirements}</div>
    <div class="entry-watch-grid">
      <div><small>Arah</small><strong>${safe(scenario.direction || 'WAIT')}</strong></div>
      <div><small>Timeframe Entry</small><strong>${safe(scenario.sourceTf || scenario.tf || '-')}</strong></div>
      <div><small>Timeframe Konteks</small><strong>${safe(scenario.contextTf || 'STRUKTUR LOKAL')}</strong></div>
      <div><small>Protected Level</small><strong>${price(scenario.protectedLevel)}</strong></div>
      <div><small>POI</small><strong>${safe(poi)}</strong></div>
      <div><small>Target</small><strong>${safe(target)}</strong></div>
    </div>
    <p class="entry-watch-reason">${safe(scenario.reason || 'Sequence causal belum lengkap.')}</p>
    ${entryPlan}
    <div class="entry-watch-footnote">Closed-candle facts → context → liquidity sweep → displaced MSS → structural target · UI tidak mengubah hasil engine.</div>
    <small>Authority: ${safe(snapshot?.authority?.entry || 'AMY_CAUSAL_ENTRY_MAP_V3')}</small>
  </section>`;
}

function syncCard() {
  const canonical = readCanonical();
  const existing = document.getElementById(CARD_ID);
  if (!canonical) {
    existing?.remove();
    return;
  }
  const signature = JSON.stringify({
    tf: canonical.scenario.tf,
    direction: canonical.scenario.direction,
    status: canonical.scenario.status,
    missing: canonical.scenario.missing,
    setupId: canonical.execution?.setupId,
    stage: canonical.execution?.lifecycleStage
  });
  if (signature === lastSignature && existing) return;
  lastSignature = signature;

  const app = document.getElementById('app');
  if (!app) return;
  const anchor = canonical.state.tab === 'Dashboard'
    ? app.querySelector('.tf-card')
    : app.querySelector(':scope > .card');
  if (!anchor) return;
  const html = cardHtml(canonical);
  if (existing) existing.outerHTML = html;
  else anchor.insertAdjacentHTML('afterend', html);

  window.dispatchEvent(new CustomEvent('amyfx:entry-watch-updated', {
    detail: {
      watch: canonical.result.entryWatch,
      scenario: canonical.scenario,
      readOnly: true
    }
  }));
}

function start() {
  syncCard();
  setInterval(syncCard, SYNC_MS);
  window.addEventListener('amyfx:candles-updated', syncCard);
  window.addEventListener('amyfx:market-update', syncCard);
  document.addEventListener('click', () => setTimeout(syncCard, 20), true);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncCard();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
