import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clean,wilderAtr,pivotAt,dashboardEngine,triggerEngine,keyLevels,classicPivot,pivotSources,entryScore,analyzeAmy,baseVisuals,fibonacci,sessions,AMY_POLICY,m15Confirmation} from '../supabase/functions/scalper-engine/amy-ict.mjs';
import {buildMarketContext} from '../supabase/functions/scalper-engine/market-context.mjs';
import {dashboardRows,DISPLAY_DEFAULTS} from '../app/src/main/assets/apps/mapping/js/ict-workspace/ict-presentation.js';
const now=Date.parse('2026-09-24T12:37:00Z')/1000;
const bar=(i,o,h,l,c,seconds=900,start=now-100*900)=>({open_time:start+i*seconds,close_time:start+(i+1)*seconds,open:o,high:h,low:l,close:c,is_closed:true});
function candles(seconds,count,drift=.18,base=3300){return Array.from({length:count},(_,i)=>{const c=base+i*drift+Math.sin(i*Math.PI/4)*2,o=c-drift*.3;return bar(i,o,Math.max(o,c)+.4,Math.min(o,c)-.4,c,seconds,Math.floor(now/seconds)*seconds-count*seconds);});}
const fixture=()=>({nowSeconds:now,h1:candles(3600,60,.25),m15:candles(900,100,-.18),m5:candles(300,80,-.04),d1:candles(86400,45,1),calendar:[{country:'USD',impact:'High',title:'CPI',date:'2026-09-24T16:00:00Z'}]});
const sampleD=()=>({biasDir:1,invalidStatus:0,invalidLevel:90,candle:{close:100},atr:5,priceZone:-1,poiLocation:-1,poiPriority:2,poi:{kind:'OB',side:'BUY',low:98,high:102,ce:100,status:1},sweepStatus:1,sweepDir:1,dolDir:1,dolTarget:120,dolStatus:1,dolAlign:1});
const sampleT=()=>({time:now,candle:bar(0,99,103,95,101),sweepDir:1,bullDisp:true,bearDisp:false,bullBreak:true,bearBreak:false});

