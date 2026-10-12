import test from 'node:test';
import assert from 'node:assert/strict';
import {scalperTradeOutcome,scalperVaultStats} from '../app/src/main/assets/apps/mapping/js/scalper-vault.js';
import {SIX_DRIVERS,SIX_ENGINE_VERSION,sixStructure,sixSession,evaluateSixDrivers,sixRiskAllowed} from '../supabase/functions/scalper-engine/six-drivers.mjs';
import {advanceSixSetup,sixDriverStatistics} from '../supabase/functions/scalper-engine/six-driver-lifecycle.mjs';
import {SIX_DRIVERS as browserDefinitions} from '../app/src/main/assets/apps/mapping/js/engine/six-driver-definitions.js';
import {currentDriverEvaluation,driverSetupReady} from '../app/src/main/assets/apps/mapping/js/ict-workspace/driver-model.js';
const base=Date.parse('2026-09-30T00:00:00Z')/1000;
const b=(i,o,h,l,c)=>({open_time:base+i*900,close_time:base+(i+1)*900,open:o,high:h,low:l,close:c,is_closed:true});
function market(reversal=false){
 const M=Array.from({length:28},(_,i)=>b(i,100,102+Math.sin(i*1.3),98+Math.sin(i*1.3),100+Math.sin(i*1.3)));
 M.push(b(28,100,101,89,91),b(29,91,100,90,98),b(30,98,103,94,101),b(31,94,101,88,93),b(32,93,101,92,100),b(33,100,102,98,101),b(34,101,102.8,100,102),b(35,102,102.5,101,102),b(36,100,117,99,116));
 if(!reversal)M.push(b(37,115,116,110,112),b(38,112,115,109,113),b(39,113,115,111,114),b(40,114,126,113,125));
 return M;
}
const context=()=>({fresh:true,news:{status:'SAFE'},h1:{bias:'BULLISH'},amy:{dashboard:{biasDir:1,invalidStatus:0}}});
const minute=(time,o,h,l,c,seconds=60)=>({open_time:time,close_time:time+seconds,open:o,high:h,low:l,close:c,is_closed:true});
function fixture(id,sell=false){
 const driver=SIX_DRIVERS.find(d=>d.id===id),M=market(driver.mode==='REVERSAL'),time=M.at(-1).close_time;
 const dummy=Array.from({length:60},(_,i)=>minute(time-(60-i)*300,120,122+Math.sin(i*1.3),118+Math.sin(i*1.3),120,300));
 const data={m15:M,m5:dummy,nowSeconds:time,context:context(),d1:[minute(base-86400,100,180,60,100,86400)]};
 const plan=evaluateSixDrivers(data).drivers.find(d=>d.id===id).plan;
 assert.ok(plan,id);
 const mid=(plan.zoneLow+plan.zoneHigh)/2;
 data.m5=Array.from({length:60},(_,i)=>minute(time-(60-i)*300,mid+3,mid+5+Math.sin(i*1.3),mid+2,mid+3,300));
 data.m5.push(minute(time,mid+3,mid+4,mid-.1,mid+2,300),minute(time+300,mid+2,mid+3,mid+.1,mid+2,300),minute(time+600,mid+2,mid+7,mid+1,mid+6,300));
 data.nowSeconds=time+900;
 if(sell){const mirror=c=>({...c,open:300-c.open,high:300-c.low,low:300-c.high,close:300-c.close});data.m15=data.m15.map(mirror);data.m5=data.m5.map(mirror);data.d1=data.d1.map(mirror);data.context.h1.bias='BEARISH';data.context.amy.dashboard.biasDir=-1;}
 return data;
}
for(const driver of SIX_DRIVERS)for(const sell of [false,true])test(`${driver.id} ${sell?'SELL':'BUY'} computes its own valid plan and sequential trigger`,()=>{
 const data=fixture(driver.id,sell),result=evaluateSixDrivers(data),candidate=result.candidates.find(c=>c.driver_id===driver.id),view=result.drivers.find(d=>d.id===driver.id);
 assert.ok(candidate,`${view.state}: ${view.reason}`);assert.equal(candidate.status,driver.mode==='RAPID'?'WAITING_NEXT_OPEN':'WAITING_TRIGGER');
 if(driver.mode!=='RAPID')assert.ok(candidate.entry_price>=view.plan.zoneLow&&candidate.entry_price<=view.plan.zoneHigh);
 assert.equal(candidate.direction,sell?'SELL':'BUY');assert.equal(candidate.driver_rule_version,'six-driver-rules-v1');
 const sign=sell?-1:1;assert.ok((candidate.entry_price-candidate.stop_loss)*sign>0);assert.ok((candidate.target_price-candidate.entry_price)*sign>0);
 assert.ok(Math.abs((candidate.target_price-candidate.entry_price)*sign/candidate.risk-driver.rr)<.001);
 assert.ok(view.plan.evidence.contactTime>=view.plan.formedAt);assert.ok(view.plan.triggerTime>=view.plan.evidence.contactTime);
 assert.equal(view.plan.evidence.breakType,driver.mode==='REVERSAL'?'CHOCH':'BOS');
 if(driver.mode==='ENSEMBLE')assert.ok(view.plan.votes.length>=2);
 if(driver.mode==='SWEEP')assert.ok(view.plan.evidence.sweepTime<view.plan.formedAt);
 const future=minute(data.nowSeconds,1,1000,.1,1,300);
 assert.deepEqual(evaluateSixDrivers({...data,m5:[...data.m5,future]}),result);
 const unclosed=data.m5.map((c,i)=>i===data.m5.length-1?{...c,is_closed:false}:c);
 assert.equal(evaluateSixDrivers({...data,m5:unclosed}).candidates.some(c=>c.driver_id===driver.id),false);
});
test('registry parity, missing data, verified news, device switches and M15 direction fail closed without using A+ score',()=>{
 assert.deepEqual(browserDefinitions,SIX_DRIVERS);
 const data=fixture(SIX_DRIVERS[1].id);data.context.confluence={score:12};data.context.execution={status:'NOT READY',aPlusReady:false};
 assert.ok(evaluateSixDrivers(data).candidates.some(c=>c.driver_id===SIX_DRIVERS[1].id));
 for(const change of [{context:{...data.context,fresh:false}},{context:{...data.context,news:{status:'NEWS_LOCK'}}},{context:{...data.context,news:{status:'UNVERIFIED'}}},{enabledDrivers:Object.fromEntries(SIX_DRIVERS.map(d=>[d.id,false]))},{context:{...data.context,amy:{dashboard:{biasDir:-1}}}}])assert.equal(evaluateSixDrivers({...data,...change}).candidates.length,0);
 const gap=data.m5.filter((_,i)=>i!==data.m5.length-2);assert.equal(evaluateSixDrivers({...data,m5:gap}).candidates.some(c=>c.driver_id===SIX_DRIVERS[1].id),false);
});
test('structure and anchors are causal, strict CHoCH uses pre-impulse ATR',()=>{
 const M=market(true),before=sixStructure(M.slice(0,-1)),after=sixStructure(M);
 assert.equal(before.events.some(e=>e.type==='CHOCH'),false);assert.equal(after.events.at(-1).type,'CHOCH');
 assert.ok(after.events.at(-1).body>=2*after.events.at(-1).atr);
 const future=M.map(c=>({...c}));future.push(b(37,116,150,90,140));assert.deepEqual(sixStructure(future).events.filter(e=>e.time<=M.at(-1).close_time),after.events);
});
function pending(id=SIX_DRIVERS[1].id){return evaluateSixDrivers(fixture(id)).candidates.find(c=>c.driver_id===id);}
function activated(){const s=pending(),t=s.quality.entry_not_before;return advanceSixSetup(s,{m1:[minute(t,s.entry_price,s.entry_price+.1,s.entry_price-.1,s.entry_price)],nowSeconds:t+60});}
test('next-open fill cannot use a past/future candle, gaps outside liquidity invalidate and pending news cancels',()=>{
 const s=pending(SIX_DRIVERS[5].id),t=s.quality.entry_not_before;
 assert.equal(advanceSixSetup(s,{m1:[minute(t-60,s.entry_price,s.entry_price+.1,s.entry_price-.1,s.entry_price)],nowSeconds:t}).status,'WAITING_NEXT_OPEN');
 assert.equal(advanceSixSetup(s,{m1:[minute(t,s.entry_price,s.entry_price+.1,s.entry_price-.1,s.entry_price)],nowSeconds:t+30}).status,'WAITING_NEXT_OPEN');
 assert.equal(activated().status,'ACTIVE');
 assert.equal(advanceSixSetup(s,{m1:[minute(t,190,192,189,191)],nowSeconds:t+60}).status,'INVALIDATED');
 assert.equal(advanceSixSetup(s,{nowSeconds:t,newsStatus:'NEWS_LOCK'}).status,'CANCELLED');
 assert.equal(advanceSixSetup(s,{nowSeconds:s.quality.entry_deadline+1}).status,'CANCELLED');
});
test('SL-first ambiguity, worse gap losses, BE on subsequent bars and immutable terminal states',()=>{
 const s=activated(),t=s.entry_candle_open_time+60,e=s.entry_price,r=s.risk;
 const dual=advanceSixSetup(s,{m1:[minute(t,e,e+2*r,e-2*r,e)],nowSeconds:t+60});assert.equal(dual.status,'SL_HIT');assert.equal(dual.quality.outcome_ambiguous,true);
 const gap=advanceSixSetup(s,{m1:[minute(t,e-2*r,e-r,e-3*r,e-2*r)],nowSeconds:t+60});assert.ok(gap.result_r< -1);
 const be=advanceSixSetup(s,{m1:[minute(t,e,e+r,e-.1,e+.9*r)],nowSeconds:t+60});assert.equal(be.status,'BE_ACTIVE');assert.equal(be.stop_loss,e);
 const hit=advanceSixSetup(be,{m1:[minute(t+60,e+.2*r,e+.3*r,e-.1,e)],nowSeconds:t+120});assert.equal(hit.status,'BE_HIT');assert.equal(hit.result_r,0);
 assert.deepEqual(advanceSixSetup(hit,{m1:[minute(t+120,e,e+4*r,e-4*r,e)],nowSeconds:t+180}),hit);
});
test('Rapid early cut requires actual structural failure and does not pretend -0.35R is a guaranteed stop',()=>{
 const s=activated(),t=s.entry_candle_open_time+60,e=s.entry_price,r=s.risk;
 s.quality.be_at_r=null;s.quality.early_cut_r=.35;s.quality.structural_failure_level=e-.2*r;
 const cut=advanceSixSetup(s,{m1:[minute(t,e,e+.1,e-.7*r,e-.6*r)],nowSeconds:t+60});assert.equal(cut.status,'TIME_EXIT');assert.equal(cut.quality.early_cut,true);assert.equal(cut.result_r,-.6);
 const hold=advanceSixSetup({...s,quality:{...s.quality,structural_failure_level:e-.9*r}},{m1:[minute(t,e,e+.1,e-.7*r,e-.6*r)],nowSeconds:t+60});assert.equal(hold.status,'ACTIVE');
});
test('Shield concurrency and daily/cooldown limits and statistics include BE/time exit but exclude ambiguous results',()=>{
 const d=SIX_DRIVERS.find(d=>d.mode==='SHIELD'),now=base+40000,row={driver_id:d.id,engine_version:SIX_ENGINE_VERSION,status:'SL_HIT',exit_time:now-60,result_r:-1};
 assert.ok(sixRiskAllowed(d,[{...row,status:'ACTIVE'}],now));assert.ok(sixRiskAllowed(d,[row,{...row,exit_time:now-120}],now));assert.equal(sixRiskAllowed(d,[],now),null);
 const rows=[{...row,quality:{entry_locked:true}},{...row,status:'TIME_EXIT',result_r:.3,quality:{entry_locked:true}},{...row,status:'BE_HIT',result_r:0,quality:{entry_locked:true}},{...row,status:'TP_HIT',result_r:1.6,quality:{entry_locked:true,outcome_ambiguous:true}},{...row,status:'CANCELLED',result_r:null,quality:{}}];
 const stats=sixDriverStatistics(rows)[d.id];assert.equal(stats.measured,3);assert.equal(stats.ambiguous,1);assert.equal(stats.totalR,-.7);assert.ok(Math.abs(stats.winRate-33.3333)<.0001);
});
test('sessions track local timezone/DST and server evaluation freshness cannot be invented by HTTP',()=>{
 assert.equal(sixSession(Date.parse('2026-01-15T08:30:00Z')/1000),'LONDON');assert.equal(sixSession(Date.parse('2026-07-15T07:30:00Z')/1000),'LONDON');assert.equal(sixSession(Date.parse('2026-09-27T08:30:00Z')/1000),'OFF_SESSION');
 const now=base+50000,c={source:{M5:now-300}},p={driverEvaluation:{version:SIX_ENGINE_VERSION,fresh:true,sourceTime:now-300,generatedAt:now,drivers:[]}};
 assert.ok(currentDriverEvaluation(p,c,now));assert.equal(currentDriverEvaluation(p,c,now+601),null);assert.equal(currentDriverEvaluation(p,null,now),null);
 const s={engineVersion:SIX_ENGINE_VERSION,recommendationStatus:'VALID',status:'BE_ACTIVE',direction:'BUY',entry:100,stopLoss:100,initialStopLoss:95,target:108,lastEvaluatedOpenTime:now-60,entryCandleOpenTime:now-300,maxHoldSeconds:3600};
 assert.equal(driverSetupReady(s,{news:{status:'SAFE'}},now),true);assert.equal(driverSetupReady(s,{news:{status:'NEWS_LOCK'}},now),false);
});

