import { REBUILD_VERSION, REBUILT_DRIVERS, detectRebuiltCandidates } from './rebuilt-drivers.mjs';
import { h1OrderFlowAt, normalizeCandles, timestampSeconds } from './candles.mjs';
import {
  AMD_CONFIG_VERSION,
  BASE_CONFIG_VERSION,
  DEFAULT_PATTERN_CONFIG,
  REPAIR_CONFIG_VERSION,
  evaluatePatternGate,
  resolvePatternConfig,
} from './pattern-gates.mjs';

export const ENGINE_VERSION = 'amyfx-preview-scalper-pattern-v3.0';
export const SETUP_SCHEMA_VERSION = 3;

export const DRIVER_REGISTRY = Object.freeze([
  { enabled: true, id: 'FVG', name: 'FVG', version: BASE_CONFIG_VERSION, timeframes: ['H4'] },
  { enabled: true, id: 'CRT', name: 'CRT', version: BASE_CONFIG_VERSION, timeframes: ['H4'] },
  { enabled: true, id: 'ORDER_BLOCK', name: 'Order Block', version: REPAIR_CONFIG_VERSION, timeframes: ['M15', 'M30', 'H1', 'H4'] },
  { enabled: true, id: 'BREAKER_BLOCK', name: 'Breaker Block', version: REPAIR_CONFIG_VERSION, timeframes: ['M30', 'H1', 'H4'] },
  { enabled: true, id: 'RETEST_BOS', name: 'Retest BOS', version: REBUILD_VERSION, timeframes: ['H1', 'H4'] },
  { enabled: true, id: 'TRENDLINE_BREAK_RETEST', name: 'Trendline Break & Retest', version: BASE_CONFIG_VERSION, timeframes: ['M30', 'H1', 'H4'] },
  { enabled: true, id: 'EMA_PULLBACK', name: 'EMA Pullback', version: REPAIR_CONFIG_VERSION, timeframes: ['H1', 'H4'] },
  { enabled: true, id: 'FALSE_BREAKOUT', name: 'False Breakout / Judas Swing', version: BASE_CONFIG_VERSION, timeframes: ['M15', 'H1', 'H4'] },
  { enabled: true, id: 'RANGE_EXPANSION', name: 'Range Expansion', version: REBUILD_VERSION, timeframes: ['M15', 'M30', 'H1', 'H4'] },
  { enabled: true, id: 'AMD', name: 'AMD', version: REBUILD_VERSION, timeframes: ['M30', 'H1'] },
  { enabled: true, id: 'DISCIPLINE_SCALPER', name: 'Discipline Scalper', version: REBUILD_VERSION, timeframes: ['H4', 'H1', 'M15', 'M5'] }
]);

export const TIMEFRAME_SECONDS = Object.freeze({ M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400 });
const EPSILON = 1e-9;
const DAY = 86400;

