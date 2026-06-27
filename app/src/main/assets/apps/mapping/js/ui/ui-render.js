import { state, TF, p2, nowTime, sessions, curSession } from '../main.js';
import { runAnalysis } from '../api/market-data.js';
import { analyze } from '../engine/ict-core.js';
import { saveConnect, toggleBg, testNotif, downloadLogs } from '../bridge/android-bridge.js';

export function killzonePanel(){let list=sessions(),cur=curSession();return`<section class="card"><div class="kicker">ICT KILLZONE</div><h2>Session & Killzone</h2><div class="muted">WIB ${nowTime()}</div><div class="session-pill ${cur.active?'active':''}">${cur.active?'Aktif: '+cur.name:'Off-Session'}</div><div class="killzone-grid">${list.map(s=>`<div class="killzone-item ${s.active?'active':''}"><b>${s.active?'🟢 ':'⚪ '}${s.name}</b><small>WIB ${s.wib}</small></div>`).join('')}</div></section>`}

export function fmtDir(x){x=String(x||'');return x.replace(/BUY WATCH/g,'FOKUS BUY').replace(/SELL WATCH/g,'FOKUS SELL').replace(/^WAIT$/g,'TUNGGU');}
export function fmtStatus(x){x=String(x||'');return x.replace(/READY SETUP/g,'SETUP VALID').replace(/WATCH SETUP/g,'PANTAU SETUP').replace(/^WAIT$/g,'TUNGGU');}
export function dirClass(x){x=String(x||'');return x.includes('BUY')?'buy':x.includes('SELL')?'sell':'wait';}

export function setupCard(s,i=0){return`<div class="setup-card"><div class="setup-head"><div><div class="setup-title">SETUP ${i+1} — ${s.type}</div><div class="muted">Timeframe: ${s.tf} • Status: ${fmtStatus(s.status)}</div></div><span class="badge ${String(s.dir).includes('BUY')?'buy':'sell'}">${fmtDir(s.dir)}</span></div><div class="num-grid"><div class="num"><small>Score</small><strong>${s.score}/100</strong></div><div class="num"><small>Harga Sekarang</small><strong>${p2(s.price)}</strong></div><div class="num"><small>Entry Area</small><strong>${p2(s.entryLow)} - ${p2(s.entryHigh)}</strong></div><div class="num"><small>SL</small><strong>${p2(s.sl)}</strong></div><div class="num"><small>TP1</small><strong>${p2(s.tp1)}</strong></div><div class="num"><small>TP2</small><strong>${p2(s.tp2)}</strong></div></div><div class="reason"><b>Alasan:</b><br>${s.reason}</div></div>`}

export function dashboard(){let r=state.result,s=r?.bestSetup;return`<section class="hero card"><div><div class="kicker">AMY FX SETUP ENGINE</div><h1>XAU/USD</h1><div class="muted">WIB ${nowTime()}</div></div><div style="text-align:right"><div class="muted">Gold Price</div><div class="price">$${p2(state.price)}</div><div class="${state.conn==='Connected'?'green':'muted'}">${state.conn}</div></div></section>${killzonePanel()}<button class="action" onclick="setTab('Analyze')" style="width:100%;margin-bottom:16px">⚡ Analisis Setup</button><section class="card"><h2>Best Setup</h2>${s?setupCard(s,0):'<p class="muted">Belum ada setup. Klik Analisis Setup.</p>'}</section><section class="card"><h2>Market Concepts</h2><div class="concept-grid">${(r?.concepts||[]).map(c=>`<div class="concept"><small>${c[1]}</small><h3>${c[0]}</h3><p>${c[2]}</p></div>`).join('')||'<p class="muted">Belum ada analisis.</p>'}</div></section>`}

