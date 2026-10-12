import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const base = new URL('../app/src/main/assets/apps/academy/trading-practice/', import.meta.url);
const bank = JSON.parse(readFileSync(new URL('assets/data/guided-exercises.json', base))).exercises;
const ctx = vm.createContext({}); vm.runInContext(readFileSync(new URL('assets/js/guided-session.js',base),'utf8'),ctx);
const session=ctx.AmyGuidedSession;
test('60 unique exercises, 20 per level, valid OHLC, choices and real lesson links',()=>{
 assert.equal(bank.length,60);assert.equal(new Set(bank.map(q=>q.id)).size,60);
 for(const level of ['mudah','sedang','advanced'])assert.equal(bank.filter(q=>q.difficulty===level).length,20);
 for(const q of bank){
  assert.equal(new Set(q.choices).size,3,q.id);assert.ok(q.choices.includes(q.answer));
  assert.ok(existsSync(new URL(q.lesson.href,base)),q.lesson.href);
  assert.equal(q.source,'illustrative-ohlc-v2');
  q.candles.forEach((c,i)=>{assert.ok(c.high>=Math.max(c.open,c.close)&&c.low<=Math.min(c.open,c.close),q.id);if(i)assert.ok(c.time>q.candles[i-1].time)});
  for(const m of q.markers)assert.ok(q.candles.some(c=>c.time===m.time));
  assert.ok(!/\{\d/.test(q.prompt+q.answer+q.principle));
 }
});
test('every FVG, sweep, break, range and risk chart mathematically supports the stated concept',()=>{
 for(const q of bank){
  const e=q.evidence,c=q.candles,a=c[e.a],b=c[e.b],last=c[e.c];
  if(e.pattern==='fvg'){
   const gap=e.direction==='bullish'?[a.high,last.low]:[last.high,a.low];
   assert.ok(gap[1]>gap[0],q.id);assert.deepEqual(q.levels.map(l=>l.price),gap);
   assert.ok(Math.abs(b.close-b.open)>Math.abs(a.close-a.open)*3);
  } else if(e.pattern==='sweep'){
   const level=q.levels[0].price;
   if(e.direction==='high'){assert.equal(a.high,b.high);assert.ok(last.high>level&&last.close<level)}
   else {assert.equal(a.low,b.low);assert.ok(last.low<level&&last.close>level)}
  } else if(e.pattern==='break'){
   const level=q.levels[0].price;
   assert.ok(e.direction==='up'?b.high>level&&b.close<level&&last.close>level:b.low<level&&b.close>level&&last.close<level);
  } else if(e.pattern==='range')assert.equal((c[e.closeIndex].close-q.levels[0].price)/(q.levels[2].price-q.levels[0].price),e.position);
  else if(e.pattern==='risk'){const [en,sl,tp]=q.levels.map(l=>l.price);assert.equal(Math.abs(tp-en)/Math.abs(sl-en),2);assert.ok(e.side==='BUY'?sl<en&&tp>en:sl>en&&tp<en)}
 }
});
test('sessions prioritize unseen questions, avoid duplicates and respect difficulty',()=>{
 let seen=[];
 for(let i=0;i<6;i++){const qs=session.select(bank,'ALL',10,seen,()=>0.37);assert.equal(qs.length,10);for(const q of qs)assert.ok(!seen.includes(q.id));seen.push(...qs.map(q=>q.id))}
 assert.equal(new Set(seen).size,60);
 assert.equal(new Set(session.select(bank,'ALL',60,seen).map(q=>q.id)).size,60);
 const qs=session.select(bank,'advanced',60,[]);assert.equal(qs.length,20);assert.ok(qs.every(q=>q.difficulty==='advanced'));
 assert.notDeepEqual(session.shuffle(bank,()=>0.1).map(q=>q.id),session.shuffle(bank,()=>0.9).map(q=>q.id));
});
test('summary groups only wrong answers with their actual lesson and explanation',()=>{
 const report=session.summary([{exercise:bank[0],answer:'wrong',correct:false},{exercise:bank[1],answer:bank[1].answer,correct:true},{exercise:bank[2],answer:'wrong',correct:false},{exercise:bank[12],answer:'wrong',correct:false}]);
 assert.equal(report.total,4);assert.equal(report.correct,1);assert.equal(report.topics.length,2);assert.equal(report.topics[0].mistakes.length,2);assert.equal(report.topics[0].lesson.href,bank[0].lesson.href);
 assert.equal(session.summary([{exercise:bank[0],correct:true}]).topics.length,0);
});

function runtime() {
 const nodes=new Map(),saved=[],local=new Map();
 function node(id='') { return {id,hidden:false,textContent:'',style:{},dataset:{},children:[],listeners:{},value:id==='exerciseCategory'?'ALL':id==='sessionLength'?'10':'',appendChild(n){this.children.push(n)},replaceChildren(){this.children=[]},querySelectorAll(){return this.children},addEventListener(t,f){this.listeners[t]=f},scrollIntoView(){},click(){if(!this.disabled)this.listeners.click?.()}} }
 const byId=id=>{if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id)};
 const chart={series:{setMarkers(){},applyOptions(){}},setCandles(c){this.candles=c},setTradeLevels(l){this.levels=l},destroy(){}};
 const context=vm.createContext({console,Math,localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},location:{},document:{readyState:'complete',createElement:()=>node()},fetch:async()=>({ok:true,json:async()=>({schemaVersion:2,exercises:bank})})});
 context.window={AmyPracticeUI:{byId,text:(id,t)=>{byId(id).textContent=t},status:(id,t)=>{byId(id).textContent=t}},AmyPracticeStorage:{saveGuidedResult:async r=>{saved.push(r)}},AmyCandleChart:{CandleChart:function(){return chart}},addEventListener(){}};
 vm.runInContext(readFileSync(new URL('assets/js/guided-session.js',base),'utf8'),context);
 vm.runInContext(readFileSync(new URL('assets/js/guided-practice.js',base),'utf8'),context);
 return {byId,saved,chart,local};
}
test('real controller: wrong first response locks choices and final session opens matching material',async()=>{
 const r=runtime();await new Promise(resolve=>setImmediate(resolve));
 for(let i=0;i<10;i++){
  const q=bank.find(q=>q.title===r.byId('exerciseTitle').textContent);assert.ok(q);
  assert.deepEqual(r.chart.candles,q.candles);assert.deepEqual(r.chart.levels,q.levels);
  const choices=r.byId('exerciseChoices').children;
  choices.find(b=>b.textContent!==q.answer).click();
  assert.ok(choices.every(b=>b.disabled));
  choices.find(b=>b.textContent===q.answer).click(); // Cannot erase first mistake.
  assert.equal(r.saved.length,i+1);assert.equal(r.saved[i].correct,false);
  assert.equal(r.byId('nextExercise').hidden,false);
  r.byId('nextExercise').click();
 }
 assert.equal(r.byId('guidedSummary').hidden,false);assert.equal(r.byId('guidedWorkspace').hidden,true);
 assert.match(r.byId('summaryScore').textContent,/0 \/ 10/);
 assert.ok(r.byId('reviewTopics').children.length>0);
 for(const card of r.byId('reviewTopics').children)assert.ok(existsSync(new URL(card.children[1].href,base)));
 assert.equal(JSON.parse(r.local.get('amy-guided-v2-summary')).results.length,10);
 r.byId('restartSession').click();assert.equal(r.byId('guidedWorkspace').hidden,false);
 assert.ok(!r.saved.some(q=>q.title===r.byId('exerciseTitle').textContent));
});
