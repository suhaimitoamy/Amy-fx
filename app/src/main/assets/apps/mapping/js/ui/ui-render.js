import { state, TF, p2, nowTime, sessions, curSession } from '../main.js';
import { runAnalysis, buildDirectionDecision, buildMappingExplanation, buildSetupExecution } from '../api/market-data.js';
import { analyze } from '../engine/ict-core.js';
import { saveConnect, toggleBg, testNotif, downloadLogs } from '../bridge/android-bridge.js';
import { renderSetupLifecycle } from './setup-lifecycle.js';

export function killzonePanel(){let list=sessions(),cur=curSession(),focus=list.filter(s=>s.name.includes('London Open')||s.name.includes('New York Open'));return`<section class="card session-card"><div class="section-row"><div><div class="kicker">SESI TRADING</div><h2>Session focus</h2></div><span class="muted" id="kz-wib">WIB ${nowTime()}</span></div><div class="session-pill ${cur.active?'active':''}">${cur.active?'Aktif: '+cur.name:'Off-Session'}</div><div class="session-grid">${focus.map(s=>`<div class="session-focus ${s.active?'active':''}"><b>${s.active?'● ':'○ '}${s.name.replace(' Kill Zone','')}</b><small>${s.wib} WIB</small><span>${s.active?'Aktif sekarang':'Menunggu sesi'}</span></div>`).join('')}</div></section>`}

export function fmtDir(x,status='',cf=''){x=String(x||'');let d=x.includes('BUY')?'BUY':x.includes('SELL')?'SELL':'';if(!d)return 'TUNGGU';if(status.includes('SL HIT')||status.includes('TP HIT')||status.includes('EXPIRED'))return `ABAIKAN ${d}`;if(status==='INVALID'||status==='BROKEN'||status==='WAIT'||cf==='FATAL')return `WAIT ${d}`;if(cf==='HIGH'||cf==='MEDIUM')return `BIAS ${d}`;if(status==='WATCH SETUP'||status==='PANTAU SETUP')return `WATCH ${d}`;return `FOKUS ${d}`;}
export function fmtStatus(x){x=String(x||'');return x.replace(/READY SETUP/g,'SETUP VALID').replace(/WATCH SETUP/g,'PANTAU SETUP').replace(/^WAIT$/g,'TUNGGU');}
export function dirClass(x){x=String(x||'');return x.includes('BUY')?'buy':x.includes('SELL')?'sell':'wait'}

export function setupCard(s, se, i = 0, mode = 'ACTIVE') {
  if (mode === 'HISTORY' || !se || !se.active) {
    return historyCard(s, i);
  }

  let q = s?.qualityLabel ? `<b>Quality: ${s.qualityLabel}</b> — ` : '';
  let ce = s?.ce ? `<br><small>CE Level: ${p2(s.ce)}</small>` : '';
  let comp = '';
  if (s?.components) {
    let c = s.components;
    comp = `<div class="num-grid" style="margin-top:10px;border-top:1px solid #333;padding-top:10px">
      <div class="num"><small>Model</small><strong>${c.model}</strong></div>
      <div class="num"><small>Sweep</small><strong>${c.sweep}</strong></div>
      <div class="num"><small>MSS</small><strong>${c.mss}</strong></div>
      <div class="num"><small>Entry</small><strong>${c.entry}</strong></div>
      <div class="num"><small>HTF</small><strong>${c.htf}</strong></div>
    </div>`;
  }
  let chk = '';
  if (s?.scoreChecklist) {
    let list = s.scoreChecklist.map(x => `<div style="font-size:12px;margin:2px 0"><span style="color:${x.passed ? '#4ade80' : '#f87171'}">${x.passed ? '✓' : '×'}</span> ${x.name} <span class="muted">+${x.score}</span></div>`).join('');
    chk = `<div style="margin-top:10px;border-top:1px solid #333;padding-top:10px"><b>Checklist Score: ${s.score || 0}/100 — Grade ${s.grade || ''}</b><br>${list}</div>`;
  }
  let sess = '';
  if (s?.sessionContext) {
    let sc = s.sessionContext;
    sess = `<div class="ai-map-note" style="margin-top:10px;font-size:12px;background:#1a1a1a;padding:8px;border-radius:4px"><b>Session: ${sc.session.replace('_', ' ')}</b> — ${sc.killzone !== 'NONE' ? 'Killzone Aktif. ' : ''}${sc.note}</div>`;
  }
  let cfHtml = '';
  if (s?.conflictCheck) {
    let cf = s.conflictCheck, badge = cf.conflictLevel === 'NONE' ? '#4ade80' : cf.conflictLevel === 'FATAL' || cf.conflictLevel === 'HIGH' ? '#f87171' : '#fbbf24', cNotes = cf.conflicts.length ? cf.conflicts.map(x => x.note).join('<br>') : 'Komponen utama selaras.';
    cfHtml = `<div style="margin-top:10px;border-top:1px solid #333;padding-top:10px;font-size:12px"><b>Conflict: <span style="color:${badge}">${cf.conflictLevel}</span> — ${cf.recommendation}</b><br><span class="muted">${cNotes}</span></div>`;
  }

  const tpHtml = se.singleTarget
    ? `<div class="num" style="grid-column: span 2"><small>Target Utama</small><strong>${p2(se.target1)}</strong></div>`
    : `<div class="num"><small>TP1</small><strong>${p2(se.target1)}</strong></div><div class="num"><small>TP2</small><strong>${se.target2 ? p2(se.target2) : '-'}</strong></div>`;

  return `<div class="setup-card ready">
    <div class="setup-head">
      <div>
        <div class="setup-title">SETUP AKTIF — ${s?.type || 'Entry Map'}</div>
        <div class="muted">Timeframe: ${se.tf || state.tf} • Status: ${se.status}</div>
      </div>
      <span class="badge ${se.direction === 'BUY' ? 'buy' : 'sell'}">FOKUS ${se.direction}</span>
    </div>
    <div class="num-grid">
      <div class="num"><small>Harga Live</small><strong>$${p2(state.price)}</strong></div>
      <div class="num"><small>Entry Area</small><strong>${p2(se.entryLow)} - ${p2(se.entryHigh)}</strong></div>
      <div class="num"><small>SL</small><strong>${p2(se.stopLoss)}</strong></div>
      ${tpHtml}
    </div>
    ${comp}${cfHtml}${chk}${sess}
    <div class="reason" style="margin-top:10px">
      <b>Alasan:</b><br>${q}${s?.reason || ''}${ce}
    </div>
  </div>`;
}

