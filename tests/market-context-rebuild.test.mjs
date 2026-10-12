import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Archived Pro374 baseline; the active M15-first engine is covered by mapping-amy-ict-pro375.test.mjs.
import {buildLegacyMarketContext as buildMarketContext,confirmation,liquidity,structure,zones,evaluateEconomicCalendar,dealingRange,calculateConfluenceScore,contiguous,isWeekendGap,marketElapsedSeconds} from '../supabase/functions/scalper-engine/market-context.mjs';
import {currentContext} from '../app/src/main/assets/apps/mapping/js/ict-workspace/context-model.js';

const now=Date.parse('2026-09-24T12:37:00Z')/1000;
function candles(seconds,count,base,drift,amplitude){
  return Array.from({length:count},(_,i)=>{
    const close=base+i*drift+Math.sin(i*Math.PI/4)*amplitude;
    const open=close-drift*0.3,open_time=Math.floor(now/seconds)*seconds-(count-i)*seconds;
    return {open_time,close_time:open_time+seconds,open,high:Math.max(open,close)+0.4,low:Math.min(open,close)-0.4,close,is_closed:true};
  });
}
const input=()=>({nowSeconds:now,h1:candles(3600,60,3300,.25,2),m15:candles(900,100,3345,-.18,1.8),
  m1:candles(60,80,3325,-.04,.7),d1:candles(86400,10,3290,1,2)});

test('M15 reversal raises an early warning while H1 remains bullish, never a buy order',()=>{
  const context=buildMarketContext(input());
  assert.equal(context.h1.bias,'BULLISH');
  assert.equal(context.m15.control,'SELLER');
  assert.equal(context.h1.health,'WEAKENING');
  assert.equal(context.m15.opposingControl,true);
  assert.equal(context.marketState,'BULLISH PULLBACK (Koreksi Diskon)');
  assert.match(context.narrative,/BULLISH PULLBACK/);
  assert.equal(context.event,null); // Server WAJIB DIAM during counter-trend pullback (no scalp trap notification)
  assert.equal(context.execution.status,'NOT READY');
  assert.equal(context.primary.side,'BUY');
  assert.equal(context.alternative.side,'SELL');
  assert.ok(context.alternative.activation.some(x=>x.includes(context.primary.invalidation.toFixed(2))));
  assert.equal(context.news.status,'UNVERIFIED');
});

test('historical structure break classification cannot read swings confirmed later',()=>{
  const base=now-6*3600;
  const closes=[100,100,106,103,103,103];
  const bars=closes.map((close,i)=>({open_time:base+i*3600,close_time:base+(i+1)*3600,
    open:close,high:close+1,low:close-1,close}));
  const highs=[{level:105,index:0,confirmedAt:bars[1].close_time},
    {level:104,index:3,confirmedAt:bars[4].close_time},
    {level:103,index:4,confirmedAt:bars[5].close_time}];
  const result=structure(bars,{highs,lows:[]});
  assert.equal(result.lastBreak?.time,bars[2].close_time);
  assert.equal(result.lastBreak?.type,'BOS');
});

test('stale and malformed candles cannot produce scenarios or notifications',()=>{
  const data=input();data.nowSeconds+=5*3600;
  const result=buildMarketContext(data);
  assert.equal(result.fresh,false);assert.equal(result.primary,null);assert.equal(result.event,null);
  assert.equal(result.execution.status,'NOT READY');
  const poisoned=input();poisoned.m1=poisoned.m1.map(x=>({...x,is_closed:false}));
  assert.equal(buildMarketContext(poisoned).fresh,false);
});