export function mapMini(tf){
  let cs=state.candles?.[tf]||[];
  if(!cs.length||cs.length<30)return null;
  try{return analyze(cs,tf,{},state.price)}catch(e){return null}
}
export function mapConcept(a,name){
  return (a?.concepts||[]).find(x=>x[0]===name)||null
}
export function mapBiasClass(x){
  x=String(x||'NEUTRAL').toLowerCase();
  return x.includes('bull')?'bullish':x.includes('bear')?'bearish':'neutral'
}
export function m1h4List(){
  return ['M1','M5','M15','M30','H1','H4'].map(tf=>({tf,a:mapMini(tf)}))
}
export function activeBias(){
  let rows=m1h4List().filter(x=>x.a);
  let bull=rows.filter(x=>x.a.final==='BULLISH').length;
  let bear=rows.filter(x=>x.a.final==='BEARISH').length;
  if(bull>=bear+2)return 'BULLISH';
  if(bear>=bull+2)return 'BEARISH';
  if(bull||bear)return 'MIXED / CONFLICT';
  return 'NEUTRAL';
}

export function analyzeLivePrice(){
  return Number(state.price||localStorage.getItem('last_price')||state.result?.price||0)
}
export function analyzeSetupLiveState(s){
  if(!s)return{status:'TUNGGU',fatal:false,note:'Belum ada setup aktif.'}
  const price=analyzeLivePrice()
  if(!price)return{status:fmtStatus(s.status),fatal:false,note:'Harga live belum tersedia.'}
  const dir=String(s.dir||''),isBuy=dir.includes('BUY'),isSell=dir.includes('SELL')
  const lo=Math.min(Number(s.entryLow),Number(s.entryHigh)),hi=Math.max(Number(s.entryLow),Number(s.entryHigh))
  const sl=Number(s.sl),tp1=Number(s.tp1),tp2=Number(s.tp2)
  if(isBuy&&Number.isFinite(sl)&&price<=sl)return{status:'SL HIT / INVALID',fatal:true,note:`Setup BUY invalid karena harga live ${p2(price)} sudah di bawah SL ${p2(sl)}.`}
  if(isSell&&Number.isFinite(sl)&&price>=sl)return{status:'SL HIT / INVALID',fatal:true,note:`Setup SELL invalid karena harga live ${p2(price)} sudah di atas SL ${p2(sl)}.`}
  if(isBuy&&((Number.isFinite(tp2)&&price>=tp2)||(Number.isFinite(tp1)&&price>=tp1)))return{status:'TP HIT',fatal:true,note:`Target BUY sudah tercapai di harga live ${p2(price)}.`}
  if(isSell&&((Number.isFinite(tp2)&&price<=tp2)||(Number.isFinite(tp1)&&price<=tp1)))return{status:'TP HIT',fatal:true,note:`Target SELL sudah tercapai di harga live ${p2(price)}.`}
  if(Number.isFinite(lo)&&Number.isFinite(hi)&&price>=lo&&price<=hi)return{status:'DALAM AREA',fatal:false,note:`Harga live ${p2(price)} sedang berada di area entry.`}
  return{status:'MENUNGGU ENTRY',fatal:false,note:`Harga live ${p2(price)} belum berada di area entry ${p2(lo)} - ${p2(hi)}.`}
}
export function analyzeActiveSetups(list){
  return (list||[]).filter(s=>!analyzeSetupLiveState(s).fatal)
}
export function renderAnalyzeLive(){
  if(state.tab==='Analyze'&&state.result)render()
  else renderSoft()
}

