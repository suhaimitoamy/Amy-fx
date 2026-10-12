import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {aPlusEligible,buildMarketContext,closedCandles,confirmation,zones,evaluateEconomicCalendar,calculateConfluenceScore} from '../supabase/functions/scalper-engine/market-context.mjs';
import {SIX_DRIVERS} from '../supabase/functions/scalper-engine/six-drivers.mjs';
import {currentDriverEvaluation,driverSetupReady} from '../app/src/main/assets/apps/mapping/js/ict-workspace/driver-model.js';
import {currentContext} from '../app/src/main/assets/apps/mapping/js/ict-workspace/context-model.js';

const now=Date.parse('2026-09-24T12:37:00Z')/1000;
function candles(seconds,count,base,drift,amplitude) {
  return Array.from({length:count},(_,i)=>{
    const close=base+i*drift+Math.sin(i*Math.PI/4)*amplitude;
    const open=close-drift*0.3,open_time=Math.floor(now/seconds)*seconds-(count-i)*seconds;
    return {open_time,close_time:open_time+seconds,open,high:Math.max(open,close)+0.4,low:Math.min(open,close)-0.4,close,is_closed:true};
  });
}
const input=(drift=-.18)=>({nowSeconds:now,h1:candles(3600,60,3300,.25,2),m15:candles(900,100,3345,drift,1.8),
  m5:candles(300,80,3325,-.04,.7),d1:candles(86400,10,3290,1,2)});
const calendar=date=>[{country:'USD',impact:'High',title:'CPI',date}];

function panel(context,storage=new Map()) {
  const nodes=new Map(),events=[],listeners=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',style:{}});return nodes.get(id);};
  const sandbox={document:{getElementById:node,addEventListener(){},hidden:false},
    window:{addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:e=>events.push(e)},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    CustomEvent:class {constructor(type,opts){this.type=type;this.detail=opts.detail;}},
    currentContext:p=>currentContext(p,now*1000),deviceHeaders:()=>({}),ENDPOINT:'https://example.test',SIX_DRIVERS,currentDriverEvaluation,driverSetupReady,methodControls:()=>'',initializeMethods:async()=>{},
    fetch:()=>new Promise(()=>{}),AbortController,setTimeout:()=>1,clearTimeout(){}};
  vm.createContext(sandbox);
  const source=readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/context-panel.js','utf8').replace(/^import .*;\n/gm,'');
  vm.runInContext(source,sandbox);
  if(context) {
    sandbox.fixture={ok:true,mode:'market_context',context,
      engine:{status:'COMPLETED',completed_at:new Date(now*1000).toISOString(),result:{engine:'amyfx-gold-context-v1'}}};
    vm.runInContext('payload=fixture;failed=false;render();',sandbox);
  }
  return {sandbox,node,events,listeners,storage};
}

test('disconnect revokes READY, global context, chart overlay, and cached authority',()=>{
  const c=buildMarketContext(input(.18));
  c.execution={status:'READY TO REVIEW',aPlusReady:true};
  const ui=panel(c);
  assert.equal(ui.node('execution-status').textContent,'SIAP DITINJAU');
  ui.listeners.get('offline')();
  assert.equal(ui.node('execution-status').textContent,'BELUM SIAP');
  assert.equal(ui.sandbox.window.AmyMarketContext,null);
  assert.equal(ui.events.at(-1).detail,null);
  assert.equal(ui.storage.has('amyfx.market-context.v1'),false);
  assert.doesNotMatch(ui.node('driver-tournament-list').innerHTML,/TRIGGERED|CONFIRMED/);
});

test('reopening with cached context cannot invent a fresh server heartbeat',()=>{
  const cached=buildMarketContext(input(.18));
  cached.execution={status:'READY TO REVIEW',aPlusReady:true};
  const ui=panel(null,new Map([['amyfx.market-context.v1',JSON.stringify(cached)]]));
  assert.equal(ui.node('execution-status').textContent,'BELUM SIAP');
  assert.equal(ui.sandbox.window.AmyMarketContext,null);
});