export function historyCard(s, i = 0) {
  if (!s) return '';
  const lo = s.entryLow != null ? p2(s.entryLow) : '-';
  const hi = s.entryHigh != null ? p2(s.entryHigh) : '-';
  const sl = s.sl != null ? p2(s.sl) : '-';
  const tp1 = s.tp1 != null ? p2(s.tp1) : '-';
  const tp2 = s.tp2 != null ? p2(s.tp2) : '-';

  return `<div class="setup-card wait">
    <div class="setup-head">
      <div>
        <div class="setup-title">RIWAYAT SETUP ${i + 1} — ${s.type || 'Entry Map'}</div>
        <div class="muted">Timeframe: ${s.tf || state.tf} • Status: TERMINAL / HISTORY</div>
      </div>
      <span class="badge wait">HISTORY / TERMINAL</span>
    </div>
    <div class="num-grid">
      <div class="num"><small>Data Historis Entry</small><strong>${lo} - ${hi}</strong></div>
      <div class="num"><small>Data Historis SL</small><strong>${sl}</strong></div>
      <div class="num"><small>Data Historis TP1</small><strong>${tp1}</strong></div>
      <div class="num"><small>Data Historis TP2</small><strong>${tp2}</strong></div>
    </div>
    <div class="reason" style="margin-top:10px">
      <b>Catatan Riwayat:</b><br>${s.reason || 'Setup ini telah selesai atau digantikan.'}
    </div>
  </div>`;
}

