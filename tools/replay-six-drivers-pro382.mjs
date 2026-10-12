import {readFileSync,writeFileSync} from 'node:fs';
import {buildMarketContext} from '../supabase/functions/scalper-engine/market-context.mjs';
import {evaluateSixDrivers,SIX_DRIVERS,SIX_NON_TERMINAL} from '../supabase/functions/scalper-engine/six-drivers.mjs';
import {advanceSixSetup,sixDriverStatistics} from '../supabase/functions/scalper-engine/six-driver-lifecycle.mjs';
const source=process.argv[2],output=process.argv[3]||'/tmp/amy382-replay.json';
if(!source)throw Error('Usage: node tools/replay-six-drivers-pro382.mjs candles.jsonl [report.json]');
const all={m15:[],m5:[],h1:[],d1:[]};
for(const line of readFileSync(source,'utf8').trim().split('\n')){const x=JSON.parse(line);all[x.tf].push(...x.rows);}
const ledger=new Map(),seen=new Set(),counts=Object.fromEntries(SIX_DRIVERS.map(d=>[d.id,0])),states={};
const evaluated=all.m5.slice(-240);
for(const bar of evaluated){
 const now=bar.close_time;
 const data=Object.fromEntries(Object.entries(all).map(([tf,rows])=>[tf,rows.filter(c=>c.close_time<=now).slice(tf==='m15'?-400:tf==='m5'?-500:tf==='h1'?-200:-30)]));
 // Structural replay only: historical verified calendar/quotes are unavailable.
 // A same-week harmless calendar fixture keeps the explicit news gate visible.
 const calendar=[{country:'USD',impact:'Low',title:'REPLAY FIXTURE — not historical news',date:new Date(now*1000).toISOString()}];
 const context=buildMarketContext({...data,calendar,nowSeconds:now});
 for(const [id,s]of ledger)ledger.set(id,advanceSixSetup(s,{m5:data.m5,nowSeconds:now,newsStatus:context.news.status}));
 const e=evaluateSixDrivers({...data,context,nowSeconds:now,ledger:[...ledger.values()]});
 for(const d of e.drivers)states[d.state]=(states[d.state]||0)+1;
 for(const s of e.candidates){if(seen.has(s.id)||[...ledger.values()].some(x=>x.driver_id===s.driver_id&&SIX_NON_TERMINAL.includes(x.status)))continue;seen.add(s.id);ledger.set(s.id,s);counts[s.driver_id]++;}
}
const report={validationOnly:true,limitations:['Calendar is a synthetic verified fixture; this is not a historical trading-performance backtest.','OHLC M5 fill/exit simulation; broker costs and intrabar path unavailable.'],candlesEvaluated:evaluated.length,from:evaluated[0]?.close_time,to:evaluated.at(-1)?.close_time,counts,states,statistics:sixDriverStatistics([...ledger.values()]),ledger:[...ledger.values()]};
writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,ledger:undefined},null,2));