function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : NaN; }
function inclusive(value,minimum,maximum){return Number.isFinite(Number(value))&&Number(value)>=minimum&&Number(value)<=maximum;}
function body(c) { return Math.abs(c.close - c.open); }
function range(c) { return Math.max(EPSILON, c.high - c.low); }
function directionCandle(c, direction) { return direction === 'BUY' ? c.close > c.open : c.close < c.open; }
function overlaps(c, bottom, top) { return c.high >= bottom && c.low <= top; }
function invalidated(c, direction, bottom, top) { return direction === 'BUY' ? c.low < bottom : c.high > top; }
function median(values) { const clean = values.filter(Number.isFinite).sort((a,b)=>a-b); if (!clean.length) return NaN; const mid=Math.floor(clean.length/2); return clean.length%2?clean[mid]:(clean[mid-1]+clean[mid])/2; }
function mean(values) { const clean=values.filter(Number.isFinite); return clean.length?clean.reduce((s,v)=>s+v,0)/clean.length:NaN; }
function timeframePriority(tf) { return ({ H4: 0, H1: 10, M30: 20, M15: 30 })[tf] ?? 50; }
function atrSeries(values, length = 14) {
  const out=Array(values.length).fill(NaN); if(values.length<=length)return out;
  const tr=values.map((c,i)=>i===0?range(c):Math.max(range(c),Math.abs(c.high-values[i-1].close),Math.abs(c.low-values[i-1].close)));
  let avg=mean(tr.slice(1,length+1)); out[length]=avg;
  for(let i=length+1;i<values.length;i++){avg=((avg*(length-1))+tr[i])/length;out[i]=avg;}
  return out;
}
function emaSeries(values, length) {
  const out=Array(values.length).fill(NaN); if(!values.length)return out;
  const k=2/(length+1); let ema=values[0].close; out[0]=ema;
  for(let i=1;i<values.length;i++){ema=values[i].close*k+ema*(1-k);out[i]=ema;}
  return out;
}
function swing(values, index, kind, left=2, right=2) {
  if(index<left||index+right>=values.length)return false;
  const p=kind==='HIGH'?values[index].high:values[index].low;
  for(let o=1;o<=left;o++){if(kind==='HIGH'?values[index-o].high>=p:values[index-o].low<=p)return false;}
  for(let o=1;o<=right;o++){if(kind==='HIGH'?values[index+o].high>p:values[index+o].low<p)return false;}
  return true;
}
function recentSwings(values, beforeIndex, kind, count=2) {
  const found=[]; for(let i=beforeIndex-2;i>=2&&found.length<count;i--){if(swing(values,i,kind))found.push({index:i,time:values[i].open_time,price:kind==='HIGH'?values[i].high:values[i].low});}
  return found.reverse();
}
function htfContext(h1, signal) {
  const context = h1OrderFlowAt(h1, signal.close_time);
  return {
    bias: ['BULLISH', 'BEARISH'].includes(context.bias) ? context.bias : 'NEUTRAL',
    candle_close_time: context.candle_close_time
  };
}
function stableLevel(value) { return Number(value).toFixed(5); }
function candidateId(driver, timeframe, direction, signal, anchor, bottom, top) {
  return [ENGINE_VERSION,driver.id,driver.version,timeframe,direction,signal.open_time,anchor,stableLevel(bottom),stableLevel(top)].join(':');
}
function buildCandidate({ driver, timeframe, direction, signal, anchor, bottom, top, stopReference, atrValue, h1, reason, quality={}, priorityOffset=0, status='WAITING_NEXT_OPEN' }) {
  const atr=finite(atrValue); const reference=finite(stopReference);
  if(!(top>bottom)||!Number.isFinite(atr)||atr<=0||!Number.isFinite(reference))return null;
  const htf=htfContext(h1,signal);
  const model=driver.id;
  return {
    id:candidateId(driver,timeframe,direction,signal,anchor,bottom,top),
    engine_version:ENGINE_VERSION,
    model,
    driver_id:driver.id,
    driver_name:driver.name,
    driver_rule_version:driver.version,
    timeframe,
    schema_version:SETUP_SCHEMA_VERSION,
    symbol:'XAU/USD',
    direction,
    status,
    recommendation_status:'PENDING',
    signal_candle_open_time:signal.open_time,
    signal_candle_close_time:signal.close_time,
    entry_candle_open_time:null,
    entry_price:null,
    initial_stop_loss:null,
    stop_loss:null,
    break_even_trigger:null,
    target_price:null,
    risk:null,
    buffer_atr:0.18,
    max_bars:96,
    bars_elapsed:0,
    last_evaluated_open_time:null,
    htf_bias:htf.bias,
    htf_candle_close_time:htf.candle_close_time,
    zone_bottom:bottom,
    zone_top:top,
    source_fvg_id:String(anchor),
    stop_reference:reference,
    atr_at_signal:atr,
    be_armed:false,
    result_r:null,
    exit_price:null,
    exit_time:null,
    quality:{
      driver_id:driver.id,
      driver_name:driver.name,
      driver_rule_version:driver.version,
      timeframe,
      timeframe_seconds:TIMEFRAME_SECONDS[timeframe],
      schema_version:SETUP_SCHEMA_VERSION,
      source_candle_timestamp:signal.close_time,
      source_anchor:String(anchor),
      reason,
      stop_basis:'STRUCTURAL_INVALIDATION_ATR_BUFFER',
      stop_basis_label:'Structural Invalidation + ATR Buffer',
      max_hold_seconds:DAY,
      entry_model:status==='WAITING_TRIGGER'?'LIMIT_TRIGGER':'NEXT_OPEN',
      ...quality
    },
    priority:timeframePriority(timeframe)+DRIVER_REGISTRY.findIndex(item=>item.id===driver.id)+priorityOffset
  };
}
function driver(id){return DRIVER_REGISTRY.find(item=>item.id===id);}
function withinSignalWindow(candle,minSignalTime){return candle.close_time>=minSignalTime;}

