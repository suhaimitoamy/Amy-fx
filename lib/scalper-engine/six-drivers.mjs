// Six independent research models. Closed M15 context, sequential M5 confirmation.
// Prices and outcomes are simulated; scores never gate a valid driver trigger.
export const SIX_ENGINE_VERSION = 'amyfx-six-drivers-pro382';
export const SIX_RULE_VERSION = 'six-driver-rules-v1';
export const SIX_DRIVERS = Object.freeze([
  {id:'HIGH_WINRATE_SNIPER_70',name:'Sniper · Deep OTE',rr:.8,fib:[.75,.786],mode:'SWEEP',hold:3600,desc:'Sweep → break M15 → OTE 75–78,6% → konfirmasi M5 · 0,8R'},
  {id:'AI_ADAPTIVE_SMART_DRIVER',name:'Adaptive Smart',rr:1.6,fib:[.5,.618],mode:'CONTINUATION',hold:10800,be:.8,desc:'Continuation M15 · pullback 50–61,8% · 1,6R · BE setelah 0,8R'},
  {id:'SWING_CHOCH_OTE',name:'Swing CHoCH + OTE',rr:.8,fib:[.745,.755],mode:'REVERSAL',hold:10800,desc:'CHoCH terkonfirmasi · body ≥2×ATR sebelumnya · OTE 75% · 0,8R'},
  {id:'MULTI_DRIVER_ENSEMBLE',name:'Multi-Driver Ensemble',rr:.8,fib:[.72,.73],mode:'ENSEMBLE',hold:5400,desc:'Dua model dasar searah · OTE 72,5% ±0,5% · ATR M15 ≥$2,5 · 0,8R'},
  {id:'CONSERVATIVE_SHIELD',name:'Conservative Shield',rr:.7,fib:[.618,.705],mode:'SHIELD',hold:5400,riskFraction:.0025,desc:'Continuation defensif · satu posisi model · risiko acuan 0,25% · batas harian −2R'},
  {id:'HUMAN_MTF_RAPID_SCALPER',name:'Human MTF Rapid Scalper',rr:1.3,mode:'RAPID',hold:2700,earlyCut:.35,desc:'Retest break M15 → M5 · sesi London/NY · 1,3R · early exit kondisional'}
]);
export const SIX_NON_TERMINAL = ['WAITING_TRIGGER','WAITING_NEXT_OPEN','ACTIVE','BE_ACTIVE'];
export const SIX_TERMINAL = ['TP_HIT','SL_HIT','BE_HIT','TIME_EXIT','INVALIDATED','CANCELLED'];
const signOf = side => side==='BUY'?1:-1;
const round = n => Math.round(n*10000)/10000;
const continuous = rows => rows.every((c,i)=>!i||c.open_time===rows[i-1].close_time);
export function sixClosed(rows,seconds,now) {
  const map=new Map();
  for(const x of rows||[]) {
    const c=Object.fromEntries(['open_time','close_time','open','high','low','close'].map(k=>[k,Number(x[k])]));
    if(x.is_closed===false||!Object.values(c).every(Number.isFinite)||c.open_time<=0||c.close_time-c.open_time!==seconds||c.close_time>now||c.low<=0||c.low>Math.min(c.open,c.close)||c.high<Math.max(c.open,c.close))continue;
    map.set(c.open_time,c);
  }
  return [...map.values()].sort((a,b)=>a.open_time-b.open_time);
}
function localAtr(rows,end=rows.length,n=14) {
  if(end<n+1||!continuous(rows.slice(end-n-1,end)))return null;
  let total=0;
  for(let i=end-n;i<end;i++)total+=Math.max(rows[i].high-rows[i].low,Math.abs(rows[i].high-rows[i-1].close),Math.abs(rows[i].low-rows[i-1].close));
  return total/n;
}
export function sixPivots(rows,width=2) {
  const out={highs:[],lows:[]};
  for(let i=width;i<rows.length-width;i++) {
    const part=rows.slice(i-width,i+width+1);
    if(!continuous(part))continue;
    for(const [key,field,greater]of [['highs','high',true],['lows','low',false]])if(part.every((c,j)=>j===width||(greater?rows[i][field]>c[field]:rows[i][field]<c[field])))
      out[key].push({index:i,price:rows[i][field],confirmedAt:rows[i+width].close_time});
  }
  return out;
}
export function sixStructure(rows) {
  const p=sixPivots(rows),events=[];let bias=0;
  const broken=new Set();
  for(let i=15;i<rows.length;i++) {
    const c=rows[i],previous=rows[i-1];if(previous.close_time!==c.open_time){bias=0;continue;}
    const high=p.highs.filter(x=>x.confirmedAt<=c.open_time).at(-1),low=p.lows.filter(x=>x.confirmedAt<=c.open_time).at(-1);
    for(const [sign,level,opposite]of [[1,high,low],[-1,low,high]]) {
      if(!level||!opposite||broken.has(`${sign}:${level.index}`)||(c.close-level.price)*sign<=0||(previous.close-level.price)*sign>0)continue;
      broken.add(`${sign}:${level.index}`);
      const a=localAtr(rows,i);if(!(a>0))continue;
      const type=bias&&bias!==sign?'CHOCH':bias===sign?'BOS':'INITIAL_BREAK';
      events.push({index:i,time:c.close_time,sign,side:sign===1?'BUY':'SELL',type,priorBias:bias,level:level.price,opposite:opposite.price,atr:a,body:Math.abs(c.close-c.open),high:sign===1?c.high:opposite.price,low:sign===1?opposite.price:c.low});
      bias=sign;
    }
  }
  return {pivots:p,events,bias};
}
function sweepBefore(rows,p,event) {
  const levels=event.sign===1?p.lows:p.highs;
  for(let i=event.index-1;i>=Math.max(15,event.index-12);i--) {
    const c=rows[i],level=levels.filter(x=>x.confirmedAt<=c.open_time).at(-1);
    if(!level||!continuous(rows.slice(i,event.index+1)))continue;
    const extreme=event.sign===1?c.low:c.high;
    if((level.price-extreme)*event.sign>0&&(c.close-level.price)*event.sign>0)return {time:c.close_time,price:level.price,extreme};
  }
  return null;
}
export function sixSession(seconds) {
  const at=zone=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,hourCycle:'h23',hour:'2-digit',weekday:'short'}).formatToParts(new Date(seconds*1000)).map(x=>[x.type,x.value]));
  const london=at('Europe/London'),ny=at('America/New_York');
  if(['Sat','Sun'].includes(ny.weekday))return 'OFF_SESSION';
  if(Number(ny.hour)>=8&&Number(ny.hour)<12)return 'NEW_YORK';
  if(Number(london.hour)>=8&&Number(london.hour)<12)return 'LONDON';
  return 'OFF_SESSION';
}
export function fibZone(event,fib) {
  const span=event.high-event.low;
  if(!(span>0))return null;
  const values=fib.map(r=>event.sign===1?event.high-r*span:event.low+r*span);
  return {low:Math.min(...values),high:Math.max(...values),formedAt:event.time};
}
function emaTrend(rows,end) {
  const part=rows.slice(Math.max(0,end-40),end+1);let ema=part[0].close,prev=ema;
  for(const c of part.slice(1)){prev=ema;ema+=(c.close-ema)*2/21;}
  return part.at(-1).close>ema&&ema>prev?1:part.at(-1).close<ema&&ema<prev?-1:0;
}
function targetsAt(M,T,D,now) {
  const p=sixPivots(M),list=[];
  for(const [key,side]of [['highs','BUY'],['lows','SELL']])for(const x of p[key].slice(-30))list.push({level:x.price,side,sourceTime:x.confirmedAt,label:key==='highs'?'BSL':'SSL'});
  const day=D.at(-1);if(day)list.push({level:day.high,side:'BUY',sourceTime:day.close_time,label:'PDH'},{level:day.low,side:'SELL',sourceTime:day.close_time,label:'PDL'});
  return list.filter(x=>x.sourceTime<=now&&![...M,...T].some(c=>c.close_time>x.sourceTime&&(x.side==='BUY'?c.high>=x.level:c.low<=x.level)));
}
export function sixConfirmation(T,event,zone,stop) {
  const points=sixPivots(T,1);let contact=null;
  for(let i=15;i<T.length;i++) {
    const c=T[i];if(c.open_time<zone.formedAt)continue;
    if(c.close_time>event.time+7200)return {state:'EXPIRED',reason:'Zona melewati batas 2 jam.'};
    if((event.sign===1?c.low<=stop:c.high>=stop))return {state:'INVALIDATED',reason:'Invalidasi struktur ditembus sebelum entry.'};
    if(i&&T[i-1].close_time!==c.open_time){contact=null;continue;}
    if(c.low<=zone.high&&c.high>=zone.low)contact={time:c.close_time,index:i};
    if(!contact||c.close_time-contact.time>1800)continue;
    const pivot=(event.sign===1?points.highs:points.lows).filter(p=>p.confirmedAt<=c.open_time&&p.index>=i-12).at(-1);
    const a=localAtr(T,i),body=Math.abs(c.close-c.open);
    if(pivot&&(c.close-pivot.price)*event.sign>0&&(T[i-1].close-pivot.price)*event.sign<=0&&(c.close-c.open)*event.sign>0&&a>0&&body>=.6*a&&(event.sign===1?c.close>zone.low:c.close<zone.high))
      return {state:'CONFIRMED',time:c.close_time,candle:c,contactTime:contact.time,breakLevel:pivot.price,reason:'Retest zona lalu close M5 break + displacement terkonfirmasi.'};
  }
  return {state:contact?'WAITING_M5_BREAK':'ARMED',contactTime:contact?.time??null,reason:contact?'Zona sudah disentuh; menunggu break/displacement M5.':'Menunggu retest zona entry setelah pembentukan.'};
}
export function sixRiskAllowed(driver,ledger,now) {
  if(driver.mode!=='SHIELD')return null;
  const mine=(ledger||[]).filter(s=>s.driver_id===driver.id&&s.engine_version===SIX_ENGINE_VERSION);
  if(mine.some(s=>['ACTIVE','BE_ACTIVE','WAITING_NEXT_OPEN','WAITING_TRIGGER'].includes(s.status)))return 'Shield sudah memiliki satu posisi/rencana model.';
  const day=Math.floor(now/86400)*86400,closed=mine.filter(s=>SIX_TERMINAL.includes(s.status)&&Number(s.exit_time)>=day).sort((a,b)=>b.exit_time-a.exit_time);
  const total=closed.reduce((sum,s)=>sum+(Number.isFinite(s.result_r)?s.result_r:0),0);
  if(total<=-2)return 'Batas kerugian harian model Shield −2R tercapai (hari UTC).';
  if(closed.length>=2&&closed[0].result_r<0&&closed[1].result_r<0&&now-closed[0].exit_time<3600)return 'Dua hasil rugi berurutan; cooldown Shield satu jam.';
  return null;
}
function modelPattern(driver,event,sweep,M) {
  const checks=[{label:'Body break M15 ≥0,6×ATR sebelum impuls',ok:event.body>=.6*event.atr}];
  if(driver.mode==='SWEEP')checks.push({label:'Sweep reclaim terjadi sebelum break',ok:Boolean(sweep)});
  if(['CONTINUATION','SHIELD'].includes(driver.mode))checks.push({label:'BOS continuation searah tren M15',ok:event.type==='BOS'&&emaTrend(M,event.index)===event.sign});
  if(driver.mode==='REVERSAL')checks.push({label:'CHoCH membalik bias M15 yang sudah terbentuk',ok:event.type==='CHOCH'},{label:'Body impuls ≥2×ATR sebelum impuls',ok:event.body>=2*event.atr});
  if(driver.mode==='ENSEMBLE')checks.push({label:'ATR M15 ≥2,5 unit harga USD XAU',ok:event.atr>=2.5});
  return checks;
}
export function evaluateSixDrivers({m15=[],m5=[],h1=[],d1=[],context,nowSeconds=Math.floor(Date.now()/1000),enabledDrivers={},ledger=[]}={}) {
  const M=sixClosed(m15,900,nowSeconds),T=sixClosed(m5,300,nowSeconds),D=sixClosed(d1,86400,nowSeconds),H=sixClosed(h1,3600,nowSeconds);
  const last=T.at(-1),fresh=context?.fresh===true&&M.length>=30&&T.length>=30&&last&&nowSeconds-last.close_time<=900;
  const result={version:SIX_ENGINE_VERSION,ruleVersion:SIX_RULE_VERSION,generatedAt:nowSeconds,sourceTime:last?.close_time??null,fresh:Boolean(fresh),drivers:[],candidates:[]};
  const struct=sixStructure(M),events=struct.events.filter(e=>e.time>=nowSeconds-7200).reverse();
  const levels=targetsAt(M,T,D,nowSeconds),bias=context?.amy?.dashboard?.biasDir??struct.bias;
  const safe=['SAFE','UPCOMING','MEDIUM_ALERT'].includes(context?.news?.status);
  const prepared=new Map();
  for(const driver of SIX_DRIVERS.filter(d=>d.mode!=='ENSEMBLE')) {
    const options=events.map(event=>({event,sweep:sweepBefore(M,struct.pivots,event)})).map(x=>({...x,checks:modelPattern(driver,x.event,x.sweep,M)}));
    if(driver.mode==='RAPID')for(const x of options)x.checks.push({label:'Sesi London 08–12 lokal atau New York 08–12 lokal',ok:sixSession(nowSeconds)!=='OFF_SESSION'});
    prepared.set(driver.id,options.find(x=>x.checks.every(c=>c.ok))||options[0]||null);
  }
  for(const driver of SIX_DRIVERS) {
    const view={id:driver.id,name:driver.name,rr:driver.rr,ruleVersion:SIX_RULE_VERSION,state:'WAITING_STRUCTURE',score:0,checks:[],reason:'Menunggu break struktur M15 dan impuls yang valid.',plan:null};
    result.drivers.push(view);
    if(enabledDrivers[driver.id]===false){view.state='DISABLED';view.reason='Driver dinonaktifkan di perangkat ini.';continue;}
    if(!fresh){view.state='DATA_STALE';view.reason='Menunggu candle tertutup M15/M5 yang segar.';continue;}
    if(!safe){view.state=context?.news?.status==='NEWS_LOCK'?'NEWS_LOCK':'CALENDAR_UNVERIFIED';view.reason=context?.news?.note||'Kalender belum terverifikasi.';continue;}
    let selected=prepared.get(driver.id),votes=[];
    if(driver.mode==='ENSEMBLE') {
      for(const event of events) {
        votes=[...prepared].filter(([id,x])=>x&&id!=='CONSERVATIVE_SHIELD'&&x.event.side===event.side&&Math.abs(x.event.time-event.time)<=1800&&x.checks.every(c=>c.ok)).map(([id])=>id);
        const x={event,sweep:sweepBefore(M,struct.pivots,event),checks:[...modelPattern(driver,event,null,M),{label:'Minimal dua model dasar searah (Shield tidak dihitung ulang)',ok:votes.length>=2}]};
        selected=x;if(x.checks.every(c=>c.ok))break;
      }
    }
    if(!selected)continue;
    const {event,sweep}=selected;view.checks=selected.checks;
    view.checks.push({label:'Arah sejalan otoritas bias M15 aktif',ok:bias===event.sign&&context?.amy?.dashboard?.invalidStatus!==2});
    if(!view.checks.every(c=>c.ok)){view.reason=view.checks.find(c=>!c.ok).label;continue;}
    const riskBlock=sixRiskAllowed(driver,ledger,nowSeconds);
    if(riskBlock){view.state='RISK_PAUSED';view.reason=riskBlock;continue;}
    const anchored={...event};if(driver.mode==='SWEEP'&&sweep){if(event.sign===1)anchored.low=sweep.extreme;else anchored.high=sweep.extreme;}
    const zone=driver.mode==='RAPID'?{low:event.level-event.atr*.15,high:event.level+event.atr*.15,formedAt:event.time}:fibZone(anchored,driver.fib);
    if(!zone)continue;
    const stop=round((event.sign===1?anchored.low:anchored.high)-event.sign*Math.max(.05,event.atr*.1));
    const confirmation=sixConfirmation(T,event,zone,stop);
    view.state=confirmation.state;view.reason=confirmation.reason;
    view.score=Math.min(100,50+view.checks.filter(c=>c.ok).length*5+(confirmation.state==='CONFIRMED'?20:0)+(context.h1?.bias===(event.sign===1?'BULLISH':'BEARISH')?10:0));
    if(confirmation.time&&T.some(c=>c.open_time>=confirmation.time&&(event.sign===1?c.low<=stop:c.high>=stop))){view.state='INVALIDATED';view.reason='Invalidasi struktur ditembus setelah trigger, sebelum observasi.';}
    const limit=driver.mode!=='RAPID';
    const entry=limit?(zone.low+zone.high)/2:confirmation.candle?.close??(zone.low+zone.high)/2,risk=(entry-stop)*event.sign;
    const target=round(entry+event.sign*risk*driver.rr);
    const liquidity=levels.filter(l=>l.side===event.side&&(l.level-entry)*event.sign>0).sort((a,b)=>Math.abs(a.level-entry)-Math.abs(b.level-entry))[0];
    const targetOk=Boolean(risk>0&&liquidity&&(liquidity.level-target)*event.sign>=0);
    view.checks.push({label:'Target fixed-R memiliki ruang ke likuiditas aktif searah',ok:targetOk});
    view.plan={direction:event.side,entry:round(entry),stopLoss:stop,target,zoneLow:round(zone.low),zoneHigh:round(zone.high),risk:round(risk),liquidityTarget:liquidity?.level??null,rr:driver.rr,formedAt:event.time,expiresAt:event.time+7200,triggerTime:confirmation.time??null,votes,management:{beAtR:driver.be??null,earlyCutR:driver.earlyCut??null,riskFraction:driver.riskFraction??null,maxHoldSeconds:driver.hold},evidence:{breakType:event.type,breakTime:event.time,breakLevel:event.level,atrBeforeImpulse:event.atr,impulseHigh:anchored.high,impulseLow:anchored.low,sweepTime:sweep?.time??null,contactTime:confirmation.contactTime??null,m5BreakLevel:confirmation.breakLevel??null}};
    if(!targetOk&& !['INVALIDATED','EXPIRED'].includes(view.state)){view.state='WAITING_TARGET';view.reason='Target model belum memiliki ruang ke likuiditas aktif searah.';}
    if(view.state!=='CONFIRMED')continue;
    if(nowSeconds-confirmation.time>900||nowSeconds>view.plan.expiresAt){view.state='EXPIRED';view.reason='Trigger M5 sudah melewati batas kesegaran.';continue;}
    const signal=confirmation.candle;
    result.candidates.push({id:`${SIX_ENGINE_VERSION}:${driver.id}:${event.side}:${event.time}`,engine_version:SIX_ENGINE_VERSION,schema_version:6,model:driver.id,driver_id:driver.id,driver_name:driver.name,driver_rule_version:SIX_RULE_VERSION,timeframe:'M5',symbol:'XAU/USD',direction:event.side,status:limit?'WAITING_TRIGGER':'WAITING_NEXT_OPEN',recommendation_status:'VALID',signal_candle_open_time:signal.open_time,signal_candle_close_time:signal.close_time,entry_price:round(entry),initial_stop_loss:stop,stop_loss:stop,break_even_trigger:driver.be?round(entry+event.sign*risk*driver.be):null,target_price:target,risk:round(risk),buffer_atr:.1,max_bars:driver.hold/300,bars_elapsed:0,last_evaluated_open_time:null,htf_bias:context.h1?.bias||'NEUTRAL',htf_candle_close_time:H.at(-1)?.close_time??null,zone_bottom:round(zone.low),zone_top:round(zone.high),source_fvg_id:`BREAK:${event.time}`,stop_reference:event.sign===1?anchored.low:anchored.high,atr_at_signal:event.atr,be_armed:false,priority:SIX_DRIVERS.indexOf(driver)+1,priority_display:SIX_DRIVERS.indexOf(driver)+1,notification_enabled:false,revision:0,device_scope:null,quality:{six_driver:true,lifecycle_policy:SIX_RULE_VERSION,entry_model:limit?'OTE_LIMIT_AFTER_OBSERVATION':'NEXT_OPEN_AFTER_OBSERVATION',entry_not_before:Math.ceil(nowSeconds/60)*60,entry_deadline:nowSeconds+900,max_hold_seconds:driver.hold,target_r:driver.rr,be_at_r:driver.be??null,early_cut_r:driver.earlyCut??null,structural_failure_level:confirmation.breakLevel,liquidity_target:liquidity.level,risk_fraction:driver.riskFraction??null,reason:view.reason,score:view.score,plan:view.plan,limit_price:limit?round(entry):null,observed_at:nowSeconds,costs_included:false}});
  }
  return result;
}