test('FVG lifecycle uses subsequent closed candles; broken zone is invalid',()=>{
  const base=now-8*900;
  const bar=(i,low,high,close)=>({open_time:base+i*900,close_time:base+(i+1)*900,open:close,low,high,close,is_closed:true});
  const rows=[bar(0,99,101,100),bar(1,100,102,101),bar(2,103,105,104)];
  assert.equal(zones(rows).find(z=>z.kind==='FVG')?.lifecycle,'FRESH');
  assert.equal(zones([...rows,bar(3,102.2,104,103.5)]).find(z=>z.kind==='FVG')?.lifecycle,'TESTED');
  assert.equal(zones([...rows,bar(3,99.5,104,100)]).find(z=>z.kind==='FVG')?.lifecycle,'INVALID');
});

test('M1 requires area contact, sweep, break and micro FVG for confirmation',()=>{
  const start=now-40*60;
  const base=Array.from({length:35},(_,i)=>({open_time:start+i*60,close_time:start+(i+1)*60,open:102,high:103,low:101,close:102,is_closed:true}));
  const bar=(i,open,high,low,close)=>({open_time:start+i*60,close_time:start+(i+1)*60,open,high,low,close,is_closed:true});
  const zone={formedAt:start,low:99,high:104};
  assert.equal(confirmation(base,null,'BUY').status,'WAITING');
  const sweep=bar(35,102,103,98,102);
  assert.equal(confirmation([...base,sweep],zone,'BUY').status,'CONFIRMING');
  const breakBar=bar(36,102,107,101,106),fvg=bar(37,106,110,104,109);
  const result=confirmation([...base,sweep,breakBar,fvg],zone,'BUY');
  assert.equal(result.status,'CONFIRMED');assert.equal(result.sweep.level,101);
  assert.ok(result.mss.level>=103);assert.ok(result.microFvg.low<result.microFvg.high);
  assert.equal(confirmation([...base,sweep,breakBar,fvg,bar(38,109,109,97,98)],zone,'BUY').status,'FAILED');
});

test('liquidity already raided remains taken after price pulls back',()=>{
  const base=now-4*900;
  const m15=[{open_time:base,close_time:base+900,open:100,high:105,low:99,close:104},
    {open_time:base+900,close_time:base+1800,open:104,high:107,low:101,close:102},
    {open_time:base+1800,close_time:base+2700,open:102,high:103,low:100,close:101}];
  const d1=[{open_time:base-86400,close_time:base,high:106,low:98}];
  assert.equal(liquidity(m15,d1,undefined,now).find(l=>l.label==='PDH').status,'TAKEN');
});

test('previous closed daily candle is PDH/PDL and context expires without server heartbeat',()=>{
  const data=input(),levels=liquidity(data.m15,data.d1,undefined,now);
  assert.equal(levels.find(l=>l.label==='PDH').level,Math.round(data.d1.at(-1).high*100)/100);
  const context=buildMarketContext(data),stamp=new Date(now*1000).toISOString();
  const payload={ok:true,mode:'market_context',context,engine:{status:'COMPLETED',completed_at:stamp,result:{engine:'amyfx-gold-context-v1'}}};
  assert.equal(currentContext(payload,now*1000),context);
  assert.equal(currentContext({...payload,engine:{...payload.engine,status:'FAILED'}},now*1000),null);
  assert.equal(currentContext(payload,now*1000+181000),null);
});

test('active path evaluates the new drivers and keeps context-only notification policy',()=>{
  const engine=readFileSync('supabase/functions/scalper-engine/index.ts','utf8');
  const push=readFileSync('supabase/functions/scalper-system-push/index.ts','utf8');
  const mapping=readFileSync('app/src/main/assets/apps/mapping/index.html','utf8');
  assert.match(engine,/evaluateSixDrivers/);
  assert.match(engine,/amyfx_preview_scalper_setups\?on_conflict/);
  assert.doesNotMatch(engine,/evaluateScalperCandidates/);
  assert.doesNotMatch(push,/amyfx_preview_scalper_events\?/);
  assert.match(push,/notification_type:'market_context'/);
  assert.match(push,/Number\(match\[1\]\)>=357/);
  assert.match(push,/Math\.abs\(Date\.now\(\)\/1000-sourceM\)>maxAge/);
  assert.doesNotMatch(mapping,/scalper-panel\.js|id="signal"|Rencana entry/);
  assert.match(mapping,/context-panel\.js/);
});

