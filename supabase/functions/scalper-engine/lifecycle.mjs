import { normalizeCandles, timestampSeconds } from './candles.mjs';

const EPSILON = 1e-9;
export const NON_TERMINAL_STATUSES = Object.freeze(['WAITING_NEXT_OPEN', 'WAITING_TRIGGER', 'ENTRY_READY', 'ACTIVE', 'BE_ACTIVE']);
export const TERMINAL_STATUSES = Object.freeze(['TP_HIT', 'SL_HIT', 'BE_HIT', 'TIME_EXIT', 'INVALIDATED', 'CANCELLED']);
const TERMINAL = new Set(TERMINAL_STATUSES);

export function findNextOpen(candidate, { m1 = [], m15 = [] } = {}) {
  const signalClose = timestampSeconds(candidate?.signal_candle_close_time);
  if (!signalClose) return null;
  const detectedAt = timestampSeconds(candidate?.created_at);
  const liveMinuteOpen = detectedAt ? Math.floor(detectedAt / 60) * 60 + 60 : signalClose;
  const minuteNotBefore = Math.max(signalClose, liveMinuteOpen);
  const minute = normalizeCandles(m1, 60).find(candle => candle.open_time >= minuteNotBefore && candle.open_time < minuteNotBefore + 900);
  if (minute) return { open_time: minute.open_time, price: minute.open, source: 'M1_NEXT_OPEN' };
  const liveM15Open = detectedAt ? Math.floor(detectedAt / 900) * 900 + 900 : signalClose;
  const candle = normalizeCandles(m15, 900).find(item => item.open_time >= Math.max(signalClose, liveM15Open));
  return candle ? { open_time: candle.open_time, price: candle.open, source: 'M15_NEXT_OPEN' } : null;
}