export function decisionData(){
  let r=state.result,s=r?.bestSetup,bias=activeBias();
  if(!r)return{bias:'-',direction:'TUNGGU',confidence:0,status:'TUNGGU',entry:'-',invalid:'-',target:'-',reason:'Klik timeframe untuk membuat keputusan mapping.'};
  let live=s?analyzeSetupLiveState(s):null;
  if(s&&live?.fatal)return{bias,direction:'TUNGGU',confidence:0,status:live.status,entry:`${p2(s.entryLow)} - ${p2(s.entryHigh)}`,invalid:p2(s.sl),target:'-',reason:live.note+' Tunggu setup baru.'};
  let rawDir=s?.dir||r.signal||'WAIT';
  let focus=fmtDir(rawDir);
  let score=s?.score||r.score||0;
  let aligned=(bias==='BULLISH'&&String(rawDir).includes('BUY'))||(bias==='BEARISH'&&String(rawDir).includes('SELL'));
  let conflict=bias.includes('CONFLICT');
  let confidence=Math.max(0,Math.min(95,Math.round(score+(aligned?8:0)-(conflict?12:0))));
  if(conflict&&confidence<70)focus='TUNGGU';
  let target='-';
  if(s)target=String(rawDir).includes('BUY')?`BSL ${p2(r.bsl)}`:`SSL ${p2(r.ssl)}`;
  let reason=s?`Bias aktif ${bias}. Setup utama membaca ${s.type}. ${live?live.note:''} Area entry ${p2(s.entryLow)} - ${p2(s.entryHigh)}, invalidasi ${p2(s.sl)}, target ${target}.`:`Bias aktif ${bias}. Belum ada setup aktif yang aman, jadi fokus utama adalah menunggu konfirmasi baru.`;
  return{bias,direction:s?focus:'TUNGGU',confidence:s?confidence:0,status:s?(live?.status||fmtStatus(s.status)):'TUNGGU',entry:s?`${p2(s.entryLow)} - ${p2(s.entryHigh)}`:'-',invalid:s?p2(s.sl):'-',target,reason}
}
export function amyDecisionCard(){
  let d=decisionData();
  return`<section class="card"><div class="kicker">AMY FX DECISION</div><div class="decision-main ${dirClass(d.direction)}">${d.direction}</div><div class="decision-grid">
    <div class="decision-box"><small>Active Bias</small><strong>${d.bias}</strong></div>
    <div class="decision-box"><small>Confidence</small><strong>${d.confidence}%</strong></div>
    <div class="decision-box"><small>Status</small><strong>${d.status}</strong></div>
    <div class="decision-box"><small>Entry Area</small><strong>${d.entry}</strong></div>
    <div class="decision-box"><small>Invalidation</small><strong>${d.invalid}</strong></div>
    <div class="decision-box"><small>Target</small><strong>${d.target}</strong></div>
  </div><div class="decision-reason"><b>Reason:</b><br>${d.reason}</div></section>`
}

export function validBreakInfo(){
  let r=state.result,tf=r?.tf,cs=state.candles?.[tf]||[],last=cs.at(-1),br=r?.st?.last,price=analyzeLivePrice();
  if(!r||!last||!br)return`<section class="card"><div class="kicker">VALID BREAK INFO</div><h2>Belum Ada Valid Break</h2><div class="break-reason">Belum ada BOS/CHOCH yang cukup jelas. Tunggu candle close yang valid.</div></section>`;
  let breakCandle=cs[br.index]||last;
  let bullish=br.dir==='BULLISH';
  let valid=bullish?breakCandle.close>br.price:breakCandle.close<br.price;
  let failed=price&&valid?(bullish?price<br.price:price>br.price):false;
  let liveWarning=price&&!valid?(bullish?price>br.price:price<br.price):false;
  let direction=bullish?'FOKUS BUY':'FOKUS SELL';
  let title=failed?'BREAK FAILED':valid?'VALID BREAK':liveWarning?'LIVE BREAK WARNING':'BELUM VALID';
  let conclusion=failed?`Break gagal dipertahankan karena harga live ${p2(price)} kembali melewati level ${p2(br.price)}. Tunggu mapping ulang.`
    :valid?`Candle break sudah close valid. ${direction} masih relevan selama level break bertahan.`
    :liveWarning?`Harga live sudah melewati level break, tapi candle close belum confirm. Tunggu candle close yang valid.`
    :`Harga belum close valid melewati level ${p2(br.price)}. Tunggu konfirmasi candle close.`;
  return`<section class="card"><div class="kicker">VALID BREAK INFO</div><h2>${title}</h2><div class="break-grid">
    <div class="break-box"><small>Break Level</small><strong>${p2(br.price)}</strong></div>
    <div class="break-box"><small>Candle Break Close</small><strong>${p2(breakCandle.close)}</strong></div>
    <div class="break-box"><small>Harga Live</small><strong>${p2(price)}</strong></div>
    <div class="break-box"><small>Structure</small><strong>${br.kind} ${br.dir}</strong></div>
  </div><div class="break-reason"><b>Kesimpulan:</b><br>${conclusion}</div></section>`
}