test('M5 confirmation timeframe provides 900s freshness window and populates context.m5 and context.m1',()=>{
  const m5Input={
    nowSeconds:now,
    h1:candles(3600,60,3300,.25,2),
    m15:candles(900,100,3345,-.18,1.8),
    m5:candles(300,60,3325,-.04,.7),
    d1:candles(86400,10,3290,1,2)
  };
  const context=buildMarketContext(m5Input);
  assert.equal(context.fresh,true);
  assert.ok(context.source.M5);
  assert.ok(context.m5);
  assert.ok(context.m1);
  assert.equal(context.m5.status,context.m1.status);
  assert.match(context.narrative,/Konfirmasi M5/);
  const payload={
    ok:true,
    mode:'market_context',
    context,
    engine:{status:'COMPLETED',completed_at:new Date(now*1000).toISOString(),result:{engine:'amyfx-gold-context-v1'}}
  };
  assert.equal(currentContext(payload,(now+500)*1000),context);
  assert.equal(currentContext(payload,(now+950)*1000),null);
});

test('economic calendar integration detects safe, upcoming, and news lock states', () => {
  // Empty calendar -> UNVERIFIED
  assert.equal(evaluateEconomicCalendar([], now).status, 'UNVERIFIED');

  // Safe calendar (no high/med nearby)
  const safeCalendar = [
    { country: 'USD', impact: 'Low', title: 'Crude Oil Inventories', date: new Date((now + 600) * 1000).toISOString() },
    { country: 'EUR', impact: 'High', title: 'ECB Rate', date: new Date((now + 600) * 1000).toISOString() }
  ];
  const safeResult = evaluateEconomicCalendar(safeCalendar, now);
  assert.equal(safeResult.status, 'SAFE');
  assert.match(safeResult.note, /Kondisi scalping aman/);

  // Upcoming High-Impact USD (e.g. 45 mins ahead)
  const upcomingCalendar = [
    { country: 'USD', impact: 'High', title: 'US CPI m/m', date: new Date((now + 45 * 60) * 1000).toISOString(), forecast: '0.2%', previous: '0.3%' }
  ];
  const upcomingResult = evaluateEconomicCalendar(upcomingCalendar, now);
  assert.equal(upcomingResult.status, 'UPCOMING');
  assert.match(upcomingResult.note, /US CPI m\/m rilis dalam 45 menit/);

  // Critical News Lock (10 mins ahead)
  const lockCalendar = [
    { country: 'USD', impact: 'High', title: 'Non-Farm Payrolls', date: new Date((now + 10 * 60) * 1000).toISOString() }
  ];
  const lockResult = evaluateEconomicCalendar(lockCalendar, now);
  assert.equal(lockResult.status, 'NEWS_LOCK');
  assert.match(lockResult.note, /NEWS LOCK AKTIF/);

  // Context build with lock calendar locks execution
  const context = buildMarketContext({ ...input(), calendar: lockCalendar });
  assert.equal(context.news.status, 'NEWS_LOCK');
  assert.equal(context.execution.status, 'NOT READY');
  assert.match(context.execution.reason, /News Lock Aktif/);
  assert.equal(context.event?.title, '🛡️ Tahan Dulu: Pasar Lagi Liar');
});

test('active target level object does not crash buildMarketContext and formats price cleanly', () => {
  const data = input();
  // Set D1 so that PDH is active above current price
  data.d1 = [{ open_time: now - 86400, close_time: now - 3600, open: 3300, high: 3390, low: 3280, close: 3310, is_closed: true }];
  const ctx = buildMarketContext(data);
  assert.equal(ctx.primary?.target, 3390);
  assert.equal(ctx.event, null); // Sniper silence maintained
});

