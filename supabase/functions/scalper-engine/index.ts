import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {buildMarketContext,CONTEXT_VERSION,CONTEXT_POLICY} from './market-context.mjs';
import {evaluateSixDrivers,SIX_ENGINE_VERSION,SIX_NON_TERMINAL} from './six-drivers.mjs';
import {advanceSixSetup,sixDriverStatistics} from './six-driver-lifecycle.mjs';

const SUPABASE_URL=String(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
const SERVICE_ROLE_KEY=String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function rest(path:string,init:RequestInit={}) {
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...init,headers:{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,Accept:'application/json',...(init.headers||{})}});
  const raw=await response.text();
  if(!response.ok)throw new Error(`database_${response.status}: ${raw.slice(0,300)}`);
  return raw?JSON.parse(raw):null;
}
async function load(timeframe:string,limit:number){
  const params=new URLSearchParams({select:'symbol,timeframe,open_time,close_time,open,high,low,close,is_closed',symbol:'eq.XAU/USD',timeframe:`eq.${timeframe}`,is_closed:'eq.true',order:'open_time.desc',limit:String(limit)});
  const rows=[];
  for(let offset=0;offset<limit;offset+=500){params.set('limit',String(Math.min(500,limit-offset)));params.set('offset',String(offset));
    const page=await rest(`candles?${params}`);if(!Array.isArray(page))break;rows.push(...page);if(page.length<Math.min(500,limit-offset))break;}
  return rows.reverse();
}
async function refresh(interval:string,outputsize:number){
  const query=new URLSearchParams({symbol:'XAU/USD',interval,outputsize:String(outputsize)});
  const response=await fetch(`${SUPABASE_URL}/functions/v1/market-candles?${query}`,{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`market_refresh_${interval}_${response.status}`);
  const data=await response.json();
  if(data?.status==='error')throw new Error(`market_refresh_${interval}_error`);
  return {interval,latestOpenTime:data?.latestOpenTime||null};
}
async function acquireRun(now:number){
  const rows=await rest('amyfx_preview_scalper_runs?on_conflict=run_bucket',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({run_bucket:Math.floor(now/60),started_at:new Date().toISOString()})});
  return rows?.[0]||null;
}
async function finishRun(bucket:number,result:unknown,error:string|null=null){
  await rest(`amyfx_preview_scalper_runs?run_bucket=eq.${bucket}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status:error?'FAILED':'COMPLETED',completed_at:new Date().toISOString(),result,error})});
}
async function enqueue(context:any){
  if(!context.fresh||!context.event)return false;
  const event=context.event;
  const rows=await rest('amyfx_market_context_events?on_conflict=event_key',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},
    body:JSON.stringify({event_key:event.key,candle_close_time:context.source.M15,title:event.title,body:event.body,context})});
  return Array.isArray(rows)&&rows.length>0;
}
async function fetchCalendar(): Promise<any[]> {
  try {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),2500);
    const res=await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json',{signal:controller.signal,cache:'no-store'});
    clearTimeout(timeout);
    if(!res.ok)return [];
    return await res.json();
  } catch (_) {
    return [];
  }
}

async function evaluateAndPersist(input:any,context:any,now:number){
  const day=Math.floor(now/86400)*86400;
  const ledger=await rest(`amyfx_preview_scalper_setups?engine_version=eq.${SIX_ENGINE_VERSION}&device_scope=is.null&or=(status.in.(WAITING_TRIGGER,WAITING_NEXT_OPEN,ACTIVE,BE_ACTIVE),exit_time.gte.${day})&order=created_at.desc&limit=1000`);
  const updated=[];
  for(const row of ledger||[]){
    const next=advanceSixSetup(row,{m1:input.m1,m5:input.m5,nowSeconds:now,newsStatus:context.fresh?context.news.status:'UNVERIFIED'});
    if(next.revision!==row.revision){
      const saved=await rest(`amyfx_preview_scalper_setups?id=eq.${encodeURIComponent(row.id)}&revision=eq.${row.revision}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(next)});
      if(!saved?.length)throw new Error('setup_revision_conflict');
    }
    updated.push(next);
  }
  const evaluation=evaluateSixDrivers({...input,context,nowSeconds:now,ledger:updated});
  let inserted=0;
  for(const candidate of evaluation.candidates){
    // One live plan per driver. Different models remain independently visible.
    if(updated.some(s=>s.driver_id===candidate.driver_id&&SIX_NON_TERMINAL.includes(s.status)))continue;
    const rows=await rest('amyfx_preview_scalper_setups?on_conflict=id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify(candidate)});
    if(rows?.length){updated.push(rows[0]);inserted++;}
  }
  const active=updated.filter(s=>SIX_NON_TERMINAL.includes(s.status));
  for(const driver of evaluation.drivers){
    const plan=active.find(s=>s.driver_id===driver.id);
    if(plan){driver.setupId=plan.id;driver.lifecycleStatus=plan.status;}
  }
  return {...evaluation,candidates:undefined,inserted,activeCount:active.length,statistics:sixDriverStatistics(updated),statisticsPeriod:'UTC_DAY',statisticsTruncated:(ledger||[]).length>=1000};
}