export function m1h4MappingTable(){
  const rows=m1h4List().map(({tf,a})=>{
    if(!a)return`<tr><td>${tf}</td><td colspan="6" class="muted">Belum dimuat</td></tr>`;
    let ob=mapConcept(a,'OB'),fvg=mapConcept(a,'FVG');
    let status=a.bestSetup?`${fmtDir(a.bestSetup.dir)} ${a.bestSetup.score}/100`:fmtDir(a.signal);
    return`<tr><td>${tf}</td><td><span class="map-bias ${mapBiasClass(a.final)}">${a.final}</span></td><td>${p2(a.bsl)}</td><td>${p2(a.ssl)}</td><td>${ob?ob[2]:'-'}</td><td>${fvg?fvg[2]:'-'}</td><td>${status}</td></tr>`;
  }).join('');
  return`<section class="card"><div class="kicker">M1–H4 MAPPING TABLE</div><h2>BSL • SSL • OB • FVG</h2><div class="map-table-wrap"><table class="map-table"><thead><tr><th>TF</th><th>Bias</th><th>BSL</th><th>SSL</th><th>OB</th><th>FVG</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></section>`
}

export function aiMappingExplanation(){
  let r=state.result,s=r?.bestSetup;
  if(!r)return`<section class="card"><div class="kicker">MAPPING NOTES</div><h2>Amy FX Mapping Explanation</h2><div class="ai-map-note muted">Klik timeframe untuk membuat penjelasan mapping.</div></section>`;
  let liq=mapConcept(r,'Liquidity');
  let live=s?analyzeSetupLiveState(s):null;
  if(s&&live?.fatal)return`<section class="card"><div class="kicker">MAPPING NOTES</div><h2>Amy FX Mapping Explanation</h2><div class="ai-map-note"><p>Setup ${s.tf} sebelumnya membaca <b>${s.type}</b> dengan arah <b>${fmtDir(s.dir)}</b>.</p><p><b>${live.status}</b>: ${live.note}</p><p>Kesimpulan: setup aktif tidak layak dipakai. Tunggu mapping ulang atau setup baru.</p></div></section>`;
  if(!s)return`<section class="card"><div class="kicker">MAPPING NOTES</div><h2>Amy FX Mapping Explanation</h2><div class="ai-map-note"><p>Mapping ${r.tf} menunjukkan bias utama <b>${r.final}</b> dengan posisi harga berada di area <b>${r.zone}</b>.</p><p>Liquidity terdekat: <b>${liq?liq[2]:`BSL ${p2(r.bsl)} | SSL ${p2(r.ssl)}`}</b>.</p><p>Kesimpulan: belum ada setup angka yang cukup kuat. Tunggu OB, FVG, sweep liquidity, atau displacement yang lebih jelas.</p></div></section>`;
  return`<section class="card"><div class="kicker">MAPPING NOTES</div><h2>Amy FX Mapping Explanation</h2><div class="ai-map-note">
    <p>Mapping ${s.tf} sedang membaca <b>${s.type}</b> dengan arah <b>${fmtDir(s.dir)}</b>. Harga sekarang berada di sekitar <b>${p2(analyzeLivePrice()||s.price)}</b>.</p>
    <p>Area entry utama berada di <b>${p2(s.entryLow)} - ${p2(s.entryHigh)}</b>. ${live?live.note:''}</p>
    <p>Liquidity yang sedang diperhatikan adalah <b>BSL ${p2(r.bsl)}</b> dan <b>SSL ${p2(r.ssl)}</b>.</p>
    <p>Invalidasi berada di <b>${p2(s.sl)}</b>. Target awal berada di <b>${p2(s.tp1)}</b>, lalu target lanjutan di <b>${p2(s.tp2)}</b>.</p>
    <p>Kesimpulan: <b>${live?.status||fmtStatus(s.status)}</b>. Jangan paksa entry sebelum harga memberi konfirmasi di area mapping.</p>
  </div></section>`;
}

