import { state, p2 } from './main.js';
import { analyze } from './engine/ict-core.js';
import { SUPPORTED_MAPPING_TIMEFRAMES } from './engine/mapping-timeframes.js';
import { buildDirectionDecision, buildSetupExecution } from './api/market-data.js';
import { calculateAsiaRange } from './session/asia-range.js';

const ASIA_WINDOW = '06:00–14:00 WITA';
let queued = false;
let busy = false;
let tfCacheKey = '';
let tfCache = [];

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
const dir = value => {
  const text = String(value || '').toUpperCase();
  if (text.includes('BUY') || text.includes('BULL')) return 'BUY';
  if (text.includes('SELL') || text.includes('BEAR')) return 'SELL';
  return 'WAIT';
};
const structuralDir = value => dir(value) === 'BUY' ? 'BULLISH' : dir(value) === 'SELL' ? 'BEARISH' : 'NEUTRAL';
const closed = tf => (state.candles?.[tf] || []).filter(candle => candle?.isClosed !== false);

function wita(value) {
  const raw = Number(value);
  if (!(raw > 0)) return '—';
  const ms = raw > 1e11 ? raw : raw * 1000;
  return new Intl.DateTimeFormat('id-ID', { timeZone:'Asia/Makassar', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(ms)).replace('.', ':');
}

function structure(result = state.result) {
  const market = result?.validatedMarketContext?.marketState || result?.validatedMarketState || {};
  const direction = structuralDir(market.direction || market.primaryDirection || result?.st?.confirmedTrend || result?.st?.trend);
  const label = String(market.state || (direction === 'BULLISH' ? 'UPTREND CONFIRMED' : direction === 'BEARISH' ? 'DOWNTREND CONFIRMED' : 'RANGE / TRANSITION')).replaceAll('_',' ');
  const phase = String(market.phase || (/PULLBACK/i.test(label) ? 'PULLBACK' : /RANGE|TRANSITION/i.test(label) ? 'TRANSITION' : direction === 'NEUTRAL' ? 'RANGE' : 'CONTINUATION')).replaceAll('_',' ');
  const low = num(market.protectedLow, result?.marketConcepts?.structureSnapshot?.protectedLow, result?.st?.protectedLow, result?.mappingSnapshot?.protectedLow);
  const high = num(market.protectedHigh, result?.marketConcepts?.structureSnapshot?.protectedHigh, result?.st?.protectedHigh, result?.mappingSnapshot?.protectedHigh);
  const invalidation = direction === 'BULLISH' ? low : direction === 'BEARISH' ? high : null;
  const rule = invalidation == null ? 'Belum tersedia dari protected structure.' : direction === 'BULLISH'
    ? `Batal bila candle ${result?.tf || state.tf} close di bawah ${p2(invalidation)}.`
    : `Batal bila candle ${result?.tf || state.tf} close di atas ${p2(invalidation)}.`;
  return { direction, label, phase, invalidation, rule };
}

function forecast(result = state.result) {
  const data = result?.validatedMarketContext?.directionForecast || result?.validatedDirectionForecast || {};
  const direction = data.active === true ? dir(data.direction) : 'WAIT';
  return { active: data.active === true && direction !== 'WAIT', direction, horizon: data.horizonText || data.horizon || '—' };
}

function permission(result = state.result) {
  const execution = result?.setupExecution || result?.entryWatch?.executionPlan || null;
  const direction = dir(execution?.direction || result?.entryWatch?.direction);
  const valid = Boolean(execution && execution.active !== false && execution.terminal !== true && result?.entryWatch?.terminal !== true
    && result?.entryWatch?.entryAllowed !== false && execution.alignedWithForecast !== false
    && num(execution.entryLow, execution.entry) != null && num(execution.stopLoss, execution.sl, execution.initialStopLoss) != null
    && num(execution.target1, execution.tp1) != null && direction !== 'WAIT');
  return { value: valid ? direction : 'WAIT', active: valid, execution, reason: valid ? `Execution plan ${direction} aktif.` : execution?.invalidationReason || result?.entryMap?.scenario?.reason || 'Menunggu area → sweep → MSS → candle close.' };
}

function asia() {
  const candles = closed('M15');
  const last = candles.at(-1);
  const now = last?.time ? (Number(last.time) > 1e11 ? Number(last.time) : Number(last.time) * 1000) + 15 * 60000 : Date.now();
  return calculateAsiaRange(candles, num(last?.close), now);
}

function asiaDraw(value) {
  if (!value?.valid) return value?.note || 'Asia Range belum lengkap.';
  if (value.active) return 'Asia Range masih berkembang.';
  const high = ['TERSAPU WICK','CLOSE BREAK','LEWAT LIVE'].includes(value.highStatus);
  const low = ['TERSAPU WICK','CLOSE BREAK','LEWAT LIVE'].includes(value.lowStatus);
  if (high && !low) return `Asia Low ${p2(value.low)} masih utuh.`;
  if (low && !high) return `Asia High ${p2(value.high)} masih utuh.`;
  if (high && low) return 'Kedua sisi Asia Range sudah diambil.';
  return 'Asia High dan Asia Low masih utuh.';
}

function target(result = state.result) {
  const execution = permission(result).execution;
  const tp = num(execution?.target2, execution?.tp2, execution?.target1, execution?.tp1);
  if (tp != null) return `Target execution ${p2(tp)}`;
  const draw = result?.liquidityHierarchy?.drawTarget || result?.drawTarget;
  const level = num(draw?.level, draw?.price);
  if (level != null) return `${draw?.type || draw?.label || 'Liquidity'} ${p2(level)}`;
  const info = structure(result);
  const bsl = num(result?.bsl);
  const ssl = num(result?.ssl);
  if (info.direction === 'BULLISH' && bsl != null) return `BSL ${p2(bsl)}`;
  if (info.direction === 'BEARISH' && ssl != null) return `SSL ${p2(ssl)}`;
  return 'Belum ada target struktural aktif.';
}

function sourceTime(result = state.result) {
  return closed(result?.tf || state.tf).at(-1)?.time || 0;
}

function patch(node, signature, html) {
  if (!node || node.dataset.claritySignature === signature) return;
  node.dataset.claritySignature = signature;
  node.innerHTML = html;
}

function installStyle() {
  if (document.getElementById('amy-mapping-clarity-style')) return;
  const style = document.createElement('style');
  style.id = 'amy-mapping-clarity-style';
  style.textContent = `details[data-stability-key="active-setup"]{display:none!important}.clarity-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:10px 0}.clarity-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.clarity-cell{padding:11px;border:1px solid rgba(148,163,184,.18);border-radius:11px;background:rgba(15,23,42,.58)}.clarity-cell small{display:block;color:#94a3b8;font-size:10px;text-transform:uppercase;margin-bottom:4px}.clarity-cell strong{display:block;color:#f8fafc;font-size:13px;line-height:1.35}.clarity-cell span{display:block;color:#cbd5e1;font-size:11px;line-height:1.45;margin-top:4px}.clarity-buy strong,.clarity-bullish strong{color:#4ade80}.clarity-sell strong,.clarity-bearish strong{color:#f87171}.clarity-wait strong{color:#fbbf24}.clarity-note{padding:10px 11px;border-radius:9px;background:rgba(30,41,59,.66);color:#cbd5e1;font-size:12px;line-height:1.55;margin:9px 0}.clarity-event{border-left:3px solid #38bdf8;background:rgba(14,116,144,.10)}.clarity-table-wrap{overflow:auto}.clarity-table{width:100%;min-width:900px;border-collapse:collapse;font-size:11px}.clarity-table th,.clarity-table td{padding:8px;border-bottom:1px solid rgba(148,163,184,.14);text-align:left;vertical-align:top}.clarity-table th{color:#94a3b8;font-size:10px;text-transform:uppercase}.clarity-evidence{font-size:10px;color:#94a3b8;line-height:1.45}.clarity-glossary{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.clarity-glossary span{padding:8px;background:rgba(30,41,59,.58);border-radius:8px;font-size:10px;color:#cbd5e1}@media(max-width:640px){.clarity-grid,.clarity-grid.two,.clarity-glossary{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
}

function renderOutlook() {
  const result = state.result;
  const details = document.querySelector('details[data-stability-key="market-outlook"],details.outlook-disclosure');
  if (!result || !details) return;
  const s = structure(result), f = forecast(result), e = permission(result), a = asia();
  const scenarios = (result.marketOutlook?.scenarios || []).filter(item => item?.setupType !== 'ASIA_ENTRY');
  if (result.marketOutlook) {
    result.marketOutlook.scenarios = scenarios;
    result.marketOutlook.canonicalAsia = { window:ASIA_WINDOW, high:a?.high, low:a?.low, highStatus:a?.highStatus, lowStatus:a?.lowStatus };
    result.marketOutlook.status = scenarios.length ? 'ACTIVE' : 'WAITING_EVENT';
  }
  const eventText = scenarios.length ? `${scenarios.length} event konteks aktif: ${scenarios.map(x => x.setupType).join(', ')}` : `Belum ada event khusus — struktur tetap ${s.direction}`;
  const badge = details.querySelector('.amy-level-summary-status');
  if (badge) badge.textContent = `${s.direction} · ${e.active ? e.value : 'WAIT ENTRY'}`;
  let panel = details.querySelector('.amy-trade-scenario-panel');
  if (!panel) { panel = document.createElement('div'); panel.className = 'amy-trade-scenario-panel'; details.appendChild(panel); }
  const signature = JSON.stringify([sourceTime(result),s,f,e.value,a?.high,a?.low,a?.highStatus,a?.lowStatus,scenarios.map(x=>[x.setupType,x.side,x.target])]);
  patch(panel, signature, `<section class="amy-level-panel ${e.active?'':'waiting'}">
    <p class="amy-level-intro">Struktur, Forecast, dan Entry Permission dipisahkan. Semua memakai candle terakhir yang sudah close.</p>
    <div class="clarity-grid">
      <div class="clarity-cell clarity-${s.direction.toLowerCase()}"><small>Struktur Saat Ini</small><strong>${esc(s.label)}</strong><span>Fase ${esc(s.phase)}</span></div>
      <div class="clarity-cell clarity-${f.direction.toLowerCase()}"><small>Forecast</small><strong>${f.active?esc(f.direction):'BELUM AKTIF'}</strong><span>${f.active?`Horizon ${esc(f.horizon)}`:'Struktur tidak berubah menjadi netral.'}</span></div>
      <div class="clarity-cell clarity-${e.value.toLowerCase()}"><small>Entry Permission</small><strong>${esc(e.value)}</strong><span>${esc(e.reason)}</span></div>
    </div>
    <div class="clarity-note clarity-event"><b>Status event:</b> ${esc(eventText)}.</div>
    <div class="clarity-grid two">
      <div class="clarity-cell"><small>Invalidasi Struktur</small><strong>${s.invalidation==null?'BELUM TERSEDIA':p2(s.invalidation)}</strong><span>${esc(s.rule)}</span></div>
      <div class="clarity-cell"><small>Target Struktural</small><strong>${esc(target(result))}</strong></div>
    </div>
    <div class="clarity-note"><b>Asia Session Context · ${ASIA_WINDOW}</b><br>${a?.valid?`High ${p2(a.high)} (${esc(a.highStatus)}) · Low ${p2(a.low)} (${esc(a.lowStatus)}). ${esc(asiaDraw(a))}`:esc(a?.note||'Belum tersedia.')}</div>
    <p class="amy-level-disclaimer">WAIT berarti belum ada izin entry, bukan market netral.</p>
    <p class="clarity-evidence">Backtest Juli 2026: 66 context event, target-zone reach 78,79%. Ini bukan win rate entry. Sumber ${esc(wita(sourceTime(result)))} WITA.</p>
  </section>`);
}

function renderSummary() {
  const result = state.result;
  const card = document.getElementById('amy-regime-router-v3');
  if (!result || !card) return;
  const s = structure(result), f = forecast(result), e = permission(result), source = sourceTime(result);
  card.querySelectorAll('.validated-context-strip,.reliability-grid').forEach(node => { if (!node.classList.contains('clarity-summary')) node.style.display='none'; });
  card.querySelectorAll('.professional-disclosure').forEach(node => { if (/Performa Historis Model/i.test(node.textContent||'')) node.style.display='none'; });
  let host = card.querySelector('.clarity-summary');
  if (!host) { host=document.createElement('div'); host.className='clarity-summary'; (card.querySelector('.regime-header')||card.firstElementChild)?.insertAdjacentElement('afterend',host); }
  patch(host, JSON.stringify([source,s,f,e.value,target(result)]), `<div class="market-health-title"><span>RINGKASAN MARKET</span><small>Struktur, forecast, izin entry, dan batas salah</small></div>
    <div class="clarity-grid two">
      <div class="clarity-cell clarity-${s.direction.toLowerCase()}"><small>Kondisi Struktur</small><strong>${esc(s.label)}</strong><span>Fase ${esc(s.phase)}</span></div>
      <div class="clarity-cell clarity-${f.direction.toLowerCase()}"><small>Forecast</small><strong>${f.active?esc(f.direction):'BELUM AKTIF'}</strong><span>${f.active?esc(f.horizon):'Tidak menghapus struktur.'}</span></div>
      <div class="clarity-cell clarity-${e.value.toLowerCase()}"><small>Entry Permission</small><strong>${esc(e.value)}</strong><span>${esc(e.reason)}</span></div>
      <div class="clarity-cell"><small>Invalidasi Struktur</small><strong>${s.invalidation==null?'BELUM TERSEDIA':p2(s.invalidation)}</strong><span>${esc(s.rule)}</span></div>
      <div class="clarity-cell"><small>Target Likuiditas</small><strong>${esc(target(result))}</strong></div>
      <div class="clarity-cell"><small>Sumber Analisis</small><strong>${esc(wita(source))} WITA</strong><span>Candle sudah close.</span></div>
    </div>
    <p class="clarity-evidence">Structural parity Juli 2026 100% pada 14.353 snapshot (konsistensi, bukan prediksi). Forecast 42,86% dari 7 event; sampel kecil. Outlook target-zone 78,79% dari 66 event; bukan win rate.</p>`);
}

function renderExplanation() {
  const result=state.result, details=document.querySelector('details[data-stability-key="mapping-explanation"]');
  if (!result || !details) return;
  const s=structure(result), f=forecast(result), e=permission(result), a=asia(), source=sourceTime(result);
  let host=details.querySelector('.clarity-explanation');
  if (!host) { [...details.children].forEach(child=>{if(child.tagName!=='SUMMARY')child.remove();}); host=document.createElement('section'); host.className='card clarity-explanation'; details.appendChild(host); }
  patch(host,JSON.stringify([source,s,f,e.value,a?.high,a?.low]),`<div class="kicker">PENJELASAN MAPPING</div><h2>Apa yang Sedang Terjadi?</h2>
    <div class="clarity-note"><b>1. Struktur:</b> ${esc(s.label)} · fase ${esc(s.phase)}. Ini kondisi market sekarang, bukan prediksi.</div>
    <div class="clarity-note"><b>2. Forecast:</b> ${f.active?`${esc(f.direction)} · ${esc(f.horizon)}`:'Belum aktif; struktur tetap berlaku.'}</div>
    <div class="clarity-note"><b>3. Entry Permission:</b> ${esc(e.value)} — ${esc(e.reason)}</div>
    <div class="clarity-note"><b>4. Invalidasi:</b> ${esc(s.rule)}</div>
    <div class="clarity-note"><b>5. Target:</b> ${esc(target(result))}</div>
    <div class="clarity-note"><b>6. Asia ${ASIA_WINDOW}:</b> ${a?.valid?`High ${p2(a.high)} (${esc(a.highStatus)}), Low ${p2(a.low)} (${esc(a.lowStatus)}). ${esc(asiaDraw(a))}`:esc(a?.note||'Belum tersedia.')}</div>
    <div class="clarity-note clarity-event"><b>Kesimpulan:</b> ${e.active?`Izin ${e.value} aktif.`:`Struktur ${s.direction}; entry masih WAIT.`}</div><p class="clarity-evidence">Sumber ${esc(wita(source))} WITA.</p>`);
}

function allTfRows() {
  const key=SUPPORTED_MAPPING_TIMEFRAMES.map(tf=>{const c=closed(tf),x=c.at(-1);return `${tf}:${c.length}:${x?.time||0}:${x?.close||0}`;}).join('|');
  if (key===tfCacheKey) return tfCache;
  tfCacheKey=key;
  tfCache=SUPPORTED_MAPPING_TIMEFRAMES.map(tf=>{
    const candles=closed(tf);
    if(candles.length<30)return{tf,missing:true};
    try{const result=analyze(candles,tf,{},candles.at(-1)?.close,{...state.candles});result.tf=tf;result.directionDecision||=buildDirectionDecision(result);result.setupExecution||=buildSetupExecution(result,{persist:false});return{tf,s:structure(result),f:forecast(result),e:permission(result)};}catch(error){return{tf,missing:true,error:error?.message};}
  });
  return tfCache;
}

function renderAllTf() {
  const details=document.querySelector('details[data-stability-key="mapping-all-timeframes"]');
  if(!details)return;
  const rows=allTfRows();
  let host=details.querySelector('.clarity-all-tf');
  if(!host){[...details.children].forEach(child=>{if(child.tagName!=='SUMMARY')child.remove();});host=document.createElement('section');host.className='card clarity-all-tf';details.appendChild(host);}
  const body=rows.map(row=>row.missing?`<tr><td><b>${esc(row.tf)}</b></td><td colspan="6">${esc(row.error||'Belum dimuat')}</td></tr>`:`<tr><td><b>${esc(row.tf)}</b></td><td><b>${esc(row.s.direction)}</b><br>${esc(row.s.label)}</td><td>${esc(row.s.phase)}</td><td>${row.s.invalidation==null?'—':p2(row.s.invalidation)}<br><small>${esc(row.s.rule)}</small></td><td>${row.f.active?esc(row.f.direction):'BELUM AKTIF'}<br><small>${row.f.active?esc(row.f.horizon):'Struktur tetap berlaku'}</small></td><td><b>${esc(row.e.value)}</b></td><td>${esc(row.e.reason)}</td></tr>`).join('');
  patch(host,JSON.stringify(rows),`<div class="kicker">ALL-TIMEFRAME MAPPING</div><h2>Struktur • Forecast • Entry Permission</h2><p class="clarity-note">WAIT pada Forecast atau Entry Permission tidak menghapus struktur bullish/bearish.</p><div class="clarity-table-wrap"><table class="clarity-table"><thead><tr><th>TF</th><th>Struktur Saat Ini</th><th>Fase</th><th>Invalidasi</th><th>Forecast</th><th>Entry Permission</th><th>Alasan</th></tr></thead><tbody>${body}</tbody></table></div>`);
}

function cleanup() {
  document.querySelectorAll('details[data-stability-key="active-setup"]').forEach(node=>node.remove());
  document.querySelectorAll('#app details').forEach(node=>{if(String(node.querySelector(':scope>summary')?.textContent||'').trim().startsWith('Setup Aktif'))node.remove();});
  document.querySelectorAll('[data-asia-range-analyze] .asia-strip-head span').forEach(node=>node.textContent='ASIA SESSION CONTEXT');
  document.querySelectorAll('[data-asia-range-analyze],[data-asia-range-dashboard]').forEach(node=>node.dataset.canonicalAsiaWindow=ASIA_WINDOW);
  const section=document.querySelector('details[data-stability-key="valid-break"] section');
  if(section&&!section.querySelector('.clarity-glossary')){const box=document.createElement('div');box.className='clarity-glossary';box.innerHTML='<span><b>INTERNAL:</b> transisi awal.</span><span><b>MAJOR:</b> struktur utama confirmed.</span><span><b>AT RISK:</b> break terancam gagal.</span><span><b>FAILED:</b> close kembali melewati level.</span>';section.appendChild(box);}
}

function sync(){queued=false;if(busy)return;busy=true;try{installStyle();cleanup();renderOutlook();renderSummary();renderExplanation();renderAllTf();}finally{busy=false;}}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(sync);}
function boot(){installStyle();const app=document.getElementById('app');if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true});['amyfx:candles-updated','amyfx:mapping-state-change','amyfx:entry-watch-updated','amyfx:execution-authority-updated','amyfx:market-update'].forEach(name=>window.addEventListener(name,schedule));schedule();}

window.AmyFXMappingClarity=Object.freeze({version:'1.0.0',canonicalAsiaWindow:ASIA_WINDOW,refresh:schedule,snapshot:()=>({structure:structure(),forecast:forecast(),entryPermission:permission().value,asia:asia()})});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