test('new archive statistics use realized R for BE gaps and exclude ambiguous outcomes',()=>{
 const s={id:'one',engineVersion:SIX_ENGINE_VERSION,status:'BE_HIT',resultR:-.2};
 assert.equal(scalperTradeOutcome(s),'LOSS');assert.equal(scalperTradeOutcome({...s,outcomeAmbiguous:true}),null);
 const stats=scalperVaultStats([s,{...s,id:'two',status:'TP_HIT',resultR:.8},{...s,id:'three',resultR:0}]);
 assert.equal(stats.totalTrades,3);assert.ok(Math.abs(stats.winRate-100/3)<1e-8);
});
test('OTE orders fill only after observation, do not harvest a pre-fill target, and allow later targets',()=>{
 const s=pending(),t=s.quality.entry_not_before,e=s.entry_price;
 const noTouch=advanceSixSetup(s,{m1:[minute(t,e+1,e+2,e+.1,e+1)],nowSeconds:t+60});assert.equal(noTouch.status,'WAITING_TRIGGER');
 const fill=advanceSixSetup(s,{m1:[minute(t,e+1,s.target_price+1,e-.1,e+.1)],nowSeconds:t+60});assert.equal(fill.status,'ACTIVE');assert.equal(fill.entry_price,e);
 const target=advanceSixSetup(fill,{m1:[minute(t+60,e+.1,s.target_price+.1,e,s.target_price)],nowSeconds:t+120});assert.equal(target.status,'TP_HIT');
});
