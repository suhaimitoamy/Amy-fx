import test from 'node:test';
import assert from 'node:assert/strict';
import {engineFresh,setupView,setupList,loadSetups} from '../app/src/main/assets/apps/mapping/js/ict-workspace/scalper-model.js';
const now=Date.parse('2026-09-14T12:00:00Z');
const setup={id:'one',symbol:'XAU/USD',direction:'BUY',timeframe:'M5',entry:2500,stopLoss:2495,tp1:2510,tp2:2520,status:'ACTIVE',recommendationStatus:'VALID',lastEvaluatedOpenTime:now/1000-60,entryTimestamp:now/1000-300,maxHoldSeconds:86400};
const payload={ok:true,engine:{status:'COMPLETED',completed_at:new Date(now-20000).toISOString()},active:[setup],history:[]};
test('server heartbeat cannot be replaced by a fresh HTTP response timestamp',()=>{
 assert.equal(engineFresh(payload,now),true);
 for(const engine of [null,{status:'FAILED',completed_at:new Date(now).toISOString()},{status:'COMPLETED',completed_at:new Date(now-151000).toISOString()},{status:'COMPLETED',completed_at:new Date(now+60000).toISOString()}])assert.equal(engineFresh({...payload,engine,generatedAt:new Date(now).toISOString()},now),false);
});
test('BUY and SELL preserve backend prices and validate directional geometry',()=>{
 const buy=setupView(setup,true,now);assert.equal(buy.actionable,true);assert.equal(buy.rr,4);assert.equal(buy.entry,2500);
 const sell=setupView({...setup,direction:'SELL',stopLoss:2505,tp1:2490,tp2:2480},true,now);assert.equal(sell.actionable,true);assert.equal(sell.rr,4);
 for(const patch of [{stopLoss:null},{entry:''},{stopLoss:2505},{tp2:2490},{direction:'WAIT'}])assert.equal(setupView({...setup,...patch},true,now).actionable,false);
});
test('pending, terminal, stale evaluations, expired and invalid recommendations cannot become entries',()=>{
 for(const status of ['WAITING_TRIGGER','WAITING_NEXT_OPEN','ENTRY_READY','TP_HIT','SL_HIT','CANCELLED','INVALIDATED','BE_ACTIVE','UNKNOWN'])assert.equal(setupView({...setup,status},true,now).actionable,false);
 assert.equal(setupView(setup,false,now).actionable,false);
 assert.equal(setupView({...setup,lastEvaluatedOpenTime:now/1000-900},true,now).actionable,false);
 assert.equal(setupView({...setup,entryTimestamp:now/1000-90000},true,now).actionable,false);
 assert.equal(setupView({...setup,recommendationStatus:'INVALID'},true,now).actionable,false);
});
test('removed, terminal, duplicate and unrelated-symbol setups do not survive an authoritative response',()=>{
 assert.equal(setupList({...payload,active:[setup,setup,{...setup,id:'done',status:'TP_HIT'},{...setup,id:'other',symbol:'EUR/USD'}]},true,now).length,1);
 assert.deepEqual(setupList({...payload,active:[]},true,now),[]);
});
test('provider forwards device scope, abort signal and selected notification ID without caching',async()=>{
 const controller=new AbortController();let called;
 const result=await loadSetups({headers:{'x-amy-device-token':'fixture'},signal:controller.signal,selectedId:'a&b',fetcher:async(url,options)=>{called={url,options};return {ok:true,json:async()=>payload};}});
 assert.equal(result,payload);assert.equal(new URL(called.url).searchParams.get('setup_id'),'a&b');assert.equal(called.options.headers['x-amy-device-token'],'fixture');assert.equal(called.options.cache,'no-store');assert.equal(called.options.signal,controller.signal);
 await assert.rejects(loadSetups({fetcher:async()=>({ok:false,status:503})}),/503/);
 await assert.rejects(loadSetups({fetcher:async()=>({ok:true,json:async()=>({ok:true})})}),/tidak lengkap/);
});
