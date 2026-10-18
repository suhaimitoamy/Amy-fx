import {deviceHeaders,initializeMethods,methodControls} from '../method-toggles.js';
import {engineFresh,setupList,setupView,loadSetups,timestamp,terminal} from './scalper-model.js';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const price=value=>value?Number(value).toFixed(2):'—';
const time=value=>timestamp(value)?new Date(timestamp(value)).toLocaleString('id-ID',{timeZone:'Asia/Makassar',hour12:false})+' WITA':'—';
let payload=null,failed=false,generation=0,controller=null,timer=null,selectedId='',filter='ALL',signature='';
function route(){try{const hash=location.hash;selectedId=new URLSearchParams(location.search).get('setup_id')||(hash.startsWith('#scalper=')?decodeURIComponent(hash.slice(9)):'');}catch{selectedId='';}}
function card(s){const entryRows=[['Entry',s.entry],['Stop loss (Swing)',s.sl],['TP1',s.tp1],['TP2 / Target Likuiditas',s.tp2||s.target2]];if(s.marketEntry&&s.limitEntry&&s.marketEntry!==s.limitEntry){entryRows.unshift(['Market Entry',s.marketEntry]);}return `<div class="scalper-setup" data-side="${esc(s.direction)}"><div class="section-heading"><h3>${esc(s.direction||'WAIT')} · ${esc(s.driverName||s.model)} · ${esc(s.timeframe)}</h3><span>${esc(s.label)}</span></div><p>${esc(s.note)}</p><dl>${entryRows.map(([k,v])=>`<div><dt>${k}</dt><dd>${price(v)}</dd></div>`).join('')}</dl><p>Zona ${price(s.zoneBottom)}–${price(s.zoneTop)} · R:R target ${s.rr?s.rr.toFixed(2)+'R':'—'}${s.realRr&&Math.abs(s.realRr-s.rr)>0.3?` (Potensi Likuiditas: ${s.realRr.toFixed(2)}R)`:''}</p><p>${esc(s.reason||s.stopBasis||'Alasan rinci belum diberikan server.')} ${s.tp1Hit?'TP1 telah tercapai.':''}</p><small>Sinyal ${time(s.signalCandleCloseTime)} · evaluasi ${time(s.lastEvaluatedOpenTime)}</small>${s.geometry&&!terminal.has(s.status)?`<p><button data-scalper-select="${esc(s.id)}" aria-pressed="${selectedId===s.id}">${selectedId===s.id?'Ditampilkan di peta':'Lihat level di peta harga'}</button></p>`:''}</div>`;}
function render(){
  const fresh=!failed&&engineFresh(payload),items=setupList(payload,fresh),shown=items.filter(s=>filter==='ALL'||s.direction===filter);
  $('scalper-state').textContent=failed?'Koneksi gagal · WAIT':!payload?'Menghubungkan':fresh?'Server terkini':'Data server terlambat · WAIT';
  $('scalper-source').textContent=`Evaluasi server: ${time(payload?.engine?.completed_at)}. Semua timeframe strategi ditampilkan; pilihan M5/M15 hanya mengubah peta candle.`;
  $('scalper-summary').textContent=items.length?`${items.filter(s=>s.direction==='BUY').length} setup BUY · ${items.filter(s=>s.direction==='SELL').length} setup SELL · ${items.filter(s=>s.actionable).length} aktif dengan data terkini`:'Belum ada setup BUY/SELL dari server. Tunggu scan berikutnya; periksa koneksi dan metode aktif.';
  const markup=shown.map(card).join('')||'<p>Tidak ada setup untuk filter ini.</p>';
  if(signature!==markup){$('scalper-setups').innerHTML=markup;signature=markup;}
  $('scalper-history').innerHTML=(payload?.history||[]).filter(s=>s.symbol==='XAU/USD').slice(0,20).map(s=>card(setupView(s,false))).join('')||'<p>Belum ada riwayat dalam respons 24 jam terakhir.</p>';
  const selected=items.find(s=>s.id===selectedId);
  $('scalper-selected-note').textContent=selected?`${selected.direction} ${selected.timeframe} · ${selected.label}. Garis adalah referensi setup server.`:'Pilih satu setup untuk menampilkan entry, SL, TP1 dan TP2 di peta harga.';
  window.dispatchEvent(new CustomEvent('amyfx:scalper-chart-plan',{detail:selected?.geometry?{id:selected.id,direction:selected.direction,entry:selected.entry,sl:selected.sl,tp1:selected.tp1,tp:selected.tp2,label:selected.label}:null}));
  const requested=payload?.selected;
  $('scalper-requested').innerHTML=requested&&!items.some(s=>s.id===requested.id)?`<h3>Setup dari notifikasi</h3>${card(setupView(requested,fresh))}`:'';
}
export function isWeekendClosure(timeSec = Date.now() / 1000) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short'
    }).formatToParts(new Date(timeSec * 1000));
    const values = Object.fromEntries(parts.map(x => [x.type, x.value]));
    const weekday = values.weekday, hour = Number(values.hour) + Number(values.minute) / 60;
    if (weekday === 'Sat') return true;
    if (weekday === 'Sun') return hour < 17;
    if (weekday === 'Fri') return hour >= 17;
    return false;
  } catch (_) {
    const d = new Date(timeSec * 1000), day = d.getUTCDay();
    return day === 6 || day === 0;
  }
}

function schedule() {
  clearTimeout(timer);
  if (isWeekendClosure()) {
    // Pasar libur akhir pekan: hindari polling spam 30s ke server (Item 1.49)
    if (!document.hidden) timer = setTimeout(refresh, 900000);
    return;
  }
  if (!document.hidden) timer = setTimeout(refresh, 30000);
}
async function refresh(){
  const id=++generation;controller?.abort();controller=new AbortController();const request=controller;
  const timeout=setTimeout(()=>request.abort(),15000);$('scalper-refresh').disabled=true;
  try{
    const data=await loadSetups({headers:deviceHeaders(),signal:request.signal,selectedId});
    if(id!==generation)return;
    // An absent active ID is no longer active; never resurrect it from cached rows.
    payload=data;failed=false;render();
  }catch{if(id!==generation)return;failed=true;render();}
  finally{clearTimeout(timeout);if(id===generation){$('scalper-refresh').disabled=false;schedule();}}
}
if(typeof window!=='undefined'&&typeof document!=='undefined'){
  $('scalper-refresh')?.addEventListener('click',refresh);
  $('scalper-setups')?.addEventListener('click',event=>{const button=event.target.closest('[data-scalper-select]');if(!button)return;selectedId=button.dataset.scalperSelect;render();$('chart')?.scrollIntoView({behavior:'smooth',block:'center'});});
  $('scalper-filter')?.addEventListener('change',event=>{filter=event.target.value;render();});
  $('scalper-clear')?.addEventListener('click',()=>{selectedId='';render();});
  if($('scalper-methods'))$('scalper-methods').innerHTML=methodControls();
  window.addEventListener('amy-method-toggles',()=>{if($('scalper-methods'))$('scalper-methods').innerHTML=methodControls();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;controller?.abort();clearTimeout(timer);}else{render();refresh();}});
  window.addEventListener('pagehide',()=>{generation++;controller?.abort();clearTimeout(timer);});
  window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});
  window.addEventListener('online',refresh);
  window.addEventListener('offline',()=>{failed=true;render();});
  window.addEventListener('hashchange',()=>{route();refresh();});
  route();render();refresh();
  // Reuse existing per-device preferences; do not wait on them to render the page.
  void initializeMethods().then(refresh);
}
