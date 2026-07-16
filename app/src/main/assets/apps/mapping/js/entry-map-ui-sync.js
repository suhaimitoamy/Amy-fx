import { state, p2, nowTime, sessions } from './main.js';
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

function patchClockLabels() {
  const current = nowTime();
  const top = document.getElementById('top-wib');
  if (top) top.textContent = `${state.conn === 'Connected' ? '● Live Price' : `○ ${state.conn}`} • WITA ${current}`;
  const killzoneClock = document.getElementById('kz-wib');
  if (killzoneClock) killzoneClock.textContent = `WITA ${current}`;

  const focusSessions = sessions().filter(item =>
    item.name.includes('London Open') || item.name.includes('New York Open')
  );
  document.querySelectorAll('.session-focus small').forEach((element, index) => {
    const range = focusSessions[index]?.wita || focusSessions[index]?.wib;
    if (range) element.textContent = `${range} WITA`;
  });
}

function patchDecision(setup, display) {
  const decision = document.querySelector('.decision-main');
  if (decision) {
    if (!setup || display.terminal) decision.textContent = 'TUNGGU';
    else decision.textContent = `FOKUS ${String(setup.dir || '').includes('SELL') ? 'SELL' : 'BUY'}`;
  }
  document.querySelectorAll('.decision-box').forEach(box => {
    const labelElement = box.querySelector('small');
    const label = labelElement?.textContent?.trim();
    const value = box.querySelector('strong');
    if (!value) return;
    if (label === 'Status') value.textContent = display.status;
    if (label === 'Area Rencana') {
      if (labelElement) labelElement.textContent = 'Entry MSS';
      value.textContent = setup ? p2(setup.entry) : '-';
    }
    if (label === 'Batas Salah') {
      if (labelElement) labelElement.textContent = 'Stop Loss';
      value.textContent = setup ? p2(setup.sl) : '-';
    }
    if (label === 'Tingkat Keyakinan') {
      if (labelElement) labelElement.textContent = 'Mode Eksekusi';
      value.textContent = setup ? 'RULE-BASED' : '-';
    }
    if (label === 'Target Terdekat' && setup) {
      if (labelElement) labelElement.textContent = 'TP1 / TP2';
      value.textContent = `${p2(setup.tp1)} / ${p2(setup.tp2)}`;
    }
  });
  const reason = document.querySelector('.decision-reason');
  if (reason && setup) reason.innerHTML = `<b>Penjelasan:</b><br>${display.note}`;
}

function patchFocusCard(focus, setup, display) {
  const note = focus.querySelector('.summary-note');
  if (note) note.textContent = display.note;
  const title = focus.querySelector('h2');
  if (title) title.textContent = setup ? 'M15 ENTRY MAP' : 'Belum ada Entry Map aktif';

  focus.querySelectorAll('.setup-summary > div').forEach(box => {
    const label = box.querySelector('small');
    const value = box.querySelector('strong');
    const text = label?.textContent?.trim();
    if (!label || !value) return;
    if (text === 'Entry Area') {
      label.textContent = 'Entry MSS';
      value.textContent = setup ? p2(setup.entry) : '-';
    } else if (text === 'Invalidasi') {
      label.textContent = 'Stop Loss';
      value.textContent = setup ? p2(setup.sl) : '-';
    } else if (text === 'Target') {
      label.textContent = 'TP1 / TP2';
      value.textContent = setup ? `${p2(setup.tp1)} / ${p2(setup.tp2)}` : '-';
    } else if (text === 'Score') {
      label.textContent = 'Mode';
      value.textContent = setup ? 'RULE-BASED' : '-';
    }
  });
}

function patchExisting(setup, display) {
  patchClockLabels();
  const focus = document.querySelector('.setup-focus');
  if (focus && state.tf === 'M15') patchFocusCard(focus, setup, display);

  patchDecision(setup, display);

  document.querySelectorAll('.setup-card').forEach(card => {
    const title = card.querySelector('.setup-title')?.textContent || '';
    if (!title.includes('M15 ENTRY MAP')) return;
    const status = card.querySelector('.setup-head .muted');
    if (status) status.textContent = `Timeframe: M15 • Status: ${display.status}`;
    const reason = card.querySelector('.reason');
    if (reason) reason.innerHTML = `<b>Lifecycle:</b><br>${display.note}`;
    card.querySelectorAll('.num').forEach(box => {
      const label = box.querySelector('small');
      const value = box.querySelector('strong');
      const text = label?.textContent?.trim();
      if (!label || !value) return;
      if (text === 'Score') {
        label.textContent = 'Mode';
        value.textContent = 'RULE-BASED';
      } else if (text === 'Entry Area') {
        label.textContent = 'Entry MSS';
        value.textContent = setup ? p2(setup.entry) : '-';
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
  patchClockLabels();
  if (!result || state.tf !== 'M15' || !result.entryMap) {
    document.querySelector('.entry-map-state-card')?.remove();
    return;
  }
  const setup = result.entryMap.setup;
  const display = entryMapDisplayState(setup);
  const signature = JSON.stringify([
    state.tab,
    state.conn,
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