test('expired server heartbeat clears previously rendered readiness',()=>{
  const c=buildMarketContext(input(.18));c.execution={status:'READY TO REVIEW',aPlusReady:true};
  const ui=panel(c);
  vm.runInContext("payload.engine.completed_at='2026-09-24T12:20:00Z';render();",ui.sandbox);
  assert.equal(ui.node('execution-status').textContent,'BELUM SIAP');
  assert.equal(ui.events.at(-1).detail,null);
});

test('server context readiness does not impersonate six independent strategy triggers',()=>{
  const c=buildMarketContext(input(.18));c.execution={status:'READY TO REVIEW',aPlusReady:true};
  const ui=panel(c,new Map([['amyfx.driver-tournament.v2',JSON.stringify([{status:'TRIGGERED',winRate:99}])]]));
  const html=ui.node('driver-tournament-list').innerHTML;
  assert.equal((html.match(/BELUM DIEVALUASI/g)||[]).length,6);
  assert.doesNotMatch(html,/TRIGGERED|RUNNER TRIGGERED|78\.6%<|68\.9%<|99%/);
  assert.match(html,/WR live: <strong>belum tersedia/);
});

test('archive statistics use exact driver IDs, deduplicate outcomes, and ignore fuzzy model names',()=>{
  const ui=panel(buildMarketContext(input(.18)));
  ui.sandbox.historyFixture=[
    {id:'a',symbol:'XAU/USD',driverId:'HIGH_WINRATE_SNIPER_70',status:'TP_HIT'},
    {id:'a',symbol:'XAU/USD',driverId:'HIGH_WINRATE_SNIPER_70',status:'TP_HIT'},
    {id:'b',symbol:'XAU/USD',driverId:'HIGH_WINRATE_SNIPER_70',status:'SL_HIT'},
    {id:'c',symbol:'XAU/USD',driverId:'OTHER_SNIPER',status:'TP_HIT'}];
  const drivers=vm.runInContext('getTournamentDrivers(historyFixture)',ui.sandbox);
  assert.equal(drivers[0].samples,2);assert.equal(drivers[0].archiveWR,'50.0');assert.equal(drivers[0].score,-5);
});

test('unconfirmed market is never labeled Grade A+',()=>{
  const c=buildMarketContext(input(.18));
  assert.equal(c.m15.opposingControl,false);
  assert.equal(c.execution.status,'NOT READY');
  const ui=panel(c);
  assert.doesNotMatch(ui.node('m15-risk').textContent,/Grade A\+/);
  assert.match(ui.node('m15-risk').textContent,/BELUM A\+/);
  const complete={...c,confluence:{score:90,grade:'STRONG'},execution:{status:'READY TO REVIEW',aPlusReady:true}};
  assert.match(panel(complete).node('m15-risk').textContent,/Grade A\+/);
  assert.doesNotMatch(panel({...complete,execution:{status:'NOT READY',aPlusReady:true}}).node('m15-risk').textContent,/Grade A\+/);
});

test('missing bars cannot fabricate FVGs, while contiguous BUY and SELL gaps remain valid',()=>{
  const bar=(t,open,high,low,close)=>({open_time:t,close_time:t+900,open,high,low,close});
  const t=now-5000;
  const valid=[bar(t,100,101,99,100),bar(t+900,102,106,101,105),bar(t+1800,106,107,105,106)];
  assert.equal(zones(valid)[0]?.side,'BUY');
  const gaps=valid.map((c,i)=>({...c,open_time:t+i*2000,close_time:t+i*2000+900}));
  assert.equal(zones(closedCandles(gaps,now)).length,0);
  const mirror=c=>({...c,open:300-c.open,high:300-c.low,low:300-c.high,close:300-c.close});
  assert.equal(zones(valid.map(mirror))[0]?.side,'SELL');
  assert.equal(zones(gaps.map(mirror)).length,0);
});

