import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {MODEL} from '../app/src/main/assets/apps/mapping/js/ict-workspace/engine.js';
import {isFresh,liquidityBands,nearestLevels,makeSnapshot} from '../app/src/main/assets/apps/mapping/js/ict-workspace/snapshot.js';
function home(saved=null,blocked=false){
 const listeners={},main={innerHTML:''};
 const context={document:{addEventListener:(n,cb)=>{(listeners[n]??=[]).push(cb);},getElementById:id=>id==='main-content'?main:null,querySelectorAll:()=>[]},
 localStorage:{getItem:()=>{if(blocked)throw Error('blocked');return saved;},setItem:()=>{if(blocked)throw Error('blocked');}},
 fetch:()=>new Promise(()=>{}),addEventListener:()=>{},setInterval:()=>0,setTimeout:()=>0,console,location:{},Notification:undefined};
 context.window=context;vm.runInNewContext(readFileSync('app/src/main/assets/app.js','utf8'),context);
 for(const cb of listeners.DOMContentLoaded||[])cb();return main.innerHTML;
}
test('cold home paints all four modules without waiting for any fetch',()=>{
 const html=home();for(const module of ['mapping','intel','jurnal','academy'])assert.ok(html.includes(`data-open="${module}"`));
 assert.equal((html.match(/class="quick-card/g)||[]).length,4);
});
test('obsolete saved tab and denied storage still paint the home',()=>{
 assert.match(home('obsolete-menu'),/Menu Utama/);assert.match(home(null,true),/Menu Utama/);
});
const now=Date.UTC(2026,8,14,12), snapshot={model:MODEL.id,tf:'M5',fresh:true,sourceTime:now/1000-400,close:2500,
 levels:[{kind:'high',level:2504,confirmed:1},{kind:'high',level:2504.8,confirmed:2},{kind:'high',level:2505.5},
 {kind:'low',level:2497},{kind:'low',level:2496.5},{kind:'high',level:2501,used:true},{kind:'low',level:2510}]};
test('bands preserve original unswept levels and bound each group, without chain expansion',()=>{
 const before=JSON.stringify(snapshot),bands=liquidityBands(snapshot);
 assert.equal(bands.length,3);assert.equal(bands.find(b=>b.low===2504).levels.length,2);
 assert.ok(bands.every(b=>b.high-b.low<=1));assert.equal(JSON.stringify(snapshot),before);
 assert.deepEqual(nearestLevels(snapshot),{bsl:2504,ssl:2497});
});
test('freshness uses source candle time, not when the cache was read',()=>{
 assert.equal(isFresh(snapshot,now),true);assert.equal(isFresh({...snapshot,capturedAt:now+999999},now+999999),false);
 assert.equal(isFresh({...snapshot,fresh:false},now),false);assert.equal(isFresh({...snapshot,sourceTime:now/1000+10},now),false);
 assert.deepEqual(liquidityBands(null),[]);
});
test('Mapping and Intel snapshots preserve the exact close, levels and plan',()=>{
 const result={...snapshot,candles:[{close:2500}],plan:{entry:2490,sl:2480,tp:2510}};
 const value=makeSnapshot(result,now);assert.equal(value.close,2500);assert.deepEqual(value.levels,result.levels);
 assert.deepEqual(value.plan,result.plan);assert.notEqual(value.plan,result.plan);
});
function intel(loadCandles,analyze,cached=snapshot) {
 const nodes=new Map(),listeners={};
 const context={makeSnapshot,validSnapshot:undefined,isFresh,liquidityBands,nearestLevels,SNAPSHOT_KEY:'amyfx.ict.mapping.v1',loadCandles,analyze,
  document:{hidden:false,getElementById:id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:''});return nodes.get(id);},addEventListener:()=>{}},
  localStorage:{getItem:()=>JSON.stringify(cached),setItem:()=>{}},setInterval:()=>0,clearInterval:()=>{},setTimeout,clearTimeout,AbortController,
  CustomEvent:class{},dispatchEvent:()=>{},addEventListener:(name,cb)=>{listeners[name]=cb;}};
 context.validSnapshot=value=>value?.model===MODEL.id && ['M5','M15'].includes(value.tf)&&Number.isFinite(value.close)&&Number.isFinite(value.sourceTime)&&Array.isArray(value.levels);
 context.window=context;
 const code=readFileSync('app/src/main/assets/apps/market-intel/ict-intel.js','utf8').replace(/^import .*;\n/gm,'');
 vm.runInNewContext(code,context);return {context,nodes,listeners};
}
test('Intel paints cached levels, fetches M15 once, and updates all three views together',async()=>{
 let release,calls=0;const gate=new Promise(r=>release=r);
 const end=Math.floor((Date.now()/1000-30)/900)*900;
 const candles=Array.from({length:9},(_,i)=>({open_time:end-(9-i)*900,open:2500,close:i===8?2502:2500,
  high:i===2?2504:i===8?2503:2501,low:i===2?2497:2498}));
 const {context,nodes}=intel(async()=>{calls++;await gate;return {candles,degraded:false};});
 assert.match(nodes.get('market-command-strip').innerHTML,/2500.00/);
 const first=context.AmyICTIntel.refresh(),second=context.AmyICTIntel.refresh();assert.equal(calls,1);
 release();await Promise.all([first,second]);
 assert.match(nodes.get('market-command-strip').innerHTML,/2502.00/);
 assert.match(nodes.get('heatmap-canvas').innerHTML,/2502.00/);
 assert.match(nodes.get('liquidity-list').innerHTML,/2504.00/);
});
test('failed or older provider responses retain the last Mapping snapshot with an explicit stale label',async()=>{
 for(const broken of [true,false]) {
  const {context,nodes}=intel(async()=>{if(broken)throw Error('offline');return {candles:[]};},()=>({...snapshot,sourceTime:1,candles:[{close:100}],plan:null}));
  await context.AmyICTIntel.refresh();
  assert.match(nodes.get('market-command-strip').innerHTML,/2500.00/);
  assert.match(nodes.get('market-command-strip').innerHTML,/Referensi lama/);
  assert.match(nodes.get('intel-briefing').innerHTML,/Pembaruan gagal/);
 }
});
test('active Intel shares the Mapping provider without a legacy fetch router or heatmap writer',()=>{
 const html=readFileSync('app/src/main/assets/apps/market-intel/index.html','utf8');
 assert.doesNotMatch(html,/<script[^>]+(?:private-market-api-router|heatmap-v2)\.js/);
 const code=readFileSync('app/src/main/assets/apps/market-intel/ict-intel.js','utf8');
 assert.match(code,/mapping\/js\/ict-workspace\/data.js/);assert.match(code,/liquidityOnly/);
 assert.doesNotMatch(code,/import \{analyze\}/);
});