async function push(){
  const response=await fetch(`${SUPABASE_URL}/functions/v1/scalper-system-push`,{method:'POST',headers:{Authorization:`Bearer ${SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:'{}'});
  return {ok:response.ok,status:response.status};
}

Deno.serve(async request=>{
  if(!['GET','POST'].includes(request.method))return json({error:'method_not_allowed'},405);
  if(!SUPABASE_URL||!SERVICE_ROLE_KEY)return json({error:'backend_not_configured'},503);
  if(new URL(request.url).searchParams.get('health')==='1')return json({ok:true,engine:CONTEXT_VERSION,policyVersion:CONTEXT_POLICY,mode:'market_context',schema_version:1,driverEngine:SIX_ENGINE_VERSION});
  const now=Math.floor(Date.now()/1000);let run:any=null;
  try {
    run=await acquireRun(now);
    if(!run)return json({ok:true,skipped:true,reason:'minute_already_processed',engine:CONTEXT_VERSION});
    const refreshes=await Promise.all([
      refresh('5min',500),
      refresh('15min',700),
      refresh('1h',500),
      refresh('1min',2000).catch(()=>({interval:'1min',latestOpenTime:null}))
    ]);
    // Daily levels are useful context, but a provider-side D1 outage cannot block M5/M15/H1 awareness.
    const daily=await refresh('1day',90).catch(()=>({interval:'1day',latestOpenTime:null}));
    refreshes.push(daily);
    const [m5,m15,h1,d1,m1,calendar]=await Promise.all([
      load('M5',500),
      load('M15',700),
      load('H1',500),
      load('D1',90),
      load('M1',2000).catch(()=>[]),
      fetchCalendar().catch(()=>[])
    ]);
    const input={m5,m15,h1,d1,m1,nowSeconds:now,calendar};
    const context=buildMarketContext(input);
    const driverEvaluation=await evaluateAndPersist(input,context,now);
    const queued=await enqueue(context);
    const result={ok:context.fresh,engine:CONTEXT_VERSION,mode:'market_context',context,driverEvaluation,market_refresh:refreshes,queued};
    await finishRun(run.run_bucket,result);
    // Retry previously queued context events even if the current minute has no new change.
    return json({...result,push:context.fresh?await push():{ok:true,skipped:true}});
  }catch(error){
    const detail=error instanceof Error?error.message:String(error);
    console.error('market-context-engine failed',detail);
    if(run?.run_bucket!=null)await finishRun(run.run_bucket,{},detail).catch(()=>{});
    return json({error:'market_context_failed',detail},500);
  }
});