export function resolveTriggerEntry(candidate, { m1 = [], nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  if (!candidate || candidate.status !== 'WAITING_TRIGGER') return { setup: candidate, event: null, nextOpen: null };
  const signalClose = timestampSeconds(candidate.signal_candle_close_time);
  const entry = Number(candidate?.quality?.planned_entry_price ?? candidate?.quality?.fvg_midpoint);
  const extreme = Number(candidate?.quality?.manipulation_extreme ?? candidate.stop_reference);
  const waitSeconds = Math.max(900, Number(candidate?.quality?.trigger_wait_seconds || 24 * 60 * 60));
  if (!signalClose || !Number.isFinite(entry) || !Number.isFinite(extreme)) {
    return { ...invalidate(candidate, null, 'TRIGGER_GEOMETRY_UNAVAILABLE'), nextOpen: null };
  }
  const deadline = signalClose + waitSeconds;
  const values = normalizeCandles(m1, 60).filter(candle => candle.open_time >= signalClose && candle.open_time <= deadline);
  for (const candle of values) {
    const invalidatedBeforeFill = candidate.direction === 'BUY' ? candle.low < extreme : candle.high > extreme;
    if (invalidatedBeforeFill) {
      const setup = transition(candidate, 'CANCELLED', {
        recommendation_status: 'CLOSED',
        exit_price: extreme,
        exit_time: candle.close_time,
        quality: { ...(candidate.quality || {}), invalidation_reason: 'AMD_MANIPULATION_EXTREME_BROKEN_BEFORE_FILL' },
      });
      return { setup, event: { status: 'CANCELLED', price: extreme, candle_time: candle.open_time, result_r: null }, nextOpen: null };
    }
    if (candle.low <= entry && candle.high >= entry) {
      return { setup: candidate, event: null, nextOpen: { open_time: candle.open_time, price: entry, source: 'FVG_MIDPOINT_LIMIT' } };
    }
  }
  if (timestampSeconds(nowSeconds) >= deadline) {
    const setup = transition(candidate, 'CANCELLED', {
      recommendation_status: 'CLOSED',
      exit_time: deadline,
      quality: { ...(candidate.quality || {}), invalidation_reason: 'AMD_ENTRY_WAIT_EXPIRED' },
    });
    return { setup, event: { status: 'CANCELLED', price: null, candle_time: deadline, result_r: null }, nextOpen: null };
  }
  return { setup: candidate, event: null, nextOpen: null };
}

function invalidate(candidate, nextOpen, reason) {
  return {
    setup: {
      ...candidate,
      status: 'INVALIDATED', recommendation_status: 'INVALID', exit_time: nextOpen?.open_time || null,
      quality: { ...(candidate?.quality || {}), lifecycle_sequence: Number(candidate?.quality?.lifecycle_sequence || 0) + 1, invalidation_reason: reason }
    },
    event: { status: 'INVALIDATED', price: Number(nextOpen?.price) || null, candle_time: nextOpen?.open_time || null, result_r: null }
  };
}

export function activateCandidate(candidate, nextOpen) {
  if (!candidate || TERMINAL.has(candidate.status)) return { setup: candidate, event: null };
  if (!nextOpen || !Number.isFinite(Number(nextOpen.price))) return { setup: candidate, event: null };
  const entry = Number(nextOpen.price), reference = Number(candidate.stop_reference);
  const referenceIsStructural = candidate.direction === 'BUY' ? reference < entry - EPSILON : reference > entry + EPSILON;
  if (!Number.isFinite(reference) || !referenceIsStructural) return invalidate(candidate, nextOpen, 'STRUCTURAL_REFERENCE_WRONG_SIDE');
  const buffer = Number(candidate.atr_at_signal) * Number(candidate.buffer_atr || 0);
  const stop = candidate.direction === 'BUY' ? reference - buffer : reference + buffer;
  const risk = candidate.direction === 'BUY' ? entry - stop : stop - entry;
  if (!(risk > EPSILON)) return invalidate(candidate, nextOpen, 'NON_POSITIVE_STRUCTURAL_RISK');
  const patternLifecycle = Number(candidate.schema_version || 1) >= 3 || candidate?.quality?.lifecycle_policy === 'BT6_FIXED_POINTS_NO_BE';
  const stopCap = Number(candidate?.quality?.stop_cap_points || 50);
  if (patternLifecycle && risk > stopCap) return invalidate(candidate, nextOpen, 'STRUCTURAL_RISK_EXCEEDS_50_POINT_CAP');
  const sign = candidate.direction === 'BUY' ? 1 : -1;
  const tp1Points = Number(candidate?.quality?.tp1_points || 10);
  const tp2Points = Number(candidate?.quality?.tp2_points || 20);
  const setup = {
    ...candidate,
    status: 'ACTIVE', recommendation_status: candidate.recommendation_status === 'PENDING' ? 'VALID' : candidate.recommendation_status,
    entry_candle_open_time: nextOpen.open_time, entry_price: entry,
    initial_stop_loss: stop, stop_loss: stop,
    break_even_trigger: patternLifecycle ? entry + sign * tp1Points : entry + sign * risk,
    target_price: patternLifecycle ? entry + sign * tp2Points : entry + sign * risk * Number(candidate.quality?.target_r || 2),
    risk, be_armed: patternLifecycle ? false : Boolean(candidate.be_armed), bars_elapsed: 0, last_evaluated_open_time: null,
    quality: {
      ...(candidate.quality || {}),
      entry_source: nextOpen.source || 'UNKNOWN', entry_locked: true,
      entry_locked_at: nextOpen.open_time, entry_timestamp: nextOpen.open_time,
      tp1_hit: patternLifecycle ? false : Boolean(candidate?.quality?.tp1_hit),
      lifecycle_sequence: Number(candidate.quality?.lifecycle_sequence || 0) + 1
    }
  };
  return { setup, event: { status: 'ACTIVE', price: entry, candle_time: nextOpen.open_time, result_r: null } };
}

function realizedR(setup, exitPrice) {
  const entry=Number(setup.entry_price),risk=Number(setup.risk),exit=Number(exitPrice);
  if(!(risk>EPSILON)||!Number.isFinite(entry)||!Number.isFinite(exit))return null;
  return setup.direction==='BUY'?(exit-entry)/risk:(entry-exit)/risk;
}
function transition(setup,status,fields={}) {
  const { quality: qualityPatch, ...rest } = fields;
  return { ...setup, ...rest, status, quality: { ...(setup.quality || {}), ...(qualityPatch || {}), lifecycle_sequence: Number(setup.quality?.lifecycle_sequence || 0) + 1 } };
}

function advancePatternLifecycle(inputSetup, rows, options = {}) {
  let setup={...inputSetup,quality:{...(inputSetup?.quality||{})}};
  if(setup.status!=='ACTIVE'||setup.quality.entry_locked!==true||!Number.isFinite(Number(setup.entry_candle_open_time)))return{setup,events:[]};
  const evaluationSeconds=Math.max(60,Number(options.evaluationSeconds||60));
  const entryOpenTime=Number(setup.entry_candle_open_time);
  const maxHoldSeconds=Math.max(900,Number(setup.quality.max_hold_seconds||24*60*60));
  const timeExitAt=entryOpenTime+maxHoldSeconds;
  const values=normalizeCandles(rows,evaluationSeconds).filter(c=>c.open_time>=entryOpenTime).filter(c=>!setup.last_evaluated_open_time||c.open_time>Number(setup.last_evaluated_open_time));
  const events=[];
  for(const candle of values){
    if(setup.status!=='ACTIVE')break;
    const stop=Number(setup.initial_stop_loss),tp1=Number(setup.break_even_trigger),tp2=Number(setup.target_price);
    const stopHit=setup.direction==='BUY'?candle.low<=stop:candle.high>=stop;
    const tp2Hit=setup.direction==='BUY'?candle.high>=tp2:candle.low<=tp2;
    const tp1Hit=setup.direction==='BUY'?candle.high>=tp1:candle.low<=tp1;
    setup.bars_elapsed=Math.max(Number(setup.bars_elapsed||0),Math.floor((candle.close_time-entryOpenTime)/900));
    setup.last_evaluated_open_time=candle.open_time;
    if(stopHit){setup=transition(setup,'SL_HIT',{stop_loss:stop,exit_price:stop,exit_time:candle.close_time,result_r:-1,recommendation_status:'CLOSED'});events.push({status:'SL_HIT',price:stop,candle_time:candle.open_time,result_r:-1});break;}
    if(tp2Hit){
      if(setup.quality.tp1_hit!==true){setup={...setup,quality:{...setup.quality,tp1_hit:true,lifecycle_sequence:Number(setup.quality.lifecycle_sequence||0)+1}};events.push({status:'TP1_HIT',price:tp1,candle_time:candle.open_time,result_r:realizedR(setup,tp1)});}
      const result=realizedR(setup,tp2);setup=transition(setup,'TP_HIT',{exit_price:tp2,exit_time:candle.close_time,result_r:result,recommendation_status:'CLOSED'});events.push({status:'TP_HIT',price:tp2,candle_time:candle.open_time,result_r:result});break;
    }
    if(setup.quality.tp1_hit!==true&&tp1Hit){setup={...setup,quality:{...setup.quality,tp1_hit:true,lifecycle_sequence:Number(setup.quality.lifecycle_sequence||0)+1}};events.push({status:'TP1_HIT',price:tp1,candle_time:candle.open_time,result_r:realizedR(setup,tp1)});}
    if(candle.close_time>=timeExitAt){setup=transition(setup,'TIME_EXIT',{exit_price:candle.close,exit_time:candle.close_time,result_r:realizedR(setup,candle.close),recommendation_status:'CLOSED'});events.push({status:'TIME_EXIT',price:candle.close,candle_time:candle.open_time,result_r:setup.result_r});break;}
  }
  return{setup,events};
}

export function advanceSetupLifecycle(inputSetup, rows, options = {}) {
  if(Number(inputSetup?.schema_version||1)>=3||inputSetup?.quality?.lifecycle_policy==='BT6_FIXED_POINTS_NO_BE')return advancePatternLifecycle(inputSetup,rows,options);
  let setup={...inputSetup,quality:{...(inputSetup?.quality||{})}};
  if(!NON_TERMINAL_STATUSES.includes(setup.status)||!['ACTIVE','BE_ACTIVE'].includes(setup.status)||setup.quality.entry_locked!==true||!Number.isFinite(Number(setup.entry_candle_open_time)))return{setup,events:[]};
  const evaluationSeconds=Math.max(60,Number(options.evaluationSeconds||60));
  const entryOpenTime=Number(setup.entry_candle_open_time);
  const maxHoldSeconds=Math.max(900,Number(setup.quality.max_hold_seconds||Number(setup.max_bars||4)*900));
  const timeExitAt=entryOpenTime+maxHoldSeconds;
  const values=normalizeCandles(rows,evaluationSeconds).filter(c=>c.open_time>=entryOpenTime).filter(c=>!setup.last_evaluated_open_time||c.open_time>Number(setup.last_evaluated_open_time));
  const events=[];
  for(const candle of values){
    if(!NON_TERMINAL_STATUSES.includes(setup.status))break;
    const currentStop=setup.status==='BE_ACTIVE'||setup.be_armed?Number(setup.entry_price):Number(setup.initial_stop_loss);
    const stopHit=setup.direction==='BUY'?candle.low<=currentStop:candle.high>=currentStop;
    const targetHit=setup.direction==='BUY'?candle.high>=Number(setup.target_price):candle.low<=Number(setup.target_price);
    const oneRHit=setup.direction==='BUY'?candle.high>=Number(setup.break_even_trigger):candle.low<=Number(setup.break_even_trigger);
    setup.bars_elapsed=Math.max(Number(setup.bars_elapsed||0),Math.floor((candle.close_time-entryOpenTime)/900));
    setup.last_evaluated_open_time=candle.open_time;
    if(stopHit){const be=setup.status==='BE_ACTIVE'||setup.be_armed;setup=transition(setup,be?'BE_HIT':'SL_HIT',{stop_loss:currentStop,exit_price:currentStop,exit_time:candle.close_time,result_r:be?0:-1,recommendation_status:'CLOSED'});events.push({status:setup.status,price:currentStop,candle_time:candle.open_time,result_r:setup.result_r});break;}
    if(targetHit){const targetR=Number(setup.quality.target_r||2);setup=transition(setup,'TP_HIT',{exit_price:Number(setup.target_price),exit_time:candle.close_time,result_r:targetR,recommendation_status:'CLOSED'});events.push({status:'TP_HIT',price:setup.exit_price,candle_time:candle.open_time,result_r:targetR});break;}
    if(candle.close_time>=timeExitAt){setup=transition(setup,'TIME_EXIT',{exit_price:candle.close,exit_time:candle.close_time,result_r:realizedR(setup,candle.close),recommendation_status:'CLOSED'});events.push({status:'TIME_EXIT',price:candle.close,candle_time:candle.open_time,result_r:setup.result_r});break;}
    if(!setup.be_armed&&oneRHit){setup=transition(setup,'BE_ACTIVE',{be_armed:true,stop_loss:Number(setup.entry_price)});events.push({status:'BE_ACTIVE',price:setup.entry_price,candle_time:candle.open_time,result_r:null});}
  }
  return{setup,events};
}

function zonesOverlap(a,b){return Number(a.zone_top)>=Number(b.zone_bottom)&&Number(b.zone_top)>=Number(a.zone_bottom);}
const readiness = Object.freeze({ ACTIVE: 0, BE_ACTIVE: 1, ENTRY_READY: 2, WAITING_NEXT_OPEN: 3, WAITING_TRIGGER: 4 });
export function rankActiveSetups(setups) {
  return (Array.isArray(setups)?setups:[]).filter(s=>NON_TERMINAL_STATUSES.includes(s.status)).sort((a,b)=>(readiness[a.status]??9)-(readiness[b.status]??9)||Number(a.priority||99)-Number(b.priority||99)||Number(b.signal_candle_close_time||0)-Number(a.signal_candle_close_time||0));
}
export function selectPrimarySetup(setups){return rankActiveSetups(setups)[0]||null;}

export function assignRecommendations(setups, maxActive = Number.POSITIVE_INFINITY) {
  const values=(Array.isArray(setups)?setups:[]).map(setup=>({...setup}));
  // Explicit finite limits are retained only for backward-compatible tests/history.
  // The multi-driver engine calls this without a limit, so every independent setup stays available.
  const active=Number.isFinite(maxActive)
    ? values.filter(setup=>NON_TERMINAL_STATUSES.includes(setup.status))
    : rankActiveSetups(values);
  const selected=[];
  for(const setup of active){
    const duplicate=selected.some(other=>other.driver_id&&other.driver_id===setup.driver_id&&other.timeframe===setup.timeframe&&other.direction===setup.direction&&Math.abs(Number(other.signal_candle_close_time)-Number(setup.signal_candle_close_time))<=1800&&zonesOverlap(other,setup));
    if(duplicate)setup.recommendation_status='DUPLICATE_CLUSTER';
    else if(selected.length>=maxActive)setup.recommendation_status='RISK_LIMIT';
    else{setup.recommendation_status='VALID';selected.push(setup);}
  }
  const byId=new Map(active.map(s=>[s.id,s])); return values.map(s=>byId.get(s.id)||s);
}

export function lifecycleMessage(setup,status=setup?.status){
  const side=setup?.direction||'WAIT',name=setup?.driver_name||setup?.quality?.driver_name||(setup?.model==='IFVG_SCALPER'?'IFVG':'Scalper Engine');
  const price=v=>Number.isFinite(Number(v))?Number(v).toFixed(2):'-';
  if(status==='WAITING_TRIGGER')return`${name} ${side} terkonfirmasi. Menunggu limit midpoint FVG tanpa melanggar extreme manipulasi.`;
  if(status==='WAITING_NEXT_OPEN'||status==='ENTRY_READY')return`${name} ${side} terkonfirmasi. Menunggu open live berikutnya.`;
  if(status==='ACTIVE')return`${name} ${setup?.timeframe||setup?.quality?.timeframe||''} ${side} aktif · Entry ${price(setup.entry_price)} · SL ${price(setup.stop_loss)} · TP1 ${price(setup.break_even_trigger)} · TP2 ${price(setup.target_price)}.`;
  if(status==='TP1_HIT')return`${name} ${side} mencapai TP1 +10 poin. Stop Loss tetap; aturan BE dinonaktifkan.`;
  if(status==='BE_ACTIVE')return`${name} ${side} mencapai 1R. SL simulasi berpindah ke entry ${price(setup.entry_price)}.`;
  if(status==='TP_HIT')return`${name} ${side} mencapai target simulasi.`;
  if(status==='SL_HIT')return`${name} ${side} selesai terkena Stop Loss.`;
  if(status==='BE_HIT')return`${name} ${side} selesai di breakeven.`;
  if(status==='TIME_EXIT')return`${name} ${side} berakhir karena batas waktu · ${Number(setup.result_r||0).toFixed(2)}R.`;
  if(status==='INVALIDATED')return`${name} ${side} dibatalkan karena invalidasi struktur.`;
  return`${name} ${side} · ${status||'WAIT'}`;
}