function detectFvg(rows,timeframe,h1,minSignalTime){
  const values=normalizeCandles(rows,TIMEFRAME_SECONDS[timeframe]); const atr=atrSeries(values); const out=[]; const d=driver('FVG');
  for(let i=2;i<values.length;i++){
    const first=values[i-2],third=values[i]; const bullish=third.low>first.high,bearish=third.high<first.low; if(!bullish&&!bearish)continue;
    const direction=bullish?'BUY':'SELL',bottom=bullish?first.high:third.high,top=bullish?third.low:first.low,created=third.close_time;
    for(let j=i+1;j<values.length&&values[j].open_time-created<=7*DAY;j++){
      const c=values[j]; if(!overlaps(c,bottom,top))continue;
      if(invalidated(c,direction,bottom,top))break;
      if(withinSignalWindow(c,minSignalTime)){
        const item=buildCandidate({driver:d,timeframe,direction,signal:c,anchor:`FVG:${third.open_time}`,bottom,top,stopReference:direction==='BUY'?Math.min(c.low,bottom):Math.max(c.high,top),atrValue:atr[j]||atr[i],h1,reason:'First H4 FVG retest within seven days',quality:{formation_time:created,retest_index:j,first_touch:true}}); if(item)out.push(item);
      }
      break;
    }
  }
  return out;
}

function detectCrt(rows,timeframe,h1,minSignalTime){
  const values=normalizeCandles(rows,TIMEFRAME_SECONDS[timeframe]); const atr=atrSeries(values); const out=[]; const d=driver('CRT');
  for(let i=1;i<values.length;i++){
    const ref=values[i-1],c=values[i]; const sweepLow=c.low<ref.low&&c.high<=ref.high; const sweepHigh=c.high>ref.high&&c.low>=ref.low; if(sweepLow===sweepHigh)continue;
    if(!(c.close>ref.low&&c.close<ref.high)||!withinSignalWindow(c,minSignalTime))continue;
    const direction=sweepLow?'BUY':'SELL'; const item=buildCandidate({driver:d,timeframe,direction,signal:c,anchor:`CRT:${ref.open_time}`,bottom:ref.low,top:ref.high,stopReference:direction==='BUY'?c.low:c.high,atrValue:atr[i],h1,reason:`${sweepLow?'Low':'High'} H4 sweep and close back inside reference range`,quality:{reference_open_time:ref.open_time,reference_high:ref.high,reference_low:ref.low,sweep_side:sweepLow?'LOW':'HIGH'}}); if(item)out.push(item);
  }
  return out;
}