export function analyzeView(){
  const active=analyzeActiveSetups(state.result?.setups||[]);
  return`<section class="card"><div class="tf-grid">${Object.keys(TF).map(x=>`<button class="${state.tf===x?'active':''}" onclick="window.runAnalysis('${x}')">${x}</button>`).join('')}</div></section>
  ${amyDecisionCard()}
  ${validBreakInfo()}
  ${m1h4MappingTable()}
  ${aiMappingExplanation()}
  <section class="card"><h2>Setup Aktif</h2>${active.map(s => setupCard(s, 0)).join('')||'<p class="muted">Belum ada setup aktif yang aman. Tunggu mapping baru.</p>'}</section>`
}

export function setupsView(){let list=state.setups.slice(0,20);return`<section class="card"><h1>Riwayat Setup</h1>${list.map(s => setupCard(s, 0)).join('')||'<p class="muted">Belum ada setup tersimpan.</p>'}</section>`}
export function historyView(){return`<section class="card"><h1>Event Logs</h1><button class="action" onclick="window.downloadLogs()">⇩ Download TXT</button>${state.logs.map(x=>`<div class="log">${x}</div>`).join('')||'<p class="muted">Belum ada event.</p>'}</section>`}
export function settingsView(){return`<section class="card settings"><h1>Settings & API</h1><label>Twelve Data API Key</label><input id="apiKey" value="${state.key}" placeholder="Twelve Data API key"><button class="action" onclick="window.saveConnect()" style="width:100%">🔑 Save & Connect</button><p class="muted">API key disimpan lokal di HP.</p><div class="warn"><b>Background Scanner</b><br>Jika ON, scanner akan memantau Entry Area setup terbaik dari Mapping saat aplikasi ditutup.</div><button class="${state.bg?'action':'chip'}" onclick="window.toggleBg()" style="width:100%;margin-top:14px">${state.bg?'📡 Background Scanner ON':'📴 Background Scanner OFF'}</button><button class="action" onclick="window.testNotif()" style="width:100%;margin-top:12px">🔔 Tes Notifikasi Setup</button></section>`}

export function render(){
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));
  document.getElementById('conn').textContent=state.conn;
  document.getElementById('conn').className='status '+(state.conn==='Connected'?'on':'');
  document.getElementById('app').innerHTML=state.tab==='Dashboard'?dashboard():state.tab==='Analyze'?analyzeView():state.tab==='Setups'?setupsView():state.tab==='History'?historyView():settingsView();
}
export function renderSoft(){
  let c=document.getElementById('conn');
  if(c){c.textContent=state.conn;c.className='status '+(state.conn==='Connected'?'on':'')}
  let p=document.querySelector('.price');
  if(p)p.textContent='$'+p2(state.price);
}
export function applyAmyFxRoute(){
  let route='';
  try{route=decodeURIComponent((location.hash||'').replace(/^#/,''))}catch(e){}
  try{route=route||new URLSearchParams(location.search||'').get('route')||''}catch(e){}
  try{route=route||localStorage.getItem('amyfx.notification.route')||''}catch(e){}
  if(['Dashboard','Analyze','Setups','History','Settings'].includes(route)){
    state.tab=route;
    try{localStorage.removeItem('amyfx.notification.route')}catch(e){}
  }
}
