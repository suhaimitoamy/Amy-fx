import {SIX_ENGINE_VERSION,SIX_NON_TERMINAL,SIX_TERMINAL,sixClosed,sixSession} from './six-drivers.mjs';
const signOf=s=>s.direction==='BUY'?1:-1;
const num=v=>Number.isFinite(Number(v))&&v!=null?Number(v):null;
const round=n=>Math.round(n*10000)/10000;
function update(s,patch){return {...s,...patch,quality:{...s.quality,...(patch.quality||{})},revision:Number(s.revision||0)+1,updated_at:new Date().toISOString()};}
function finish(s,status,price,time,reason,extra={}) {
  return update(s,{status,recommendation_status:'CLOSED',exit_price:price,exit_time:time,result_r:price==null||!s.quality.entry_locked?null:round((price-s.entry_price)*signOf(s)/s.risk),quality:{...extra,exit_reason:reason}});
}
export function advanceSixSetup(input,{m1=[],m5=[],nowSeconds=Math.floor(Date.now()/1000),newsStatus='SAFE',riskPaused=false}={}) {
  let s={...input,quality:{...input.quality}};
  if(s.engine_version!==SIX_ENGINE_VERSION||!SIX_NON_TERMINAL.includes(s.status))return s;
  const minutes=sixClosed(m1,60,nowSeconds),fallback=sixClosed(m5,300,nowSeconds);
  // Prefer M1 coverage starting at the observation/fill boundary, not an incomplete tail.
  const start=s.quality.last_evaluated_close_time??s.quality.entry_not_before;
  const rows=minutes.length&&(minutes[0].open_time<=start||!fallback.length)?minutes:fallback;
  if(['WAITING_TRIGGER','WAITING_NEXT_OPEN'].includes(s.status)) {
    if(!['SAFE','UPCOMING','MEDIUM_ALERT'].includes(newsStatus)||riskPaused)return finish(s,'CANCELLED',null,nowSeconds,'Berita atau batas risiko membatalkan entry yang belum aktif.');
    if(s.driver_id==='HUMAN_MTF_RAPID_SCALPER'&&sixSession(nowSeconds)==='OFF_SESSION')return finish(s,'CANCELLED',null,nowSeconds,'Sesi Rapid sudah berakhir sebelum fill.');
    const limit=s.status==='WAITING_TRIGGER';
    const first=rows.find(c=>c.open_time>=s.quality.entry_not_before&&(!limit||(signOf(s)===1?c.low<=s.entry_price:c.high>=s.entry_price)));
    if(!first){return nowSeconds>s.quality.entry_deadline?finish(s,'CANCELLED',null,nowSeconds,'Tidak ada open teramati sebelum batas entry.'):s;}
    if(first.open_time>s.quality.entry_deadline)return finish(s,'CANCELLED',null,first.open_time,'Open pertama teramati setelah batas entry.');
    const sign=signOf(s),entry=limit?(sign===1?Math.min(first.open,s.entry_price):Math.max(first.open,s.entry_price)):first.open,stop=s.initial_stop_loss,risk=(entry-stop)*sign,target=round(entry+sign*risk*s.quality.target_r);
    const move=Math.abs(entry-s.entry_price),liquidity=num(s.quality.liquidity_target);
    if(!(risk>0)||move>s.atr_at_signal*1.5||liquidity==null||(liquidity-target)*sign<0)return finish(s,'INVALIDATED',null,first.open_time,'Gap open mengubah geometri atau menghabiskan ruang target.');
    s=update(s,{status:'ACTIVE',entry_price:entry,entry_candle_open_time:first.open_time,risk:round(risk),target_price:target,break_even_trigger:s.quality.be_at_r?round(entry+sign*risk*s.quality.be_at_r):null,quality:{entry_locked:true,entry_timestamp:first.open_time,fill_model:limit?'OBSERVED_LIMIT':'OBSERVED_NEXT_OPEN',intrabar_limit_fill:limit&&entry!==first.open,max_hold_seconds:s.quality.max_hold_seconds}});
  }
  const sign=signOf(s),entry=s.entry_price,risk=s.risk,deadline=s.entry_candle_open_time+s.quality.max_hold_seconds;
  const unprocessed=rows.filter(c=>c.open_time>=s.entry_candle_open_time&&(!s.last_evaluated_open_time||c.open_time>s.last_evaluated_open_time));
  for(const c of unprocessed) {
    const previousClose=s.quality.last_evaluated_close_time??s.entry_candle_open_time;
    const gap=c.open_time>previousClose;
    if(gap)s=update(s,{quality:{data_gap:true}});
    if(c.open_time>=deadline)return finish(s,'TIME_EXIT',c.open,c.open_time,'Batas waktu posisi; harga pertama yang teramati.',{outcome_ambiguous:gap||s.quality.data_gap===true});
    const stop=s.stop_loss;
    const stopHit=sign===1?c.low<=stop:c.high>=stop,targetHit=sign===1?c.high>=s.target_price:c.low<=s.target_price;
    s=update(s,{last_evaluated_open_time:c.open_time,bars_elapsed:Math.floor((c.close_time-s.entry_candle_open_time)/300),quality:{last_evaluated_close_time:c.close_time}});
    // Stop takes precedence when OHLC cannot establish the intrabar sequence.
    if(stopHit){const price=(c.open-stop)*sign<0?c.open:stop;return finish(s,s.be_armed?'BE_HIT':'SL_HIT',price,c.close_time,'Stop model tersentuh; gap memakai harga open.',{outcome_ambiguous:targetHit||s.quality.data_gap===true});}
    const intrabarFill=s.quality.intrabar_limit_fill&&c.open_time===s.entry_candle_open_time;
    if(targetHit&&!intrabarFill)return finish(s,'TP_HIT',s.target_price,c.close_time,'Target fixed-R model tercapai.',{outcome_ambiguous:s.quality.data_gap===true});
    const failure=num(s.quality.structural_failure_level);
    const early=s.quality.early_cut_r;
    if(early&&failure!=null&&(c.close-entry)*sign/risk<=-early&&(c.close-failure)*sign<0)return finish(s,'TIME_EXIT',c.close,c.close_time,'Early exit: rugi ≥0,35R dan close kembali melewati struktur trigger.',{early_cut:true,outcome_ambiguous:s.quality.data_gap===true});
    // Arm BE at a closed price; it applies on subsequent candles, never retroactively.
    if(!intrabarFill&&!s.be_armed&&s.quality.be_at_r&&(c.close-entry)*sign/risk>=s.quality.be_at_r)s=update(s,{status:'BE_ACTIVE',be_armed:true,stop_loss:entry,quality:{be_armed_time:c.close_time}});
    if(c.close_time>=deadline)return finish(s,'TIME_EXIT',c.close,c.close_time,'Batas waktu posisi model.',{outcome_ambiguous:s.quality.data_gap===true});
  }
  return s;
}
export function sixDriverStatistics(rows) {
  const byDriver={};
  for(const s of rows||[]) {
    if(s.engine_version!==SIX_ENGINE_VERSION||!SIX_TERMINAL.includes(s.status)||!s.quality?.entry_locked||!Number.isFinite(s.result_r))continue;
    const stats=byDriver[s.driver_id]??={closed:0,wins:0,losses:0,breakeven:0,totalR:0,ambiguous:0,measured:0};
    stats.closed++;
    if(s.quality.outcome_ambiguous){stats.ambiguous++;continue;}
    stats.measured++;
    stats.wins+=s.result_r>0?1:0;stats.losses+=s.result_r<0?1:0;stats.breakeven+=s.result_r===0?1:0;stats.totalR+=s.result_r;
  }
  for(const stats of Object.values(byDriver)){stats.totalR=round(stats.totalR);stats.meanR=stats.measured?round(stats.totalR/stats.measured):null;stats.winRate=stats.measured?round(stats.wins/stats.measured*100):null;stats.costsIncluded=false;}
  return byDriver;
}