function findOrderBlocks(values,atr){
  const zones=[];
  for(let i=6;i<values.length;i++){
    const c=values[i],localAtr=atr[i]; if(!Number.isFinite(localAtr)||body(c)<localAtr||body(c)/range(c)<.6)continue;
    const prior=values.slice(i-5,i); const priorHigh=Math.max(...prior.map(x=>x.high)),priorLow=Math.min(...prior.map(x=>x.low));
    const direction=c.close>priorHigh?'BUY':c.close<priorLow?'SELL':null; if(!direction||!directionCandle(c,direction))continue;
    let obIndex=-1; for(let j=i-1;j>=Math.max(0,i-5);j--){if(direction==='BUY'?values[j].close<values[j].open:values[j].close>values[j].open){obIndex=j;break;}}
    if(obIndex<0)continue; const ob=values[obIndex]; zones.push({direction,bottom:ob.low,top:ob.high,obIndex,breakIndex:i,created:c.close_time,anchor:`OB:${ob.open_time}:${c.open_time}`});
  }
  return zones;
}
function detectOrderBlock(rows,timeframe,h1,minSignalTime){
  const values=normalizeCandles(rows,TIMEFRAME_SECONDS[timeframe]); const atr=atrSeries(values); const out=[]; const d=driver('ORDER_BLOCK');
  for(const z of findOrderBlocks(values,atr)){
    for(let j=z.breakIndex+1;j<values.length&&values[j].open_time-z.created<=3*DAY;j++){
      const c=values[j]; if(invalidated(c,z.direction,z.bottom,z.top))break; if(!overlaps(c,z.bottom,z.top))continue;
      if(withinSignalWindow(c,minSignalTime)){const item=buildCandidate({driver:d,timeframe,direction:z.direction,signal:c,anchor:z.anchor,bottom:z.bottom,top:z.top,stopReference:z.direction==='BUY'?z.bottom:z.top,atrValue:atr[j]||atr[z.breakIndex],h1,reason:'First retest of last opposite candle before displacement and BOS',quality:{ob_open_time:values[z.obIndex].open_time,bos_candle_open_time:values[z.breakIndex].open_time,first_retest:true}});if(item)out.push(item);} break;
    }
  }
  return out;
}
function detectBreaker(rows,timeframe,h1,minSignalTime){
  const values=normalizeCandles(rows,TIMEFRAME_SECONDS[timeframe]); const atr=atrSeries(values); const out=[]; const d=driver('BREAKER_BLOCK');
  for(const z of findOrderBlocks(values,atr)){
    let broken=-1; for(let j=z.breakIndex+1;j<values.length&&values[j].open_time-z.created<=3*DAY;j++){if(z.direction==='BUY'?values[j].close<z.bottom:values[j].close>z.top){broken=j;break;}}
    if(broken<0)continue; const direction=z.direction==='BUY'?'SELL':'BUY';
    for(let j=broken+1;j<values.length&&values[j].open_time-values[broken].close_time<=3*DAY;j++){
      const c=values[j]; if(invalidated(c,direction,z.bottom,z.top))break; if(!overlaps(c,z.bottom,z.top))continue;
      if(withinSignalWindow(c,minSignalTime)){const item=buildCandidate({driver:d,timeframe,direction,signal:c,anchor:`BB:${z.anchor}:${values[broken].open_time}`,bottom:z.bottom,top:z.top,stopReference:direction==='BUY'?z.bottom:z.top,atrValue:atr[j]||atr[broken],h1,reason:'Failed Order Block closed through and retested from the opposite side',quality:{source_ob:z.anchor,breaker_close_time:values[broken].close_time,first_retest:true}});if(item)out.push(item);} break;
    }
  }
  return out;
}
function linePrice(a,b,index){const slope=(b.price-a.price)/(b.index-a.index);return a.price+slope*(index-a.index);}
function detectTrendline(rows,timeframe,h1,minSignalTime){
  const values=normalizeCandles(rows,TIMEFRAME_SECONDS[timeframe]); const atr=atrSeries(values); const out=[]; const d=driver('TRENDLINE_BREAK_RETEST');
  for(let i=8;i<values.length;i++){
    for(const direction of ['BUY','SELL']){
      const kind=direction==='BUY'?'HIGH':'LOW',points=recentSwings(values,i,kind,2); if(points.length<2)continue; const [a,b]=points;
      if(direction==='BUY'&&!(b.price<a.price))continue; if(direction==='SELL'&&!(b.price>a.price))continue;
      const breakLine=linePrice(a,b,i),previousLine=linePrice(a,b,i-1); const broke=direction==='BUY'?values[i-1].close<=previousLine&&values[i].close>breakLine:values[i-1].close>=previousLine&&values[i].close<breakLine; if(!broke)continue;
      for(let j=i+1;j<values.length&&values[j].open_time-values[i].close_time<=3*DAY;j++){
        const line=linePrice(a,b,j),tol=(atr[j]||atr[i])*.12,c=values[j]; const touch=direction==='BUY'?c.low<=line+tol&&c.close>line:c.high>=line-tol&&c.close<line; if(!touch)continue;
        if(withinSignalWindow(c,minSignalTime)){const item=buildCandidate({driver:d,timeframe,direction,signal:c,anchor:`TL:${a.time}:${b.time}:${values[i].open_time}`,bottom:line-tol,top:line+tol,stopReference:direction==='BUY'?c.low:c.high,atrValue:atr[j]||atr[i],h1,reason:'Two-point trendline break followed by first retest close',quality:{trendline_point_1:a,trendline_point_2:b,break_candle_open_time:values[i].open_time,retest_line_price:line}});if(item)out.push(item);} break;
      }
    }
  }
  return out;
}
function detectEmaPullback(rows,timeframe,h1,minSignalTime){
  const values=normalizeCandles(rows,TIMEFRAME_SECONDS[timeframe]); const atr=atrSeries(values),ema20=emaSeries(values,20),ema50=emaSeries(values,50); const out=[]; const d=driver('EMA_PULLBACK');
  for(let i=51;i<values.length;i++){
    const prev=values[i-1],c=values[i]; let direction=null;
    if(ema20[i]>ema50[i]&&prev.low<=ema20[i-1]&&c.close>ema20[i]&&c.close>c.open)direction='BUY';
    if(ema20[i]<ema50[i]&&prev.high>=ema20[i-1]&&c.close<ema20[i]&&c.close<c.open)direction='SELL';
    if(!direction||!withinSignalWindow(c,minSignalTime))continue; const bottom=Math.min(ema20[i],ema20[i-1])-(atr[i]*.05),top=Math.max(ema20[i],ema20[i-1])+(atr[i]*.05);
    const item=buildCandidate({driver:d,timeframe,direction,signal:c,anchor:`EMA:${prev.open_time}:${c.open_time}`,bottom,top,stopReference:direction==='BUY'?Math.min(prev.low,c.low):Math.max(prev.high,c.high),atrValue:atr[i],h1,reason:'EMA20/EMA50 trend alignment, EMA20 pullback touch, and confirmation close',quality:{ema20:ema20[i],ema50:ema50[i],pullback_candle_open_time:prev.open_time}}); if(item)out.push(item);
  }
  return out;
}
function witaParts(seconds){const d=new Date((seconds+8*3600)*1000);return{day:d.toISOString().slice(0,10),hour:d.getUTCHours()};}
function detectFalseBreakout(rows,timeframe,h1,minSignalTime,series={}){
  const values=normalizeCandles(rows,TIMEFRAME_SECONDS[timeframe]);
  const asiaValues=normalizeCandles(series.M15?.length?series.M15:rows,series.M15?.length?TIMEFRAME_SECONDS.M15:TIMEFRAME_SECONDS[timeframe]);
  const atr=atrSeries(values); const out=[]; const d=driver('FALSE_BREAKOUT'); const asiaByDay=new Map();
  asiaValues.forEach(c=>{const p=witaParts(c.open_time);if(p.hour>=6)return;if(!asiaByDay.has(p.day))asiaByDay.set(p.day,[]);asiaByDay.get(p.day).push(c);});
  const triggerByDay=new Map();
  values.forEach((c,i)=>{const p=witaParts(c.open_time);if(p.hour<6)return;if(!triggerByDay.has(p.day))triggerByDay.set(p.day,[]);triggerByDay.get(p.day).push({c,i});});
  for(const [day,items] of triggerByDay){const asia=asiaByDay.get(day)||[];if(!asia.length)continue;const high=Math.max(...asia.map(c=>c.high)),low=Math.min(...asia.map(c=>c.low));let used=false;
    for(const item of items){if(used)break;const c=item.c,sweepLow=c.low<low&&c.high<=high,sweepHigh=c.high>high&&c.low>=low;if(sweepLow===sweepHigh)continue;if(!(c.close>low&&c.close<high))continue;used=true;if(!withinSignalWindow(c,minSignalTime))continue;const direction=sweepLow?'BUY':'SELL';const built=buildCandidate({driver:d,timeframe,direction,signal:c,anchor:`ASIA:${day}`,bottom:low,top:high,stopReference:direction==='BUY'?c.low:c.high,atrValue:atr[item.i],h1,reason:'First post-Asia one-sided range sweep with close back inside',quality:{asia_day_wita:day,asia_high:high,asia_low:low,sweep_side:sweepLow?'LOW':'HIGH',timezone:'Asia/Makassar',asia_source_timeframe:series.M15?.length?'M15':timeframe}});if(built)out.push(built);}
  }
  return out;
}
const DETECTORS={FVG:detectFvg,CRT:detectCrt,ORDER_BLOCK:detectOrderBlock,BREAKER_BLOCK:detectBreaker,TRENDLINE_BREAK_RETEST:detectTrendline,EMA_PULLBACK:detectEmaPullback,FALSE_BREAKOUT:detectFalseBreakout};

