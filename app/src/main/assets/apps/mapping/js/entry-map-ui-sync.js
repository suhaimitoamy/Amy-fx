import { state, p2 } from './main.js';
import { entryMapDisplayState } from './ui/entry-map-status.js';

let lastSignature = '';

function valueBlock(label, value) {
  return `<div><small>${label}</small><strong>${value}</strong></div>`;
}

function cardMarkup(setup, display) {
  if (!setup) {
    return `<section class="card entry-map-state-card"><div class="kicker">M15 ENTRY MAP</div><h2>Belum ada setup aktif</h2><p class="muted">${display.note}</p></section>`;
  }
  const direction = String(setup.dir || '').includes('SELL') ? 'SELL' : 'BUY';
  const stateClass = display.terminal ? 'wait' : direction === 'BUY' ? 'buy' : 'sell';
  return `<section class="card entry-map-state-card">
    <div class="section-row"><div><div class="kicker">M15 ENTRY MAP</div><h2>${direction} · ${display.status}</h2></div><span class="badge ${stateClass}">${display.terminal ? 'SELESAI' : 'AKTIF'}</span></div>
    <div class="setup-summary">
      ${valueBlock('Entry MSS', p2(setup.entry))}
      ${valueBlock('Stop Loss', p2(setup.sl))}
      ${valueBlock('TP1 · 0,35R', p2(setup.tp1))}
      ${valueBlock('TP2 · 1,75R', p2(setup.tp2))}
    </div>
    <p class="summary-note">${display.note}</p>
    <div class="ai-map-note"><b>Lifecycle candle:</b> ${setup.lifecycle?.barsElapsed || 0}/${setup.expiryBars || 36} candle M15 · Sweep ${setup.sweepType || '-'} · MSS ${setup.direction || '-'}</div>
  </section>`;
}

function patchExisting(setup, display) {
  const focus = document.querySelector('.setup-focus');
  if (focus && state.tf === 'M15') {
    const note = focus.querySelector('.summary-note');
    if (note) note.textContent = display.note;
    const title = focus.querySelector('h2');
    if (title) title.textContent = setup ? 'M15 ENTRY MAP' : 'Belum ada Entry Map aktif';
  }

  document.querySelectorAll('.setup-card').forEach(card => {
    const title = card.querySelector('.setup-title')?.textContent || '';
    if (!title.includes('M15 ENTRY MAP')) return;
    const status = card.querySelector('.setup-head .muted');
    if (status) status.textContent = `Timeframe: M15 • Status: ${display.status}`;
    const reason = card.querySelector('.reason');
    if (reason) reason.innerHTML = `<b>Lifecycle:</b><br>${display.note}`;
    card.querySelectorAll('.num').forEach(box => {
      if (box.querySelector('small')?.textContent?.trim() === 'Score') {
        box.querySelector('small').textContent = 'Mode';
        box.querySelector('strong').textContent = 'RULE-BASED';
      }
    });
    const precision = card.querySelector('.precision-plan');
    if (precision) {
      precision.innerHTML = `<b>M15 ENTRY MAP</b><span>TP1 0,35R · SL → Break-even</span><span>TP2 1,75R · Expiry 36 candle M15</span>`;
    }
  });
}

function sync() {
  const result = state.result;
  if (!result || state.tf !== 'M15' || !result.entryMap) {
    document.querySelector('.entry-map-state-card')?.remove();
    return;
  }
  const setup = result.entryMap.setup;
  const display = entryMapDisplayState(setup);
  const signature = JSON.stringify([
    state.tab,
    setup?.id,
    display.status,
    setup?.sl,
    setup?.lifecycle?.barsElapsed,
    document.getElementById('app')?.childElementCount
  ]);
  if (signature === lastSignature) return;
  lastSignature = signature;
  patchExisting(setup, display);

  const app = document.getElementById('app');
  if (!app || !['Dashboard', 'Analyze', 'Setups'].includes(state.tab)) return;
  let card = app.querySelector('.entry-map-state-card');
  if (!card) {
    card = document.createElement('div');
    card.className = 'entry-map-state-card-host';
    const anchor = app.querySelector('.setup-focus') || app.firstElementChild;
    if (anchor?.nextSibling) app.insertBefore(card, anchor.nextSibling);
    else app.appendChild(card);
  }
  card.outerHTML = cardMarkup(setup, display);
}

new MutationObserver(sync).observe(document.documentElement, { childList: true, subtree: true });
window.setInterval(sync, 750);
window.addEventListener('amyfx:mapping-updated', sync);
sync();