test('confirmation cannot carry a sweep across a missing candle to later MSS/FVG',()=>{
  const t=now-40*60;
  const bar=(i,open,high,low,close)=>({open_time:t+i*60,close_time:t+(i+1)*60,open,high,low,close});
  const rows=Array.from({length:35},(_,i)=>bar(i,102,103,101,102));
  rows.push(bar(35,102,103,98,102),bar(36,102,107,101,106),bar(37,106,110,104,109));
  const poi={formedAt:t,low:99,high:104};
  assert.equal(confirmation(rows,poi,'BUY').status,'CONFIRMED');
  assert.equal(confirmation(rows.filter((_,i)=>i!==34),poi,'BUY').status,'WAITING');
});

test('old, next-week, empty, and malformed calendars are unverified, not SAFE',()=>{
  for(const rows of [calendar('2025-01-01T12:00:00Z'),calendar('2026-10-01T12:00:00Z'),[],calendar('bad')]) {
    assert.equal(evaluateEconomicCalendar(rows,now).status,'UNVERIFIED');
  }
  assert.equal(evaluateEconomicCalendar(calendar('2026-09-24T12:47:00Z'),now).status,'NEWS_LOCK');
  assert.equal(evaluateEconomicCalendar(calendar('2026-09-25T16:00:00Z'),now).status,'SAFE');
  // UTC Sunday is still Saturday in the provider's New York calendar.
  const boundary=Date.parse('2026-09-27T01:00:00Z')/1000;
  assert.equal(evaluateEconomicCalendar(calendar('2026-09-25T16:00:00Z'),boundary).status,'SAFE');
  assert.equal(evaluateEconomicCalendar(calendar('2026-09-25T16:00:00Z'),boundary+5*3600).status,'UNVERIFIED');
});

test('M15 scenario locks its own invalidation without inventing an opposite plan',()=>{
  const c=buildMarketContext(input());
  assert.equal(c.primary.side,'SELL');assert.equal(c.alternative,null);
  assert.equal(c.primary.invalidation,c.amy.dashboard.invalidLevel);
  assert.ok(c.primary.invalidation>c.price);
  assert.equal(c.event,null);
});

test('A+ eligibility requires a real directional target and verified news, for both BUY and SELL',()=>{
  const eligible={ready:true,confluence:{score:90},dr:{locationStatus:1},side:'BUY',price:100,
    target:{status:'ACTIVE',side:'BUY',level:110},news:{status:'SAFE'}};
  assert.equal(aPlusEligible(eligible),true);
  for(const change of [{target:null},{target:{...eligible.target,level:95}},{target:{...eligible.target,status:'TAKEN'}},
    {target:{...eligible.target,side:'SELL'}},{news:{status:'UNVERIFIED'}},{news:{status:'NEWS_LOCK'}},
    {dr:{locationStatus:-1}},{ready:false},{confluence:{score:74}}])assert.equal(aPlusEligible({...eligible,...change}),false);
  assert.equal(aPlusEligible({...eligible,side:'SELL',target:{status:'ACTIVE',side:'SELL',level:90}}),true);
  assert.equal(aPlusEligible({...eligible,side:'SELL',target:{status:'ACTIVE',side:'SELL',level:110}}),false);
});

test('score breakdown totals 100 and missing targets lose points rather than being clipped away',()=>{
  const data={h1Struct:{bias:'BULLISH',health:'HEALTHY'},side:'BUY',aligned:true,poi:{},nearPoi:true,
    confirming:{status:'CONFIRMED',sweep:{},mss:{},microFvg:{}},dr:{locationStatus:1},session:'LONDON'};
  const complete=calculateConfluenceScore({...data,levels:[{status:'ACTIVE',side:'BUY',level:110}]});
  assert.equal(complete.score,100);
  assert.equal(Object.values(complete.breakdown).reduce((sum,x)=>sum+x,0),100);
  assert.equal(calculateConfluenceScore({...data,levels:[]}).score,90);
});

test('news lock takes precedence over optimistic market narration and A+ readiness',()=>{
  const c=buildMarketContext({...input(.18),calendar:calendar('2026-09-24T12:47:00Z')});
  assert.match(c.marketState,/NEWS LOCK/);
  assert.match(c.narrative,/NEWS LOCK/);
  assert.equal(c.execution.status,'NOT READY');assert.equal(c.execution.aPlusReady,false);
  assert.match(c.event.title,/Tahan Dulu/);
});