export function evaluateMultiDriverCandidates({ series={}, h1=[], nowSeconds=Math.floor(Date.now()/1000), maxSignalAgeSeconds=21600, config=DEFAULT_PATTERN_CONFIG }={}){
  if(config?.enabled===false||DRIVER_REGISTRY.every(d=>series.config?.enabledDrivers?.[d.id]===false||config?.driver_enabled?.[d.id]===false))return {candidates:[],telemetry:[],raw_count:0,rejected_count:0};
  const cutoff=timestampSeconds(nowSeconds);series={...series,...Object.fromEntries(Object.entries(TIMEFRAME_SECONDS).filter(([tf])=>Array.isArray(series[tf])).map(([tf,seconds])=>[tf,normalizeCandles(series[tf],seconds).filter(c=>c.close_time<=cutoff)]))};h1=normalizeCandles(h1,3600).filter(c=>c.close_time<=cutoff);
  const resolvedConfig=resolvePatternConfig(config);const minimum=timestampSeconds(nowSeconds)-Math.max(900,Number(maxSignalAgeSeconds)||0);const accepted=[];const telemetry=[];let rawCount=0;
  for(const registration of DRIVER_REGISTRY){if(registration.enabled===false||series.config?.enabledDrivers?.[registration.id]===false||resolvedConfig.driver_enabled?.[registration.id]===false)continue;for(const timeframe of registration.timeframes){const rows=series[timeframe]||[];if(!rows.length)continue;try{const raw=REBUILT_DRIVERS.includes(registration.id)?detectRebuiltCandidates({driver:registration,timeframe,rows,h1,series,minSignalTime:minimum,buildCandidate}):DETECTORS[registration.id](rows,timeframe,h1,minimum,series);rawCount+=raw.length;for(const candidate of raw){const result=evaluatePatternGate(candidate,rows,resolvedConfig);telemetry.push(result.telemetry);if(result.candidate)accepted.push(result.candidate);}}catch(error){console.error('scalper_driver_failed',{driver:registration.id,timeframe,error:String(error)});}}}
  const candidates=[...new Map(accepted.filter(Boolean).map(item=>[item.id,item])).values()].sort((a,b)=>a.signal_candle_close_time-b.signal_candle_close_time||a.priority-b.priority);
  return {candidates,telemetry,raw_count:rawCount,rejected_count:telemetry.filter(item=>item?.accepted===false).length};
}

export function detectMultiDriverCandidates(input={}){
  return evaluateMultiDriverCandidates(input).candidates;
}
