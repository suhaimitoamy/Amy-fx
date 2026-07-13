import { state, p2 } from '../main.js';
import { calculateAsiaRange } from './asia-range.js';

function currentRange() {
  return calculateAsiaRange(
    state.candles?.M15 || [],
    Number(state.price || localStorage.getItem('last_price') || 0),
    Date.now()
  );
}

function statusClass(status) {
  return `status-${String(status || 'wait').toLowerCase().replaceAll(' ', '-')}`;
}

function levelMarkup(label, value, status) {
  return `<div class="asia-level ${statusClass(status)}">
    <small>${label}</small>
    <strong>${p2(value)}</strong>
    <span>${status}</span>
  </div>`;
}

function dashboardMarkup(range) {
  if (!range?.valid) {
    return `<div class="asia-range-head"><b>ASIA RANGE</b><small>${range?.windowLabel || '-'}</small></div>
      <div class="asia-range-empty">${range?.note || 'Data Asia Range belum tersedia.'}</div>`;
  }
  return `<div class="asia-range-head"><b>ASIA RANGE</b><small>${range.windowLabel}</small></div>
    <div class="asia-range-grid">
      ${levelMarkup('ASIA HIGH', range.high, range.highStatus)}
      ${levelMarkup('ASIA LOW', range.low, range.lowStatus)}
    </div>
    <div class="asia-range-summary">${range.summary}</div>`;
}

function analyzeMarkup(range) {
  if (!range?.valid) {
    return `<div class="asia-strip-head"><span>ASIA LIQUIDITY</span><small>${range?.windowLabel || '-'}</small></div>
      <div class="asia-range-empty">${range?.note || 'Data Asia Range belum tersedia.'}</div>`;
  }
  return `<div class="asia-strip-head"><span>ASIA LIQUIDITY</span><small>${range.windowLabel}</small></div>
    <div class="asia-strip-levels">
      <span>Asia High <b>${p2(range.high)}</b><em>${range.highStatus}</em></span>
      <span>Asia Low <b>${p2(range.low)}</b><em>${range.lowStatus}</em></span>
    </div>
    <div class="asia-range-summary">${range.summary}</div>`;
}

function mountDashboard(range) {
  const sessionCard = document.querySelector('.session-card');
  if (!sessionCard) return;
  let block = sessionCard.querySelector('[data-asia-range-dashboard]');
  if (!block) {
    block = document.createElement('div');
    block.className = 'asia-range-block';
    block.dataset.asiaRangeDashboard = '';
    const sessionPill = sessionCard.querySelector('.session-pill');
    if (sessionPill) sessionPill.insertAdjacentElement('afterend', block);
    else sessionCard.appendChild(block);
  }
  block.innerHTML = dashboardMarkup(range);
}

function mountAnalyze(range) {
  const app = document.getElementById('app');
  const decisionCard = app?.querySelector('.decision-main')?.closest('.card');
  if (!decisionCard) return;
  let strip = app.querySelector('[data-asia-range-analyze]');
  if (!strip) {
    strip = document.createElement('section');
    strip.className = 'card asia-liquidity-strip';
    strip.dataset.asiaRangeAnalyze = '';
    decisionCard.insertAdjacentElement('afterend', strip);
  }
  strip.innerHTML = analyzeMarkup(range);
}

export function syncAsiaRangeUi() {
  const range = currentRange();
  mountDashboard(range);
  mountAnalyze(range);
}

const app = document.getElementById('app');
if (app) {
  new MutationObserver(() => syncAsiaRangeUi()).observe(app, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncAsiaRangeUi, { once: true });
} else {
  syncAsiaRangeUi();
}

setInterval(syncAsiaRangeUi, 20_000);