test('dealingRange calculates equilibrium, price zones, and location status correctly', () => {
  const bars = [
    { open_time: 100, close_time: 200, open: 100, high: 200, low: 100, close: 120 },
    { open_time: 200, close_time: 300, open: 120, high: 180, low: 110, close: 130 }
  ];
  const struct = { bias: 'BULLISH', swingHigh: 200, swingLow: 100, protectedLevel: 100 };
  const buyDiscount = dealingRange(bars, struct, {}, 'BUY');
  assert.equal(buyDiscount.eq, 150);
  assert.equal(buyDiscount.location, 'DISCOUNT');
  assert.equal(buyDiscount.priceZone, -1);
  assert.equal(buyDiscount.locationStatus, 1); // Healthy to buy in discount!

  const sellInDiscount = dealingRange(bars, struct, {}, 'SELL');
  assert.equal(sellInDiscount.locationStatus, -1); // Bad location to sell at bottom of discount!

  const barsInPremium = [
    { open_time: 100, close_time: 200, open: 100, high: 200, low: 100, close: 150 },
    { open_time: 200, close_time: 300, open: 150, high: 200, low: 140, close: 180 }
  ];
  const buyPremium = dealingRange(barsInPremium, struct, {}, 'BUY');
  assert.equal(buyPremium.location, 'PREMIUM');
  assert.equal(buyPremium.priceZone, 1);
  assert.equal(buyPremium.locationStatus, -1); // Bad location to buy at peak of premium!
});

test('zones calculate 50% CE and reject microscopic gaps < 0.8 points', () => {
  const base = now - 10 * 900;
  const bar = (i, low, high, open, close) => ({ open_time: base + i * 900, close_time: base + (i + 1) * 900, open, low, high, close, is_closed: true });
  // Microscopic gap: 0.2 points (2 pips on gold, e.g. 2680.4 to 2680.6)
  const microBars = [
    bar(0, 100, 101.0, 100.2, 100.8),
    bar(1, 100.8, 102.0, 101.0, 101.8),
    bar(2, 101.2, 103.0, 101.5, 102.8)
  ];
  // Bar 2 low is 101.2, Bar 0 high is 101.0 -> gap is 0.2 points -> MUST BE REJECTED!
  const microZones = zones(microBars);
  assert.equal(microZones.length, 0);

  // Valid gap: 2.0 points (20 pips on gold)
  const validBars = [
    bar(0, 99.0, 101.0, 99.5, 100.5),
    bar(1, 101.0, 105.0, 101.5, 104.5),
    bar(2, 103.0, 106.0, 103.5, 105.5)
  ];
  // Bar 2 low is 103.0, Bar 0 high is 101.0 -> gap is 2.0 points (>= 0.8) -> ACCEPTED!
  const validZones = zones(validBars);
  assert.equal(validZones.length, 1);
  assert.equal(validZones[0].low, 101);
  assert.equal(validZones[0].high, 103);
  assert.equal(validZones[0].ce, 102); // Exact 50% Consequent Encroachment!
});

test('calculateConfluenceScore evaluates layers and invalidation guard correctly', () => {
  // Invalidation guard: H1 invalidated yields 0 score and NO_SETUP
  const invScore = calculateConfluenceScore({
    h1Struct: { health: 'INVALIDATED' },
    side: 'BUY'
  });
  assert.equal(invScore.score, 0);
  assert.equal(invScore.grade, 'NO_SETUP');

  // Full A+ confluence
  const aPlus = calculateConfluenceScore({
    h1Struct: { bias: 'BULLISH', health: 'HEALTHY' },
    side: 'BUY',
    aligned: true,
    poi: { low: 2650, high: 2655, ce: 2652.5, kind: 'FVG' },
    nearPoi: true,
    confirming: { status: 'CONFIRMED', sweep: { level: 2649 }, mss: { level: 2653 }, microFvg: { low: 2651, high: 2652 } },
    levels: [{ label: 'PDH', level: 2670, side: 'BUY', status: 'ACTIVE' }],
    dr: { locationStatus: 1 },
    session: 'NEW YORK'
  });
  assert.ok(aPlus.score >= 75);
  assert.equal(aPlus.grade, 'STRONG');
});