export function dashboard() {
  let r = state.result;
  const se = r ? buildSetupExecution(r) : null;
  if (r) {
    r.setupExecution = se;
    r.mappingExplanation = buildMappingExplanation(r);
  }
  let dec = decisionData();
  let tfList = ['M15', 'H1', 'H4', 'D1'];
  let setupTitle = (se && se.active) ? (r?.bestSetup?.type || 'Setup Entry Map') : 'Belum ada setup';
  let setupBody = '';
  if (se && se.active) {
    setupBody = `<div class="setup-summary"><div><small>Entry Area</small><strong>${p2(se.entryLow)} – ${p2(se.entryHigh)}</strong></div><div><small>Invalidasi</small><strong>${p2(se.stopLoss)}</strong></div><div><small>Target</small><strong>${p2(se.target1)}</strong></div><div><small>Status</small><strong>${se.status}</strong></div></div><p class="summary-note">${se.invalidationReason || 'Setup searah Direction Forecast yang tervalidasi.'}</p>`;
  } else {
    setupBody = `<p class="muted">${se?.invalidationReason || 'Klik Analisis Setup untuk membuat mapping angka.'}</p>`;
  }
  return `<section class="hero card mapping-hero"><div><div class="kicker">AMY FX MAPPING</div><h1>XAU/USD</h1><div class="muted" id="top-wib">${state.conn === 'Connected' ? '● Live Price' : '○ ' + state.conn} • WIB ${nowTime()}</div></div><div style="text-align:right"><div class="muted">Gold Price</div><div class="price">$${p2(state.price)}</div><div class="${dec.bias === 'BULLISH' ? 'green' : dec.bias === 'BEARISH' ? 'red' : 'muted'}">${dec.bias} ${dec.confidence ? `• ${dec.confidence}%` : ''}</div></div></section><section class="card tf-card"><div class="section-row"><div><div class="kicker">TIMEFRAME</div><h2>Pilih mapping</h2></div><span class="muted">${state.tf}</span></div><div class="tf-grid compact-tf">${tfList.map(x => `<button class="${state.tf === x ? 'active' : ''}" onclick="window.runAnalysis('${x}')">${x}</button>`).join('')}</div></section><section class="card setup-focus"><div class="section-row"><div><div class="kicker">SETUP UTAMA</div><h2>${setupTitle}</h2></div>${(se && se.active) ? `<span class="badge ${se.direction.includes('BUY') ? 'buy' : 'sell'}">${se.direction}</span>` : ''}</div>${setupBody}<button class="action" onclick="setTab('Analyze')" style="width:100%;margin-top:12px">⚡ Buka Analisis Lengkap</button></section>${killzonePanel()}`;
}

export function lifecycleSetupCard(s, i = 0) {
  const se = state.result ? buildSetupExecution(state.result) : null;
  if (state.result) {
    state.result.setupExecution = se;
    state.result.mappingExplanation = buildMappingExplanation(state.result);
  }
  if (!se || !se.active) {
    return historyCard(s, i);
  }
  const plan = s?.tradeManagement ? `<div class="precision-plan"><b>M15 PRECISION PLAN</b><span>TP1 ${s.tradeManagement.tp1R}R · Close ${s.tradeManagement.tp1ClosePercent}%</span><span>SL runner → Break-even · Runner ${s.tradeManagement.runnerPercent}% ke TP2 ≥ ${s.tradeManagement.tp2MinimumR}R</span></div>` : '';
  return setupCard(s, se, i, 'ACTIVE')
    .replace('<div class="num-grid">', renderSetupLifecycle(se) + plan + '<div class="num-grid">');
}