test('canonical engine is byte-identical in Android assets and backend',()=>assert.equal(readFileSync('supabase/functions/scalper-engine/amy-ict.mjs','utf8'),readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/amy-ict.js','utf8')));
test('closed-candle validator rejects live, future, invalid geometry and wrong duration',()=>{const valid=bar(0,100,101,99,100);assert.equal(clean([valid,{...valid,open_time:valid.open_time+900,close_time:now+10},{...valid,is_closed:false},{...valid,high:90}],now,900).length,1);assert.equal(clean([valid],now,300).length,0);});
test('pivots wait for confirmation and newer equal extreme wins',()=>{const rows=[bar(0,100,101,99,100),bar(1,100,105,99,100),bar(2,100,105,99,100),bar(3,100,102,99,100)];assert.equal(pivotAt(rows,2,1,1).high,null);assert.equal(pivotAt(rows,3,1,1).high.index,2);});
test('missing candles cannot fabricate a pivot or three-bar FVG',()=>{const rows=[bar(0,100,101,99,100),bar(1,100,110,100,109),bar(2,113,114,112,113)];assert.ok(dashboardEngine(rows).history.length);const gap=rows.map((c,i)=>({...c,open_time:c.open_time+i*500,close_time:c.close_time+i*500}));assert.equal(baseVisuals(gap).fvg.length,0);assert.equal(pivotAt(gap,2,1,1).high,null);});
test('ATR is Wilder RMA and resets across missing feed bars',()=>{const rows=Array.from({length:4},(_,i)=>bar(i,100,100+(i===3?4:1),99,100));const a=wilderAtr(rows,3);assert.equal(a[2],2);assert.equal(a[3],3);rows[3].open_time+=100;rows[3].close_time+=100;assert.equal(wilderAtr(rows,3)[3],null);});
test('M15 history is prefix-invariant and locked invalidation cannot drift with later pivots',()=>{const rows=candles(900,100),full=dashboardEngine(rows);for(const end of [40,57,71,88])assert.deepEqual(dashboardEngine(rows.slice(0,end)).current,full.history[end-1]);let checked=0;for(let i=1;i<full.history.length;i++){const a=full.history[i-1],b=full.history[i];if(a.biasDir&&a.biasDir===b.biasDir&&!b.bullMss&&!b.bearMss){assert.equal(b.invalidLevel,a.invalidLevel);checked++;}}assert.ok(checked>10);});
test('M5 trigger histories never change when future bars are appended',()=>{const rows=candles(300,90),full=triggerEngine(rows);assert.deepEqual(triggerEngine(rows.slice(0,70)),full.slice(0,70));});
test('dual confluence scores cap 110 raw points at 100, without probability text',()=>{const d=sampleD(),t=sampleT(),e=entryScore(d,t,{asiaLow:96});assert.equal(e.buy,100);assert.equal(e.winDir,1);assert.equal(e.grade,'STRONG');assert.equal(Object.values(e.breakdown.buy).reduce((a,b)=>a+b),110);assert.match(e.text,/100\/100 poin/);assert.doesNotMatch(e.text,/%/);});
test('near invalid applies 0.7 penalty and invalid suppresses both scores',()=>{const d=sampleD(),t=sampleT();d.invalidStatus=1;assert.equal(entryScore(d,t,{asiaLow:96}).buy,70);d.invalidStatus=2;const e=entryScore(d,t,{asiaLow:96});assert.equal(e.buy,0);assert.equal(e.sell,0);assert.match(e.text,/Setup batal/);});
test('OB/FVG location and lifecycle are preserved in the full dashboard',()=>{const amy=analyzeAmy(fixture());const rows=dashboardRows(amy);assert.equal(rows.length,15);assert.ok(rows.find(x=>x[0]==='INVALID'));assert.ok(rows.find(x=>x[0]==='POI PRICE'));assert.equal(amy.policy,AMY_POLICY);});
test('M15 direction remains authority when H1 opposes it',()=>{const c=buildMarketContext(fixture());assert.equal(c.fresh,true);assert.equal(c.h1.bias,'BULLISH');assert.equal(c.m15.structure,'BEARISH');assert.equal(c.primary.side,'SELL');assert.equal(c.m15.opposingControl,true);assert.match(c.primary.reasons.join(' '),/H1.*konteks tambahan/);assert.equal(c.execution.aPlusReady,false);});
test('stale data clears the complete AMY engine and cannot produce an event',()=>{const f=fixture();f.nowSeconds+=6*3600;const c=buildMarketContext(f);assert.equal(c.fresh,false);assert.equal(c.amy,null);assert.equal(c.primary,null);assert.equal(c.event,null);});
test('news lock has priority over scoring and narration',()=>{const c=buildMarketContext({...fixture(),calendar:[{country:'USD',impact:'High',title:'CPI',date:'2026-09-24T12:47:00Z'}]});assert.equal(c.news.status,'NEWS_LOCK');assert.equal(c.execution.status,'NOT READY');assert.match(c.marketState,/NEWS LOCK/);assert.equal(c.narrative,c.news.note);});
function sessionBars(start,count){return Array.from({length:count},(_,i)=>bar(i,100+i*.01,102+i*.01,99-i*.01,101,60,Date.parse(start)/1000));}
test('Asia levels lock after complete NY 20–00 and Midnight Open comes from exact M1',()=>{const rows=sessionBars('2026-09-24T00:00:00Z',241),k=keyLevels({m1:rows,nowSeconds:lastClose(rows)});assert.equal(k.asiaStatus,'LOCKED');assert.equal(k.asiaHigh,104.39);assert.equal(k.asiaLow,96.61);assert.equal(k.midnightOpen,102.4);});
const lastClose=rows=>rows.at(-1).close_time;
test('incomplete Asia session and missing midnight never fabricate fallback values',()=>{const rows=sessionBars('2026-09-24T00:00:00Z',241).filter((_,i)=>i!==120&&i!==240),k=keyLevels({m1:rows,nowSeconds:Date.parse('2026-09-24T04:01:00Z')/1000});assert.equal(k.asiaStatus,'UNAVAILABLE');assert.equal(k.midnightOpen,null);});
test('Asia key level snapshots remain causal through a forming session',()=>{const rows=sessionBars('2026-09-24T00:00:00Z',241),prefix=rows.slice(0,60),k=keyLevels({m1:prefix,nowSeconds:lastClose(prefix)});assert.equal(k.asiaStatus,'TRACKING');assert.equal(k.asiaHigh,102.59);});
test('killzones use named timezones with DST rather than fixed UTC offsets',()=>{assert.ok(sessions(Date.parse('2026-01-15T12:30:00Z')/1000).includes('NY'));assert.ok(sessions(Date.parse('2026-07-15T11:30:00Z')/1000).includes('NY'));assert.ok(!sessions(Date.parse('2026-07-15T13:30:00Z')/1000).includes('NY'));});
test('classic pivots implement P and R1–R4/S1–S4',()=>{assert.deepEqual(classicPivot({high:110,low:90,close:100}),{PIVOT:100,R1:110,S1:90,R2:120,S2:80,R3:130,S3:70,R4:150,S4:50});});
test('weekly/monthly pivots require completed period data',()=>{const p=pivotSources([],now);assert.equal(p.W,null);assert.equal(p.M,null);assert.equal(p.D,null);});
test('ICT FVG displacement uses both small wicks and labels implied FVG separately',()=>{const rows=Array.from({length:7},(_,i)=>bar(i,100,101,99,100.5));rows.push(bar(7,100,110,100,109),bar(8,113,114,112,113));const v=baseVisuals(rows);assert.ok(v.fvg.some(z=>z.side==='BUY'));assert.ok(v.displacement.some(z=>z.side==='BUY'));const wick=structuredClone(rows);wick[7].low=90;assert.equal(baseVisuals(wick).fvg.length,0);});
test('Volume Imbalance draws distinct body edges and daily gap midpoint',()=>{const rows=[bar(0,100,102,99,101),bar(1,103,105,101,104)];const v=baseVisuals(rows);assert.equal(v.vi.length,1);assert.equal(v.vi[0].low,101);assert.equal(v.vi[0].high,103);assert.equal(v.vi[0].ce,102);});
test('NWOG is Friday close to Monday open, NDOG is previous close to next day open',()=>{const f=Date.parse('2026-09-18T21:00:00Z')/1000,m=Date.parse('2026-09-21T00:00:00Z')/1000,rows=[bar(0,100,102,99,101,900,f),bar(0,104,105,103,104,900,m)];const v=baseVisuals(rows);assert.equal(v.gaps.find(x=>x.kind==='NWOG').ce,102.5);assert.equal(v.gaps.find(x=>x.kind==='NDOG').low,101);});
test('Fibonacci exposes all eight ratios including 1.618',()=>{const f=fibonacci([{time:1,low:90,high:100,ce:95},{time:2,low:110,high:120,ce:115}]);assert.deepEqual(f.map(x=>x.ratio),[0,.236,.382,.5,.618,.786,1,1.618]);assert.equal(f[0].price,120);assert.equal(f[6].price,90);});
test('visual controls cover full ICT layers without modifying server scoring',()=>{for(const key of ['bpr','gapType','vi','nwog','ndog','fib','killzones','pivotTf','mo','asia','breaker','polarity','signals','panel'])assert.ok(key in DISPLAY_DEFAULTS);const app=readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/app.js','utf8');assert.match(app,/context\.amy/);assert.doesNotMatch(app,/analyzeAmy\(/);});

test('new Dashboard FVG stays fresh; a later test and rejection become Active then Mitigated',()=>{
  const rows=[bar(0,100,101,99,100),bar(1,100,110,100,109),bar(2,113,114,112,113)];
  assert.equal(dashboardEngine(rows).zones.bullFvg.status,1);
  rows.push(bar(3,113,114,110,113));assert.equal(dashboardEngine(rows).zones.bullFvg.status,2);
  rows.push(bar(4,114,115,113,114));assert.equal(dashboardEngine(rows).zones.bullFvg.status,3);
  rows.push(bar(5,100,100.5,99,100));assert.equal(dashboardEngine(rows).zones.bullFvg.status,4);
});
function referenceFixture(){let seed=31,price=100;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};return Array.from({length:200},(_,i)=>{const o=price;price+=(rand()-.5)*12;const wick=rand()*.2;return bar(i,o,Math.max(o,price)+wick,Math.min(o,price)-wick,price);});}
test('BPR is an actual opposing-FVG overlap, and broken OB exposes timed polarity change',()=>{
  const v=baseVisuals(referenceFixture());assert.ok(v.bpr.length>0);for(const z of v.bpr)assert.ok(z.low<z.high);
  assert.ok(v.ob.some(z=>z.breaker&&z.breakTime>z.formedAt));assert.ok(v.implied.length>0);assert.ok(v.events.some(x=>x.kind==='MSS'));assert.ok(v.events.some(x=>x.kind==='BOS'));
});
test('chart candle snapshots are the same inputs that generated dashboard/trigger',()=>{
  const input=fixture(),amy=analyzeAmy(input);assert.deepEqual(amy.chartCandles.M15.at(-1),clean(input.m15,now,900).at(-1));assert.deepEqual(amy.dashboard.candle,amy.chartCandles.M15.at(-1));assert.deepEqual(amy.trigger.candle,amy.chartCandles.M5.at(-1));
});
test('market gaps restart lower-timeframe momentum confirmation',()=>{
  const input=fixture();input.m5=input.m5.map((c,i)=>i===78?{...c,open_time:c.open_time+10,close_time:c.close_time+10}:c);
  const c=buildMarketContext(input);assert.equal(c.amy.trigger.bullDisp,false);assert.equal(c.amy.trigger.bearDisp,false);assert.equal(c.execution.aPlusReady,false);assert.equal(c.event,null);
});

test('execution geometry uses latest closed M5 price and counter-bias scores are explicit',()=>{
  const input=fixture();input.m15=candles(900,100,.18);input.m5=candles(300,80,-.04);
  const c=buildMarketContext(input);assert.equal(c.price,input.m5.at(-1).close);assert.equal(c.execution.checklist.find(x=>x.label==='Invalidasi M15 sesuai arah').ok,false);assert.equal(c.execution.aPlusReady,false);
  if(c.amy.entry.winDir!==c.amy.dashboard.biasDir&&c.amy.entry.winDir){assert.match(c.marketState,/BERLAWANAN BIAS/);assert.match(c.narrative,/berlawanan bias/);}
});

test('primary target never exposes opposing, already reached or wrong-side DOL liquidity',()=>{
  for(let seed=1;seed<=30;seed++){
    let state=seed;const rand=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
    const make=(seconds,count)=>{let price=3300;return Array.from({length:count},(_,i)=>{const o=price;price+=(rand()-.5)*6;return bar(i,o,Math.max(o,price)+rand()*3,Math.min(o,price)-rand()*3,price,seconds,Math.floor(now/seconds)*seconds-count*seconds);});};
    const c=buildMarketContext({...fixture(),m15:make(900,200),m5:make(300,100)});
    const d=c.amy.dashboard,p=c.primary;if(!p)continue;
    const allowed=d.dolStatus===1&&d.dolDir===d.biasDir&&(p.side==='BUY'?d.dolTarget>c.price:d.dolTarget<c.price);
    if(!allowed)assert.equal(p.target,null);else assert.equal(p.target,d.dolTarget);
  }
});

test('M15 Wick Rejection >= 1.2x body at POI/SSL confirms BUY directly without waiting for M5 break', () => {
  const dWick = { biasDir: 1, invalidStatus: 0, ssl: 97, candle: { open: 100, close: 101, low: 95, high: 101.5 } };
  const conf = m15Confirmation(dWick, { ssl: 97 });
  assert.equal(conf.confirmed, true);
  assert.equal(conf.wickReject, true);
  assert.equal(conf.type, 'WICK_REJECTION');
  assert.equal(conf.side, 'BUY');
});

test('M15 Displacement Break (BOS/MSS) searah bias dengan body tebal confirms directly', () => {
  const dDisp = { biasDir: 1, invalidStatus: 0, bullMss: true, bullDisp: true, candle: { open: 100, close: 108, low: 99.5, high: 109 } };
  const conf = m15Confirmation(dDisp);
  assert.equal(conf.confirmed, true);
  assert.equal(conf.displacementBreak, true);
  assert.equal(conf.type, 'DISPLACEMENT_BREAK');
  assert.equal(conf.side, 'BUY');
});

test('M15 50% CE Bounce di Dealing Range yang sehat confirms directly', () => {
  const dCe = { biasDir: 1, invalidStatus: 0, priceZone: -1, locationStatus: 1, eq: 100, candle: { open: 99.5, close: 101, low: 98, high: 101.5 } };
  const conf = m15Confirmation(dCe);
  assert.equal(conf.confirmed, true);
  assert.equal(conf.ceBounce, true);
  assert.equal(conf.type, 'CE_BOUNCE');
  assert.equal(conf.side, 'BUY');
});

test('M15 direct confirmation sets CONFIRMED status and activates Entry Assistant plan without waiting for M5 break', () => {
  const m15Bars = candles(900, 100, .18);
  const lastM15 = m15Bars[99];
  lastM15.open = 3318;
  lastM15.close = 3319;
  lastM15.low = 3310;
  lastM15.high = 3319.5;
  const m5Bars = candles(300, 80, 0); // Flat M5 without break or displacement
  const ctx = buildMarketContext({
    nowSeconds: now,
    h1: candles(3600, 60, .25),
    m15: m15Bars,
    m5: m5Bars,
    d1: candles(86400, 45, 1),
    calendar: [{ country: 'USD', impact: 'High', title: 'CPI', date: '2026-09-24T16:00:00Z' }]
  });
  assert.equal(ctx.m15.directConfirmed, true);
  assert.equal(ctx.m5.status, 'CONFIRMED');
  assert.equal(ctx.execution.status, 'READY');
  assert.ok(ctx.plan);
  assert.equal(ctx.plan.status, 'READY');
});