test('weekend gap tolerance bridges Friday close and Sunday open without DATA TERLAMBAT lock', () => {
  // Friday close: 2026-10-02 17:00 NY = 21:00 UTC
  const friClose = Date.parse('2026-10-02T21:00:00Z') / 1000;
  // Sunday open: 2026-10-04 17:00 NY = 21:00 UTC
  const sunOpen = Date.parse('2026-10-04T21:00:00Z') / 1000;

  // 1. isWeekendGap verification
  assert.equal(isWeekendGap(friClose, sunOpen), true);
  assert.equal(isWeekendGap(friClose, sunOpen + 3600), true);
  assert.equal(isWeekendGap(friClose - 3600, friClose), false);

  // 2. contiguous verification across weekend
  const friBar = { open_time: friClose - 900, close_time: friClose, open: 2650, high: 2655, low: 2649, close: 2654, is_closed: true };
  const sunBar = { open_time: sunOpen, close_time: sunOpen + 900, open: 2654, high: 2658, low: 2652, close: 2656, is_closed: true };
  assert.equal(contiguous([friBar, sunBar]), true);

  // 3. marketElapsedSeconds verification
  // At Sunday 19:30 NY (2.5h after Sunday open, 50.5h after Friday close)
  const sun1930 = Date.parse('2026-10-04T23:30:00Z') / 1000;
  const elapsedFromFriClose = marketElapsedSeconds(friClose, sun1930);
  assert.equal(elapsedFromFriClose, 2.5 * 3600);

  // 4. Cold-Start Market Opening on Sunday:
  // Feed has 40 Friday M15 candles + 10 Sunday M15 candles
  const m15 = [];
  for (let i = 40; i > 0; i--) {
    const o = friClose - i * 900;
    m15.push({ open_time: o, close_time: o + 900, open: 2650, high: 2655, low: 2648, close: 2652, is_closed: true });
  }
  for (let i = 0; i < 10; i++) {
    const o = sunOpen + i * 900;
    m15.push({ open_time: o, close_time: o + 900, open: 2652, high: 2657, low: 2650, close: 2655, is_closed: true });
  }

  // H1: 30 Friday candles + 2 Sunday candles
  const h1 = [];
  for (let i = 30; i > 0; i--) {
    const o = friClose - i * 3600;
    h1.push({ open_time: o, close_time: o + 3600, open: 2645, high: 2660, low: 2640, close: 2650, is_closed: true });
  }
  for (let i = 0; i < 2; i++) {
    const o = sunOpen + i * 3600;
    h1.push({ open_time: o, close_time: o + 3600, open: 2650, high: 2658, low: 2648, close: 2655, is_closed: true });
  }

  // M5: 40 Friday candles + 30 Sunday candles (up to Sunday 19:30 NY)
  const m5 = [];
  for (let i = 40; i > 0; i--) {
    const o = friClose - i * 300;
    m5.push({ open_time: o, close_time: o + 300, open: 2650, high: 2653, low: 2649, close: 2652, is_closed: true });
  }
  for (let i = 0; i < 30; i++) {
    const o = sunOpen + i * 300;
    m5.push({ open_time: o, close_time: o + 300, open: 2652, high: 2655, low: 2651, close: 2654, is_closed: true });
  }

  // Evaluate at Sunday 19:32 NY (2 minutes after the 10th M15 candle closed)
  const evalTime = sunOpen + 10 * 900 + 120;
  const ctx = buildMarketContext({
    nowSeconds: evalTime,
    h1,
    m15,
    m5
  });

  assert.equal(ctx.fresh, true);
  assert.notEqual(ctx.marketState, 'DATA TERLAMBAT');
  assert.notEqual(ctx.execution.reason, 'Candle H1, M15, atau M5 belum lengkap atau terlambat.');
});

