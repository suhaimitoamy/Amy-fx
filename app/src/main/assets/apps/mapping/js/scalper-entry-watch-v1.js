const CARD_ID = 'amy-scalper-entry-watch';
const ENDPOINT = 'https://wliecyxzlwhmtftnfnps.supabase.co/functions/v1/scalper-setups?limit=8';
const ACTIVE = new Set(['WAITING_NEXT_OPEN', 'ACTIVE', 'BE_ACTIVE']);
let signature = '';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const price = value => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '-';
const resultR = value => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}R` : '-';
const model = value => value === 'IFVG_SCALPER' ? 'IFVG SCALPER' : 'FVG BUY HIGH QUALITY';
const status = value => ({
  WAITING_NEXT_OPEN:'MENUNGGU OPEN M15', ACTIVE:'ENTRY READY', BE_ACTIVE:'BE AKTIF',
  TP_HIT:'TP 2R HIT', SL_HIT:'SL HIT', BE_HIT:'BREAKEVEN', TIME_EXIT:'TIME EXIT', INVALIDATED:'INVALIDATED'
})[value] || String(value || 'WAIT').replaceAll('_', ' ');
const recommendation = value => ({
  VALID:'VALID', RISK_LIMIT:'RISK LIMIT', DUPLICATE_CLUSTER:'DUPLICATE CLUSTER',
  PENDING:'PENDING', CLOSED:'CLOSED', INVALID:'INVALID'
})[value] || String(value || 'PENDING');
const remaining = setup => Math.max(0, Number(setup?.maxBars || 4) - Number(setup?.barsElapsed || 0));
const tone = setup => !setup ? 'wait' : setup.status === 'TP_HIT' || setup.direction === 'BUY' ? 'buy' : setup.status === 'SL_HIT' || setup.direction === 'SELL' ? 'sell' : 'wait';

function instruction(setup) {
  if (!setup) return 'Engine memindai IFVG searah H1 dan FVG BUY High Quality dari candle yang sudah close.';
  if (setup.recommendationStatus === 'RISK_LIMIT') return 'Setup tetap dipantau, tetapi dua rekomendasi aktif sudah terisi.';
  if (setup.recommendationStatus === 'DUPLICATE_CLUSTER') return 'Setup tergabung dengan sinyal searah pada zona dan waktu yang hampir sama.';
  if (setup.status === 'WAITING_NEXT_OPEN') return 'Menunggu open M15 berikutnya untuk mengunci entry, SL, BE, dan TP.';
  if (setup.status === 'ACTIVE') return setup.model === 'IFVG_SCALPER'
    ? 'Pantau 1R untuk instruksi pindahkan SL ke breakeven. Maksimum empat candle M15.'
    : 'FVG BUY High Quality aktif. Target 2R dan maksimum empat candle M15.';
  if (setup.status === 'BE_ACTIVE') return '1R tercapai. Pindahkan SL broker secara manual ke harga entry.';
  if (setup.status === 'TIME_EXIT') return `Empat candle selesai. Hasil simulasi ${resultR(setup.resultR)}.`;
  if (setup.status === 'TP_HIT') return 'Target 2R tercapai pada simulasi engine.';
  if (setup.status === 'SL_HIT') return 'Setup simulasi selesai terkena Stop Loss.';
  if (setup.status === 'BE_HIT') return 'Setup simulasi selesai di breakeven.';
  return status(setup.status);
}

function mini(setup) {
  return `<article class="scalper-mini scalper-mini--${tone(setup)}" data-scalper-setup-id="${esc(setup.id)}">
    <div class="scalper-mini__head"><div><b>${esc(model(setup.model))} · ${esc(setup.direction)}</b><small>${esc(status(setup.status))}</small></div><span>${esc(recommendation(setup.recommendationStatus))}</span></div>
    <div class="scalper-mini__levels"><small>Entry <b>${price(setup.entry)}</b></small><small>SL <b>${price(setup.stopLoss)}</b></small><small>TP <b>${price(setup.target)}</b></small><small>${ACTIVE.has(setup.status) ? `Sisa ${remaining(setup)} candle` : resultR(setup.resultR)}</small></div>
  </article>`;
}

function card(payload, error = '') {
  const setup = payload?.primary || null;
  const active = Array.isArray(payload?.active) ? payload.active : [];
  const recent = Array.isArray(payload?.recent) ? payload.recent.slice(0, 3) : [];
  const others = active.filter(item => item.id !== setup?.id);
  const title = setup ? `${model(setup.model)} — ${setup.direction}` : error ? 'SCALPER ENGINE BELUM TERHUBUNG' : 'BELUM ADA SINYAL VALID';
  const levels = setup?.entry != null ? `<div class="scalper-level-grid"><div><small>Entry</small><strong>${price(setup.entry)}</strong></div><div><small>Stop Loss</small><strong>${price(setup.stopLoss)}</strong></div><div><small>BE 1R</small><strong>${price(setup.breakEvenTrigger)}</strong></div><div><small>TP 2R</small><strong>${price(setup.target)}</strong></div></div>` : '';
  return `<section id="${CARD_ID}" class="card scalper-watch scalper-watch--${tone(setup)}" data-scalper-mode="shadow">
    <div class="scalper-watch__head"><div><div class="kicker">SCALPER ENGINE · SHADOW MODE</div><h2>${esc(title)}</h2></div><span class="scalper-watch__badge">${esc(setup ? status(setup.status) : 'WAIT')}</span></div>
    <div class="scalper-watch__notice">SIMULASI — belum mengeksekusi atau memindahkan order broker otomatis.</div>
    ${setup ? `<div class="scalper-summary"><div><span>Model</span><strong>${esc(model(setup.model))}</strong></div><div><span>HTF Bias</span><strong>${esc(setup.htfBias || 'WAIT')}</strong></div><div><span>Rekomendasi</span><strong>${esc(recommendation(setup.recommendationStatus))}</strong></div><div><span>Lifecycle</span><strong>${esc(status(setup.status))} · sisa ${remaining(setup)} candle</strong></div></div>${levels}<p class="scalper-watch__instruction">${esc(instruction(setup))}</p>` : `<p class="scalper-watch__instruction">${esc(error || instruction(null))}</p>`}
    ${others.length ? `<div class="scalper-watch__section"><h3>Setup aktif lainnya</h3>${others.map(mini).join('')}</div>` : ''}
    ${recent.length ? `<details class="scalper-watch__recent"><summary>Lifecycle terbaru</summary>${recent.map(mini).join('')}</details>` : ''}
    <div class="scalper-watch__foot"><span>Engine ${esc(payload?.engine?.status || (error ? 'OFFLINE' : 'READY'))}</span><span>Maksimum rekomendasi 2 setup · semua sinyal tetap dicatat</span></div>
  </section>`;
}

function anchor() {
  return document.querySelector('[data-execution-plan-card="compact"]')
    || document.getElementById('amy-entry-watch-card')
    || document.querySelector('#app > .card');
}

function focusHash() {
  const match = location.hash.match(/scalper=([^&]+)/);
  if (!match) return;
  const id = decodeURIComponent(match[1]);
  const target = [...document.querySelectorAll('[data-scalper-setup-id]')].find(node => node.dataset.scalperSetupId === id)
    || document.getElementById(CARD_ID);
  if (!target) return;
  target.classList.add('scalper-focus');
  target.scrollIntoView({ block: 'center' });
  setTimeout(() => target.classList.remove('scalper-focus'), 3500);
}

function render(payload, error = '') {
  const next = JSON.stringify({ payload, error });
  const existing = document.getElementById(CARD_ID);
  if (next === signature && existing) return;
  signature = next;
  const html = card(payload, error);
  if (existing) existing.outerHTML = html;
  else anchor()?.insertAdjacentHTML('afterend', html);
  window.AmyFXScalperState = Object.freeze({ payload, error, updatedAt: Date.now() });
  window.dispatchEvent(new CustomEvent('amyfx:scalper-state-change', { detail: window.AmyFXScalperState }));
  focusHash();
}

async function sync() {
  try {
    const response = await fetch(ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
    render(payload);
  } catch (error) {
    render(null, `Backend scalper belum dapat dibaca: ${error?.message || error}`);
  }
}

function start() {
  sync();
  setInterval(sync, 30_000);
  window.addEventListener('hashchange', focusHash);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export { sync as syncScalperEntryWatch };
