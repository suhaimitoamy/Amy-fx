import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync('app/src/main/assets/'+f,'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function mount(loader){
  const nodes=new Map(),events=new Map(),timers=new Map(),draws=[];let serial=0,destroyed=0;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'M15',textContent:'',disabled:false,addEventListener(n,f){this[n]=f;},removeEventListener(n){delete this[n];}});return nodes.get(id);};
  const eventTarget={addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};
  const context={window:{...eventTarget},document:{hidden:false,...eventTarget},Date,AbortController,
    setTimeout:(f,ms)=>{timers.set(++serial,{f,ms});return serial;},clearTimeout:id=>timers.delete(id),
    loadCandles:loader,analyze:r=>({...r,sourceTime:r.candles.at(-1)?.time||null,fresh:!r.degraded,plan:null}),
    updateDealingRangeBadge:()=>{},
    createPriceChart:()=>({draw:r=>draws.push(r),reset(){},destroy(){destroyed++;}})};
  const code=read('home-price-chart.js').replace(/^import .*;\n/gm,'').replace('export function','function');
  vm.runInNewContext(code,context);const dispose=context.window.AmyHomeChart.mount({querySelector:id=>node(id.slice(1))});
  return {context,nodes,node,events,timers,draws,dispose,get destroyed(){return destroyed;}};
}
test('home chart fetches without visiting Mapping; shared source and stale failure handling',async()=>{
  let failed=false;const calls=[];
  const h=mount(async(tf)=>{calls.push(tf);if(failed)throw Error('offline');return {candles:[{time:1800000000,close:2500}],degraded:false};});
  await flush();assert.deepEqual(calls,['M15','H1']);assert.equal(h.node('home-chart-price').textContent,'2500.00');
  assert.equal(h.node('home-chart-note').textContent,'');
  failed=true;await h.node('home-chart-refresh').click();assert.match(h.node('home-chart-source').textContent,/Referensi lama/);
  assert.equal(h.node('home-chart-price').textContent,'2500.00');assert.match(h.node('home-chart-error').textContent,/gagal/);
  assert.equal([...h.timers.values()].filter(t=>t.ms===60000||t.ms===300000).length,1);
  h.dispose();assert.equal(h.destroyed,1);assert.equal(h.timers.size,0);assert.equal(h.events.size,0);
});
test('timeframe race, hide and disposal cannot repaint obsolete requests',async()=>{
  const pending=[];const h=mount((tf,signal)=>new Promise(resolve=>pending.push({tf,signal,resolve})));
  h.node('home-chart-tf').value='M5';h.node('home-chart-tf').change();
  assert.equal(pending[0].signal.aborted,true);
  pending.slice(2).forEach(p=>p.resolve({candles:[{time:200,close:2600}]}));await flush();
  pending.slice(0,2).forEach(p=>p.resolve({candles:[{time:100,close:2400}]}));await flush();
  assert.equal(h.node('home-chart-price').textContent,'2600.00');assert.match(h.node('home-chart-source').textContent,/M5/);
  h.context.document.hidden=true;h.events.get('visibilitychange')();assert.equal(h.timers.size,0);
  h.context.document.hidden=false;h.events.get('visibilitychange')();h.dispose();
  pending.slice(4).forEach(p=>p.resolve({candles:[{time:300,close:2700}]}));await flush();
  assert.equal(h.node('home-chart-price').textContent,'2600.00');assert.equal(h.timers.size,0);
});
test('older provider data is refused; cold offline state has no fabricated price',async()=>{
  let time=200;const h=mount(async()=>({candles:[{time,close:time}]}));await flush();
  time=100;await h.node('home-chart-refresh').click();assert.equal(h.node('home-chart-price').textContent,'200.00');
  assert.match(h.node('home-chart-source').textContent,/Referensi lama/);h.dispose();
  const offline=mount(async()=>{throw Error('offline');});await flush();
  assert.equal(offline.node('home-chart-price').textContent,'—');assert.match(offline.node('home-chart-source').textContent,/Belum ada candle/);offline.dispose();
});
test('shared chart renders actual candles and levels; teardown releases theme listener',()=>{
  const data=[],lines=[],removed=[];let fit=0,deleted=false;const events=new Map();
  const chart={applyOptions(){},addCandlestickSeries:()=>({setData:v=>data.push(v),createPriceLine:v=>{lines.push(v);return v;},removePriceLine:v=>removed.push(v)}),timeScale:()=>({fitContent(){fit++;}}),remove(){deleted=true;}};
  const context={window:{LightweightCharts:{createChart:()=>chart},addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)},document:{documentElement:{dataset:{amyfxTheme:'light'}}}};
  vm.runInNewContext(read('apps/mapping/js/ict-workspace/chart-view.js').replace(/^import .*;\n/gm,'').replace('export function','function'),context);
  const view=context.createPriceChart({}),candles=[{time:1,open:100,high:102,low:99,close:101}];
  view.draw({tf:'M5',candles,plan:{entry:100,sl:95,tp:110}});assert.equal(data[0],candles);assert.equal(fit,1);assert.equal(lines.length,3);
  view.draw({tf:'M5',candles,plan:null});assert.equal(data.length,1);assert.equal(removed.length,3);
  // Item 1.53: Verify price tick updates candle without full JSON stringification
  assert.ok(!read('apps/mapping/js/ict-workspace/chart-view.js').includes('JSON.stringify(result.candles)'));
  const updatedCandles=[{time:1,open:100,high:103,low:99,close:102}];
  view.draw({tf:'M5',candles:updatedCandles,plan:null});assert.equal(data.length,2);assert.equal(fit,1);
  view.reset();view.draw({tf:'M15',candles:[],plan:null});view.draw({tf:'M15',candles,plan:null});assert.equal(fit,2);
  view.destroy();assert.equal(deleted,true);assert.equal(events.size,0);
});
test('home mount/dispose lifecycle runs through actual navigation and menus remain available',()=>{
  const listeners={},nav={},main={innerHTML:'',querySelector:()=>({addEventListener(){},removeEventListener(){}})};let mounted=0,disposed=0;
  const context={document:{addEventListener:(n,f)=>(listeners[n]??=[]).push(f),getElementById:id=>id==='main-content'?main:null,
    querySelectorAll:()=>['beranda','proyek','koleksi','profil'].map(target=>({dataset:{target},classList:{toggle(){}},addEventListener:(_,f)=>nav[target]=f}))},
    localStorage:{getItem:()=>null,setItem(){}},fetch:()=>new Promise(()=>{}),addEventListener(){},setInterval(){},setTimeout(){},console,location:{},
    AmyHomeChart:{mount(){mounted++;return ()=>disposed++;}}};context.window=context;
  vm.runInNewContext(read('app.js'),context);listeners.DOMContentLoaded.forEach(f=>f());
  assert.equal(mounted,1);assert.match(main.innerHTML,/id="home-price-chart"/);assert.equal((main.innerHTML.match(/class="quick-card/g)||[]).length,4);
  nav.proyek();assert.equal(disposed,1);nav.beranda();assert.equal(mounted,2);
  assert.match(read('index.html'),/type="module" src="home-price-chart.js"/);
  assert.match(read('home-price-chart.js'),/ict-workspace\/data.js/);assert.match(read('home-price-chart.js'),/ict-workspace\/engine.js/);
});

test('Item 1.44: home-price-chart.js implements isWeekendClosure, filters weekend candles, and throttles polling to 300s', () => {
  const code = read('home-price-chart.js');

  // Must have invariant parity
  assert.match(code, /isWeekendClosure/);
  assert.match(code, /isGoldMarketOpen/);
  assert.match(code, /filterCandles/);
  assert.match(code, /Pasar Tutup \(Akhir Pekan\)/);
  assert.match(code, /300000/);

  // Evaluate helpers in VM
  const context = {
    window: {},
    Date,
    Intl,
    console
  };
  const vmCode = code.replace(/^import .*;\n/gm, '').replace('export function mountHomeChart', 'function mountHomeChart');
  vm.runInNewContext(vmCode, context);
  const { isWeekendClosure, isGoldMarketOpen, filterCandles } = context.window.AmyHomeChart;

  assert.equal(typeof isWeekendClosure, 'function');
  assert.equal(typeof isGoldMarketOpen, 'function');
  assert.equal(typeof filterCandles, 'function');

  // Saturday 2026-10-17 12:00 UTC = Saturday morning NY (Closed)
  const saturdaySec = Date.parse('2026-10-17T12:00:00Z') / 1000;
  assert.equal(isWeekendClosure(saturdaySec), true);
  assert.equal(isGoldMarketOpen(saturdaySec), false);

  // Sunday 2026-10-18 15:00 UTC = 11:00 AM NY (Closed until 17:00 NY)
  const sundayMorningSec = Date.parse('2026-10-18T15:00:00Z') / 1000;
  assert.equal(isWeekendClosure(sundayMorningSec), true);
  assert.equal(isGoldMarketOpen(sundayMorningSec), false);

  // Sunday 2026-10-18 22:00 UTC = 18:00 NY (Open for the week)
  const sundayEveningSec = Date.parse('2026-10-18T22:00:00Z') / 1000;
  assert.equal(isWeekendClosure(sundayEveningSec), false);
  assert.equal(isGoldMarketOpen(sundayEveningSec), true);

  // Tuesday 2026-10-20 14:00 UTC = Tuesday 10:00 NY (Open)
  const tuesdaySec = Date.parse('2026-10-20T14:00:00Z') / 1000;
  assert.equal(isWeekendClosure(tuesdaySec), false);
  assert.equal(isGoldMarketOpen(tuesdaySec), true);

  // filterCandles removes synthetic and weekend candles when closed
  const mixedCandles = [
    { time: tuesdaySec, open: 2600, high: 2610, low: 2590, close: 2605 },
    { time: saturdaySec, open: 2605, high: 2605, low: 2605, close: 2605, synthetic: true },
    { time: saturdaySec + 3600, open: 2605, high: 2605, low: 2605, close: 2605 }
  ];

  const filteredClosed = filterCandles(mixedCandles, true);
  assert.equal(filteredClosed.length, 1);
  assert.equal(filteredClosed[0].time, tuesdaySec);
});

