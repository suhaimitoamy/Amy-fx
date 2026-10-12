import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateScalperCandidates, DRIVER_REGISTRY, activateCandidate, resolveTriggerEntry, advanceSetupLifecycle } from '../supabase/functions/scalper-engine/engine.mjs';
import { deviceScope, normalizeDriverToggles, scopeEvaluation } from '../supabase/functions/_shared/scalper-device.mjs';
const day=Date.UTC(2026,7,20)/1000,signal=day+10*3600;
const candle=(t,o,h,l,c,seconds)=>({open_time:t,close_time:t+seconds,open:o,high:h,low:l,close:c,is_closed:true});
function fixture(kind='SWEEP',sell=false){
  let H4=Array.from({length:30},(_,i)=>candle(day-5*86400+i*14400,101+i*.35,120,100,102+i*.35,14400));
  let M15=Array.from({length:32},(_,i)=>candle(day-7200+i*900,109,115,103,110,900));
  let M5=Array.from({length:16},(_,i)=>candle(signal-(16-i)*300,101,102,100,101,300));
  M5.push(kind==='SWEEP'?candle(signal,101,102,99.5,101.5,300):candle(signal,114.8,116,114.6,115.9,300));
  if(kind==='SWEEP')M5.push(candle(signal+300,101.5,103,100.5,102.8,300));
  if(sell){const mirror=rows=>rows.map(c=>({...c,open:220-c.open,high:220-c.low,low:220-c.high,close:220-c.close}));H4=mirror(H4);M15=mirror(M15);M5=mirror(M5);}
  return {series:{H4,M15,M5},nowSeconds:signal+600,maxSignalAgeSeconds:300};
}
function discipline(input){return evaluateScalperCandidates(input).candidates.filter(c=>c.driver_id==='DISCIPLINE_SCALPER'&&c.timeframe==='M5');}
for(const kind of ['SWEEP','BREAK'])for(const sell of [false,true])test(`${kind} ${sell?'SELL':'BUY'} ${kind==='BREAK'?'is rejected without sweep and confirmation':'requires sweep then confirmation before liquidity entry'}`,()=>{
  const found=discipline(fixture(kind,sell));if(kind==='BREAK'){assert.deepEqual(found,[]);return;}assert.ok(found.length);
  const c=found[0];assert.equal(c.direction,sell?'SELL':'BUY');assert.equal(c.quality.confirmation_open_time,signal+300);assert.equal(c.buffer_atr,.18);
  const q=c.quality;assert.ok(sell?q.liquidity_target<q.planned_entry_price:q.liquidity_target>q.planned_entry_price);
  const extended=fixture(kind,sell);extended.series.H4.push(candle(signal+86400,1,10000,0,9999,14400));assert.deepEqual(discipline(extended),found);
});
test('missing H4 and missing next liquidity fail closed',()=>{
  const input=fixture();input.series.H4=[];assert.deepEqual(discipline(input),[]);
  const outside=fixture('BREAK');outside.series.M5.at(-1).open=119.8;outside.series.M5.at(-1).low=119.7;outside.series.M5.at(-1).high=121;outside.series.M5.at(-1).close=120.9;assert.deepEqual(discipline(outside),[]);
});
test('all OFF avoids reading any detector candle arrays, including ERR and SMR',()=>{
  const config={enabledDrivers:Object.fromEntries(DRIVER_REGISTRY.map(d=>[d.id,false]))};
  const series=new Proxy({config},{get(target,key){if(key==='config')return config;throw Error('Disabled detector read '+String(key));}});
  const result=evaluateScalperCandidates({series});assert.deepEqual(result.candidates,[]);assert.equal(result.raw_count,0);
});
test('device capabilities are isolated; no token is persisted into candidate scope',async()=>{
  const a=await deviceScope(new Request('https://test',{headers:{'x-amy-device-token':'a'.repeat(64)}}));
  const b=await deviceScope(new Request('https://test',{headers:{'x-amy-device-token':'b'.repeat(64)}}));assert.notEqual(a,b);
  await assert.rejects(()=>deviceScope(new Request('https://test',{headers:{'x-amy-device-token':'bad'}})));
  const input=fixture(),base=evaluateScalperCandidates(input),copy=structuredClone(base);const scoped=scopeEvaluation(base,a);
  assert.deepEqual(base,copy);assert.ok(scoped.candidates.every(c=>c.device_scope===a&&c.id.startsWith(a+':')));
  assert.equal(normalizeDriverToggles({},DRIVER_REGISTRY).DISCIPLINE_SCALPER,true);
  assert.throws(()=>normalizeDriverToggles({AMD:'false'},DRIVER_REGISTRY));
  assert.equal(discipline({...input,series:{...input.series,config:{enabledDrivers:{DISCIPLINE_SCALPER:false}}}}).length,0);assert.ok(discipline(input).length);
});
test('entry waits for a later retest, target remains liquidity, ambiguous exit resolves SL',()=>{
  const candidate=discipline(fixture())[0],entry=candidate.quality.planned_entry_price;
  const early=candle(signal,entry,entry+1,entry-.1,entry,60);
  assert.equal(resolveTriggerEntry(candidate,{m1:[early],nowSeconds:signal+600}).nextOpen,null);
  const later=candle(signal+660,entry+.2,entry+.5,entry-.1,entry+.3,60);
  const filled=resolveTriggerEntry(candidate,{m1:[later],nowSeconds:signal+720});assert.equal(filled.nextOpen.price,entry);
  const active=activateCandidate(candidate,filled.nextOpen).setup;assert.equal(active.target_price,candidate.quality.liquidity_target);assert.equal(active.break_even_trigger,null);
  const bar=candle(signal+780,entry,active.target_price+1,active.stop_loss-1,entry,60);
  const result=advanceSetupLifecycle(active,[bar]);assert.equal(result.setup.status,'SL_HIT');assert.equal(result.setup.result_r,-1);
  assert.equal(activateCandidate(result.setup,filled.nextOpen).setup.status,'SL_HIT');
});