export function mapMini(tf){
  let cs=state.candles?.[tf]||[];
  if(!cs.length||cs.length<30)return null;
  try{return analyze(cs,tf,{},state.price,{H4:state.candles?.H4,D1:state.candles?.D1,W1:state.candles?.W1})}catch(e){return null}
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
export function analyzeSetupLiveState() {
  const result = state.result;
  const se = result ? buildSetupExecution(result) : null;

  if (!se) {
    return {
      status: 'TUNGGU',
      fatal: false,
      note: 'Belum ada setup aktif.',
      setupExecution: null
    };
  }

  result.setupExecution = se;

  return {
    status: se.status,
    fatal: se.terminal || !se.active,
    note: se.invalidationReason || se.status,
    setupExecution: se
  };
}
export function analyzeActiveSetups(list){
  const se = state.result ? buildSetupExecution(state.result) : null;
  return (se && se.active && state.result?.bestSetup) ? [state.result.bestSetup] : [];
}
export function renderAnalyzeLive(){
  renderSoft()
  document.querySelectorAll('[data-live-price]').forEach(el=>el.textContent=p2(analyzeLivePrice()))
}

export function decisionData(){
  let r = state.result;
  if (!r) {
    return {
      bias: 'WAIT',
      direction: 'TUNGGU',
      confidence: 0,
      confLabel: 'Confidence',
      status: 'WAIT — DATA ANALISIS BELUM TERSEDIA',
      entry: '-',
      invalid: '-',
      nearTarget: '-',
      mainTarget: '-',
      headline: 'Data market belum tersedia',
      action: 'Jangan mengambil keputusan entry.',
      reason: 'Analisis Mapping belum tersedia.',
      confirmationNeeded: 'Tunggu data candle dan hasil analisis terbaru.',
      invalidationText: '-',
      marketContext: 'BELUM TERSEDIA',
      dataStatus: 'BELUM TERSEDIA'
    };
  }

  const dd = r.directionDecision || buildDirectionDecision(r);
  const se = buildSetupExecution(r);
  r.setupExecution = se;

  const expl = buildMappingExplanation(r);
  r.mappingExplanation = expl;

  if (!se.active) {
    return {
      bias: dd.bias,
      direction: 'TUNGGU',
      confidence: 0,
      confLabel: 'Confidence',
      status: se.status || dd.status,
      entry: '-',
      invalid: '-',
      nearTarget: '-',
      mainTarget: '-',
      headline: expl.headline,
      action: expl.action,
      reason: expl.reason,
      confirmationNeeded: expl.confirmationNeeded,
      invalidationText: se.invalidationReason || expl.invalidation || '-',
      marketContext: expl.marketContext || 'NETRAL',
      dataStatus: expl.dataStatus || 'AKTIF'
    };
  }

  const nearTarget = se.singleTarget ? `${p2(se.target1)}` : `${p2(se.target1)} / ${p2(se.target2)}`;
  const mainTarget = se.liquidityTarget ? `${se.liquidityTarget.type} ${p2(se.liquidityTarget.level)}` : (se.target2 ? `TP2 ${p2(se.target2)}` : `TP1 ${p2(se.target1)}`);

  return {
    bias: dd.bias,
    direction: `FOKUS ${se.direction}`,
    confidence: dd.confidence,
    confLabel: 'Confidence',
    status: se.status,
    entry: `${p2(se.entryLow)} - ${p2(se.entryHigh)}`,
    invalid: p2(se.stopLoss),
    nearTarget,
    mainTarget,
    headline: expl.headline,
    action: expl.action,
    reason: expl.reason,
    confirmationNeeded: expl.confirmationNeeded,
    invalidationText: se.invalidationReason || '-',
    marketContext: expl.marketContext || 'NETRAL',
    dataStatus: expl.dataStatus || 'AKTIF'
  };
}
export function amyDecisionCard(){
  let d = decisionData();
  let targetHtml = '';
  if (d.nearTarget === '-' && d.mainTarget === '-') {
      targetHtml = `<div class="decision-box"><small>Target Harga</small><strong>-</strong></div>`;
  } else if (d.nearTarget === d.mainTarget || d.nearTarget.includes(d.mainTarget.split(' ')[1]||'none')) {
      targetHtml = `<div class="decision-box" style="grid-column: span 2"><small>Target Likuiditas Utama</small><strong>${d.mainTarget}</strong></div>`;
  } else {
      targetHtml = `<div class="decision-box"><small>Target Terdekat</small><strong>${d.nearTarget}</strong></div><div class="decision-box"><small>Target Likuiditas Utama</small><strong>${d.mainTarget}</strong></div>`;
  }
  return`<section class="card"><div class="kicker">AMY FX DECISION</div><div class="decision-main ${dirClass(d.direction)}">${d.direction}</div><div class="decision-grid">
    <div class="decision-box"><small>Arah Utama</small><strong>${d.bias}</strong></div>
    <div class="decision-box"><small>Tingkat Keyakinan</small><strong>${d.confidence}%</strong></div>
    <div class="decision-box"><small>Status Data</small><strong>${d.dataStatus || 'AKTIF'}</strong></div>
    <div class="decision-box"><small>Area Rencana</small><strong>${d.entry}</strong></div>
    <div class="decision-box"><small>Batas Salah</small><strong>${d.invalid}</strong></div>
    ${targetHtml}
  </div>
  <div class="decision-explanation" style="margin-top:12px;border-top:1px solid #333;padding-top:10px">
    <b style="font-size:14px;color:#fff">${d.headline || 'Mapping Explanation'}</b><br>
    <span class="muted" style="font-size:12px">Tindakan: <b>${d.action}</b></span>
    <p style="margin:6px 0;font-size:13px">${d.reason}</p>
    <small class="muted" style="display:block;font-size:11px">Konfirmasi Dibutuhkan: ${d.confirmationNeeded}</small>
    ${d.invalidationText && d.invalidationText !== '-' ? `<small class="muted" style="display:block;font-size:11px">Invalidasi: ${d.invalidationText}</small>` : ''}
  </div></section>`
}

export function validBreakInfo(){
  const r=state.result,tf=r?.tf,cs=state.candles?.[tf]||[],last=cs.at(-1),br=r?.st?.lastEvent||r?.st?.last,price=analyzeLivePrice();
  if(!r||!last||!br)return`<section class="card"><div class="kicker">VALID BREAK INFO</div><h2>Belum Ada Valid Break</h2><div class="break-reason">Belum ada BOS/CHOCH yang cukup jelas. Tunggu candle close yang valid.</div></section>`;
  const isSweep=br.breakType==='SWEEP_ONLY'||br.sweepOnly;
  const isFailed=br.breakType==='BREAK_FAILED'||br.failed;
  const isValid=br.breakType==='VALID_BREAK'||br.valid;
  const scope=br.structureScope||'MAJOR';
  const isTransition=br.confirmationStage==='TRANSITION'||br.trendConfirmed===false;
  const crossedBack=isValid&&(br.dir==='BULLISH'?price<br.price:price>br.price);
  const atRisk=!isFailed&&!isSweep&&(br.atRisk||br.liveStatus==='AT_RISK'||crossedBack);
  const confirmedTrend=r.st?.confirmedTrend||r.st?.trend||'NEUTRAL';
  const nextLevel=Number(r.st?.transitionConfirmationLevel);
  const nextText=Number.isFinite(nextLevel)?p2(nextLevel):'-';
  let title='WAIT';
  if(isFailed)title='BREAK FAILED';
  else if(isSweep)title='SWEEP ONLY';
  else if(atRisk)title=`${scope==='INTERNAL'?'INTERNAL CHOCH':'VALID BREAK'} AT RISK`;
  else if(isValid&&isTransition)title=`INTERNAL ${br.kind} ${br.dir}`;
  else if(isValid)title=`VALID ${br.kind} ${br.dir}`;
  let conclusion='Belum ada BOS/CHOCH valid. Tunggu candle close yang jelas.';
  if(isFailed)conclusion='Break gagal dipertahankan karena candle sudah kembali close melewati level break.';
  else if(isSweep)conclusion='Harga hanya menyapu level dengan wick; belum ada candle close yang mengonfirmasi perubahan struktur.';
  else if(atRisk)conclusion=`Break internal sudah close valid, tetapi harga live kembali ${br.dir==='BULLISH'?'di bawah':'di atas'} ${p2(br.price)}. Status AT RISK; tunggu penutupan candle ${tf} untuk menentukan hold atau failed break.`;
  else if(isValid&&isTransition)conclusion=`Break internal valid dan didukung displacement, tetapi tren utama masih ${confirmedTrend}. Reversal belum terkonfirmasi${Number.isFinite(nextLevel)?`; tunggu break protected swing sekitar ${p2(nextLevel)}`:''}.`;
  else if(isValid)conclusion=`Break mayor valid dan tren ${br.dir} sudah terkonfirmasi oleh candle close serta displacement.`;
  return`<section class="card"><div class="kicker">VALID BREAK INFO</div><h2>${title}</h2><div class="break-grid"><div class="break-box"><small>Level yang diuji</small><strong>${p2(br.price)}</strong></div><div class="break-box"><small>High / Low candle</small><strong>${p2(br.candleHigh)} / ${p2(br.candleLow)}</strong></div><div class="break-box"><small>Candle close</small><strong>${p2(br.candleClose)}</strong></div><div class="break-box"><small>Harga live</small><strong>${p2(price)}</strong></div><div class="break-box"><small>Percobaan struktur</small><strong>${scope==='INTERNAL'?'INTERNAL ':''}${br.kind} ${br.dir}</strong></div><div class="break-box"><small>Struktur terkonfirmasi</small><strong>${confirmedTrend}</strong></div><div class="break-box"><small>Status break</small><strong>${atRisk?'AT RISK':isTransition?'TRANSITION':isFailed?'FAILED':isSweep?'SWEEP':'CONFIRMED'}</strong></div><div class="break-box"><small>Konfirmasi berikutnya</small><strong>${nextText}</strong></div><div class="break-box" style="grid-column:span 2"><small>Displacement</small><strong>${br.hasDisplacement?'KUAT + TERKONFIRMASI':'TIDAK TERKONFIRMASI'} · body ratio ${p2(br.bodyRatio)}</strong></div></div><div class="break-reason"><b>Kesimpulan:</b><br>${conclusion}</div></section>`;
}

export function m1h4MappingTable(){
  const rows=m1h4List().map(({tf,a})=>{
    if(!a)return`<tr><td>${tf}</td><td colspan="6" class="muted">Belum dimuat</td></tr>`;
    let ob=mapConcept(a,'OB'),fvg=mapConcept(a,'FVG');
    let se=a.setupExecution || buildSetupExecution(a);
    let status=(se && se.active) ? `${se.direction} · ${se.status}` : 'TUNGGU';
    return`<tr><td>${tf}</td><td><span class="map-bias ${mapBiasClass(a.final)}">${a.final}</span></td><td>${p2(a.bsl)}</td><td>${p2(a.ssl)}</td><td>${ob?ob[2]:'-'}</td><td>${fvg?fvg[2]:'-'}</td><td>${status}</td></tr>`;
  }).join('');
  return`<section class="card"><div class="kicker">M1–H4 MAPPING TABLE</div><h2>BSL • SSL • OB • FVG</h2><div class="map-table-wrap"><table class="map-table"><thead><tr><th>TF</th><th>Bias</th><th>BSL</th><th>SSL</th><th>OB</th><th>FVG</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></section>`
}

export function aiMappingExplanation(){
  let r=state.result,s=r?.bestSetup;
  let se=r?.setupExecution || (r ? buildSetupExecution(r) : null);
  if(!r)return`<section class="card"><div class="kicker">MAPPING NOTES</div><h2>Amy FX Mapping Explanation</h2><div class="ai-map-note muted">Klik timeframe untuk membuat penjelasan mapping.</div></section>`;
  let htfNote=r.htfNarrative?.reason?`<p><b>HTF Narrative</b>: ${r.htfNarrative.reason}</p>`:`<p><b>HTF Narrative</b>: Data HTF belum cukup. Mapping memakai struktur timeframe aktif.</p>`;
  let sessNote=r.sessionContext ? `<p><b>Session Context</b>: ${r.sessionContext.session.replace('_',' ')} — ${r.sessionContext.killzone!=='NONE'?'Killzone Aktif. ':''}${r.sessionContext.note}</p>` : '';
  let drNote=r.dealingRange ? `<p><b>Dealing Range</b>: ${r.dealingRange.rangeSource} (${r.dealingRange.confidence}) di High ${p2(r.dealingRange.high)} - Low ${p2(r.dealingRange.low)}.</p>` : '';
  let liqNote=se?.liquidityTarget ? `<p><b>Target Likuiditas</b>: ${se.liquidityTarget.type} ${p2(se.liquidityTarget.level)}</p>` : '';

  if(!se || !se.active){
    return`<section class="card"><div class="kicker">MAPPING NOTES</div><h2>Amy FX Mapping Explanation</h2><div class="ai-map-note">${htfNote}${sessNote}${drNote}${liqNote}<p>Mapping ${r.tf} menunjukkan bias utama <b>${r.directionDecision?.bias || r.final || 'WAIT'}</b>.</p><p><b>Status Setup: NON-AKTIF</b> (${se?.invalidationReason || 'Belum ada setup Entry Map valid.'})</p><p>Kesimpulan: belum ada setup angka aktif yang aman. Tunggu konfirmasi baru.</p></div></section>`;
  }

  return`<section class="card"><div class="kicker">MAPPING NOTES</div><h2>Amy FX Mapping Explanation</h2><div class="ai-map-note">${htfNote}${sessNote}${drNote}${liqNote}<p>Mapping ${se.direction} sedang aktif untuk <b>${s?.type || 'Entry Map'}</b>. Harga sekarang $<b>${p2(analyzeLivePrice()||r.price)}</b>.</p><p>Area entry utama di <b>${p2(se.entryLow)} - ${p2(se.entryHigh)}</b>. Status: <b>${se.status}</b>.</p><p>Invalidasi pada <b>${p2(se.stopLoss)}</b>. Target awal pada <b>${p2(se.target1)}</b>${se.target2 ? `, target lanjutan pada <b>${p2(se.target2)}</b>` : ''}.</p><p>Kesimpulan: <b>PANTAU SETUP ${se.direction}</b>. Tetap hormati invalidasi pada ${p2(se.stopLoss)}.</p></div></section>`;
}

function readableBias(value){return value==='BULLISH'?'naik (bullish)':value==='BEARISH'?'turun (bearish)':'netral';}
function readableZone(value){return value==='PREMIUM'?'bagian atas range (premium)':value==='DISCOUNT'?'bagian bawah range (discount)':'tengah range (equilibrium)';}
function readableSetup(value){return({'ORDER BLOCK':'Order Block — zona asal dorongan harga','FAIR VALUE GAP':'Fair Value Gap — celah harga yang belum seimbang','LIQUIDITY SWEEP':'Liquidity Sweep — sapuan level lalu harga kembali','SWEEP_MSS_FVG':'Sweep → perubahan struktur → Fair Value Gap','STRUCTURE SETUP':'Setup perubahan struktur','DISPLACEMENT CANDLE':'Candle dorongan kuat'})[value]||value;}
function readableConflict(s){
  const conflicts=s?.conflictCheck?.conflicts||[];
  if(!conflicts.length)return'Tidak ada konflik utama yang terdeteksi.';
  return conflicts.map(x=>x.note.replace('HTF','timeframe besar').replace('MSS/CHOCH','perubahan struktur').replace('RR','rasio risiko dan target')).join('; ')+'.';
}

export function plainMappingExplanation(){
  const r=state.result,s=r?.bestSetup;
  const se=r?.setupExecution || (r ? buildSetupExecution(r) : null);
  if(!r)return`<section class="card"><div class="kicker">PENJELASAN MAPPING</div><h2>Belum Ada Analisis</h2><div class="ai-map-note muted">Pilih timeframe untuk mulai membaca kondisi market.</div></section>`;
  const price=p2(analyzeLivePrice()||r.price);
  const htf=r.htfNarrative;
  const targetText=se?.liquidityTarget
    ? `${se.liquidityTarget.type} pada ${p2(se.liquidityTarget.level)} menjadi target likuiditas utama.`
    : 'Belum ada target likuiditas searah yang cukup jelas.';
  
  let plan='Belum ada setup aktif yang memenuhi seluruh syarat. Jangan mengejar harga.';
  if(se && se.active){
    plan=`Amy membaca setup aktif <b>${readableSetup(s?.type || 'Entry Map')}</b> pada ${r.tf}. Area entry ${p2(se.entryLow)}–${p2(se.entryHigh)}, SL ${p2(se.stopLoss)}, TP1 ${p2(se.target1)}${se.target2 ? `, TP2 ${p2(se.target2)}` : ''}. Status: ${se.status}.`;
  }

  return`<section class="card"><div class="kicker">PENJELASAN MAPPING</div><h2>Apa yang Sedang Terjadi?</h2><div class="ai-map-note">
    <p><b>1. Arah utama</b><br>Struktur market <b>${readableBias(htf?.htfBias||r.final)}</b>. Harga ${price} berada di <b>${readableZone(r.premiumDiscountZone||r.zone)}</b>.</p>
    <p><b>2. Target market</b><br>${targetText}</p>
    <p><b>3. Rencana tindakan</b><br>${plan}</p>
    <p><b>Kesimpulan</b><br>${se && se.active ? `<b>FOKUS ${se.direction}</b> — status: ${se.status}.` : `<b>TUNGGU</b> — ${se?.invalidationReason || 'belum ada setup aktif.'}`}</p>
  </div></section>`;
}

export function analyzeView(){
  const r=state.result;
  const se=r?.setupExecution || (r ? buildSetupExecution(r) : null);
  const activeSetupCard = (se && se.active && r?.bestSetup)
    ? lifecycleSetupCard(r.bestSetup, 0)
    : `<p class="muted">${se?.invalidationReason || 'Belum ada setup aktif yang aman. Tunggu mapping baru.'}</p>`;

  return`<section class="card"><div class="tf-grid">${Object.keys(TF).map(x=>`<button class="${state.tf===x?'active':''}" onclick="window.runAnalysis('${x}')">${x}</button>`).join('')}</div></section>
  <details class="card disclosure" open><summary>Valid Break</summary>${validBreakInfo()}</details>
  <details class="card disclosure"><summary>Mapping M1–H4</summary>${m1h4MappingTable()}</details>
  <details class="card disclosure"><summary>Penjelasan Mapping</summary>${plainMappingExplanation()}</details>
  <details class="card disclosure"><summary>Setup Aktif (${se && se.active ? 1 : 0})</summary><section class="card"><h2>Setup Aktif</h2>${activeSetupCard}</section></details>`;
}

export function setupsView(){
  let list=state.setups.slice(0,20);
  return`<section class="card"><h1>Riwayat Setup (HISTORY / TERMINAL)</h1>${list.map((s, i) => setupCard({ ...s, status: 'HISTORY / TERMINAL' }, i)).join('')||'<p class="muted">Belum ada setup tersimpan.</p>'}</section>`;
}
export function historyView(){return`<section class="card"><h1>Event Logs</h1><button class="action" onclick="window.downloadLogs()">⇩ Download TXT</button>${state.logs.map(x=>`<div class="log">${x}</div>`).join('')||'<p class="muted">Belum ada event.</p>'}</section>`}
export function settingsView(){return`<section class="card settings"><h1>Settings & API</h1><label>Twelve Data API Key <span class="muted">(opsional untuk candle)</span></label><input id="apiKey" value="${state.key}" placeholder="Kosongkan jika key sudah di Vercel"><button class="action" onclick="window.saveConnect()" style="width:100%">🔑 Simpan & Hubungkan Live</button><p class="muted">Analisis candle memakai API Vercel. Key lokal hanya diperlukan untuk live price WebSocket dan Background Scanner native.</p><div class="warn"><b>Background Scanner</b><br>Jika ON, scanner akan memantau Entry Area setup terbaik dari Mapping saat aplikasi ditutup.</div><button data-scanner-status class="${state.bg?'action':'chip'}" onclick="window.toggleBg()" style="width:100%;margin-top:14px">${state.bg?'📡 Background Scanner ON':'📴 Background Scanner OFF'}</button><button class="action" onclick="window.testNotif()" style="width:100%;margin-top:12px">🔔 Tes Notifikasi Setup</button><button class="action" onclick="window.AmyFXUpdate?.checkNow()" style="width:100%;margin-top:12px">🔄 Cek Pembaruan Versi</button></section>`}

export function render(){
  let opens = Array.from(document.querySelectorAll('.disclosure')).map(el => el.open);
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));
  document.getElementById('conn').textContent=state.conn;
  document.getElementById('conn').className='status '+(state.conn==='Connected'?'on':'');
  document.getElementById('app').innerHTML=state.tab==='Dashboard'?dashboard():state.tab==='Analyze'?analyzeView():state.tab==='Setups'?setupsView():state.tab==='History'?historyView():settingsView();
  let newOpens = document.querySelectorAll('.disclosure');
  if(opens.length > 0 && state.tab === 'Analyze') {
    opens.forEach((isOpen, i) => { if(newOpens[i]) newOpens[i].open = isOpen; });
  }
  syncMarketSnapshot();
}
function syncMarketSnapshot(){
  if(!window.AmyFXIntel)return;
  const d=decisionData();
  window.AmyFXIntel.write('mapping',{price:analyzeLivePrice(),bias:d.bias,direction:d.direction,status:d.status,confidence:d.confidence,tf:state.tf});
}
export function syncStickyBar() {
  const bar = document.getElementById('sticky-bar');
  if (!bar) return;
  const isDashboardOrAnalyze = ['Dashboard', 'Analyze'].includes(state.tab);
  const shouldShow = isDashboardOrAnalyze && window.scrollY > 110;
  bar.classList.toggle('visible', shouldShow);
  bar.setAttribute('aria-hidden', String(!shouldShow));
  if (shouldShow) {
    const priceEl = bar.querySelector('.sticky-price');
    const biasEl = bar.querySelector('.sticky-bias');
    if (priceEl) priceEl.textContent = `$${p2(state.price)}`;
    if (biasEl) {
      const dec = decisionData();
      const b = (dec.bias || 'WAIT').toUpperCase();
      biasEl.textContent = b;
      biasEl.className = `sticky-bias ${mapBiasClass(b)}`;
    }
  }
}
if (typeof window !== 'undefined') window.addEventListener('scroll', syncStickyBar, { passive: true });

