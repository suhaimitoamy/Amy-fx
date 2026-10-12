import { normalizeCandles, timestampSeconds } from './candles.mjs';
import * as legacy from './expansion-range-lifecycle.mjs';
const owns = s => s?.driver_id === 'DISCIPLINE_SCALPER';
function change(setup,status,fields={}) {
  const next={...setup,...fields,status,quality:{...setup.quality,lifecycle_sequence:Number(setup.quality?.lifecycle_sequence||0)+1}};
  if(['CANCELLED','SL_HIT','TP_HIT','TIME_EXIT','INVALIDATED'].includes(status))next.recommendation_status='CLOSED';
  return {setup:next,event:{status,price:next.exit_price??next.entry_price??null,candle_time:next.exit_time??next.entry_candle_open_time??null,result_r:next.result_r??null}};
}
export function resolveTriggerEntry(candidate,options={}) {
  if(!owns(candidate))return legacy.resolveTriggerEntry(candidate,options);
  if(candidate.status!=='WAITING_TRIGGER')return {setup:candidate,event:null,nextOpen:null};
  const entry=Number(candidate.quality.planned_entry_price),sign=candidate.direction==='BUY'?1:-1;
  const stop=Number(candidate.stop_reference)-sign*Number(candidate.atr_at_signal)*.18;
  const detected=timestampSeconds(candidate.created_at);
  const start=Math.max(Number(candidate.signal_candle_close_time),detected?Math.floor(detected/60)*60+60:0);
  const deadline=Number(candidate.signal_candle_close_time)+Number(candidate.quality.trigger_wait_seconds||86400);
  for(const c of normalizeCandles(options.m1||[],60).filter(c=>c.open_time>=start&&c.close_time<=deadline)){
    if(sign===1?c.low<=stop:c.high>=stop)return {...change(candidate,'CANCELLED',{exit_time:c.close_time,exit_price:stop}),nextOpen:null};
    if(c.low<=entry&&c.high>=entry)return {setup:candidate,event:null,nextOpen:{price:entry,open_time:c.open_time,source:'LIQUIDITY_RETEST_LIMIT'}};
  }
  if(timestampSeconds(options.nowSeconds??Date.now()/1000)>=deadline)return {...change(candidate,'CANCELLED',{exit_time:deadline}),nextOpen:null};
  return {setup:candidate,event:null,nextOpen:null};
}
export function activateCandidate(candidate,nextOpen) {
  if(!owns(candidate))return legacy.activateCandidate(candidate,nextOpen);
  if(candidate.status!=='WAITING_TRIGGER'||!nextOpen)return {setup:candidate,event:null};
  const entry=Number(nextOpen.price),sign=candidate.direction==='BUY'?1:-1;
  const stop=Number(candidate.stop_reference)-sign*Number(candidate.atr_at_signal)*.18;
  const target=Number(candidate.quality.liquidity_target),risk=(entry-stop)*sign;
  if(!Number.isFinite(risk)||risk<=0||!Number.isFinite(target)||(target-entry)*sign<=0||Math.abs(entry-Number(candidate.quality.planned_entry_price))>1e-6)return change(candidate,'INVALIDATED',{exit_time:nextOpen.open_time});
  const result=change(candidate,'ACTIVE',{entry_price:entry,entry_candle_open_time:nextOpen.open_time,initial_stop_loss:stop,stop_loss:stop,target_price:target,break_even_trigger:null,risk,recommendation_status:'VALID',last_evaluated_open_time:null});
  result.setup.quality={...result.setup.quality,entry_locked:true,entry_source:nextOpen.source,entry_timestamp:nextOpen.open_time};
  return result;
}
export function advanceSetupLifecycle(input,rows,options={}) {
  if(!owns(input))return legacy.advanceSetupLifecycle(input,rows,options);
  let setup={...input,quality:{...input.quality}};
  if(setup.status!=='ACTIVE'||setup.quality.entry_locked!==true)return {setup,events:[]};
  const sign=setup.direction==='BUY'?1:-1,entryTime=Number(setup.entry_candle_open_time);
  const deadline=entryTime+Number(setup.quality.max_hold_seconds||86400);
  for(const c of normalizeCandles(rows,60).filter(c=>c.open_time>entryTime&&c.open_time>Number(setup.last_evaluated_open_time||0))){
    setup.last_evaluated_open_time=c.open_time;setup.bars_elapsed=Math.floor((c.close_time-entryTime)/60);
    const sl=sign===1?c.low<=setup.stop_loss:c.high>=setup.stop_loss;
    const tp=sign===1?c.high>=setup.target_price:c.low<=setup.target_price;
    const state=sl?'SL_HIT':tp?'TP_HIT':c.close_time>=deadline?'TIME_EXIT':null;
    if(!state)continue;
    const price=sl?setup.stop_loss:tp?setup.target_price:c.close;
    const result=change(setup,state,{exit_price:price,exit_time:c.close_time,result_r:(price-setup.entry_price)*sign/setup.risk});
    return {setup:result.setup,events:[result.event]};
  }
  return {setup,events:[]};
}
export function lifecycleMessage(setup,status=setup?.status) {
  if(!owns(setup))return legacy.lifecycleMessage(setup,status);
  if(status==='WAITING_TRIGGER')return `Discipline Scalper ${setup.direction}: menunggu sentuhan ulang liquidity setelah konfirmasi.`;
  return `Discipline Scalper ${setup.direction} ${status} · Entry ${setup.entry_price??'-'} · SL ${setup.stop_loss??'-'} · TP liquidity ${setup.target_price??setup.quality?.liquidity_target??'-'}.`;
}