export function skeletonCardMarkup() {
  return `<section class="card skeleton-card"><div class="skeleton-line h-24 w-50"></div><div class="skeleton-line w-100"></div><div class="skeleton-line w-75"></div></section>`;
}

export function renderSoft(){
  let c=document.getElementById('conn');
  if(c){c.textContent=state.conn;c.className=state.conn==='Connected'?'status on':'status';}
  let p=document.querySelector('.price');
  if(p)p.textContent='$'+p2(state.price);
  let tw=document.getElementById('top-wib');
  if(tw)tw.textContent=(state.conn==='Connected'?'● Live Price':'○ '+state.conn)+' • WIB '+nowTime();
  let kw=document.getElementById('kz-wib');
  if(kw)kw.textContent='WIB '+nowTime();
  syncStickyBar();
}
export function applyAmyFxRoute(){
  let route='';
  try{route=decodeURIComponent((location.hash||'').replace(/^#/,''))}catch(e){}
  try{route=route||new URLSearchParams(location.search||'').get('route')||''}catch(e){}
  try{route=route||localStorage.getItem('amyfx.notification.route')||''}catch(e){}
  if(!route) route = localStorage.getItem('amy_mapping_tab') || '';
  if(['Dashboard','Analyze','Setups','History','Settings'].includes(route)){
    state.tab=route;
    try{localStorage.removeItem('amyfx.notification.route')}catch(e){}
  } else {
    state.tab='Dashboard';
  }
}
