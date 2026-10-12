import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {cert,getApps,initializeApp} from "npm:firebase-admin@13.0.1/app";
import {getMessaging} from "npm:firebase-admin@13.0.1/messaging";

const SUPABASE_URL=String(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
const SERVICE_ROLE_KEY=String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
const CHANNEL='amy_market_context_v1';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function rest(path:string,init:RequestInit={}) {
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...init,headers:{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,Accept:'application/json',...(init.headers||{})}});
  const raw=await response.text();if(!response.ok)throw new Error(`database_${response.status}: ${raw.slice(0,300)}`);
  return raw?JSON.parse(raw):null;
}
function firebase(){
  const raw=Deno.env.get('FIREBASE_SERVICE_ACCOUNT')||Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')||Deno.env.get('FIREBASE_ADMIN_SDK');
  if(!raw)throw new Error('Firebase service account belum tersedia');
  let value=raw.trim();if(value.startsWith("'")&&value.endsWith("'"))value=value.slice(1,-1);
  let config=JSON.parse(value);if(typeof config==='string')config=JSON.parse(config);
  const projectId=config.project_id||config.projectId,clientEmail=config.client_email||config.clientEmail;
  const privateKey=String(config.private_key||config.privateKey||'').replace(/\\n/g,'\n');
  if(!projectId||!clientEmail||!privateKey.includes('PRIVATE KEY'))throw new Error('Firebase service account tidak lengkap');
  if(!getApps().length)initializeApp({credential:cert({projectId,clientEmail,privateKey})});
  return getMessaging();
}
const eventFilter=(key:string)=>encodeURIComponent(key);
async function claim(eventKey:string,deviceId:string){
  const body={event_key:eventKey,device_token_id:deviceId,status:'CLAIMED',updated_at:new Date().toISOString()};
  const inserted=await rest('amyfx_market_context_notification_logs?on_conflict=event_key,device_token_id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify(body)});
  if(inserted?.length)return true;
  const existing=await rest(`amyfx_market_context_notification_logs?select=status&event_key=eq.${eventFilter(eventKey)}&device_token_id=eq.${deviceId}&limit=1`);
  if(existing?.[0]?.status!=='FAILED')return false;
  const retry=await rest(`amyfx_market_context_notification_logs?event_key=eq.${eventFilter(eventKey)}&device_token_id=eq.${deviceId}&status=eq.FAILED`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)});
  return Boolean(retry?.length);
}
async function record(eventKey:string,deviceId:string,status:'SENT'|'FAILED',messageId:string|null,error:string|null){
  await rest(`amyfx_market_context_notification_logs?event_key=eq.${eventFilter(eventKey)}&device_token_id=eq.${deviceId}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify({status,provider_message_id:messageId,error:error?.slice(0,400)||null,updated_at:new Date().toISOString()})});
}
async function devices(){
  const all=[];for(let offset=0;;offset+=500){
    const params=new URLSearchParams({select:'id,device_id,fcm_token,enabled,app_version',enabled:'eq.true',device_id:'like.com.amyelitesuite.learningpreview:%',order:'id.asc',limit:'500',offset:String(offset)});
    const page=await rest(`device_tokens?${params}`);
    // Older APKs treat an unknown data-only FCM type as a news alert. Wait for Pro357 registration.
    all.push(...page.filter(device=>{
      const match=/\b2\.0\.0-pro\.(\d+)/.exec(String(device.app_version||''));
      return match && Number(match[1])>=357;
    }));
    if(page.length<500)break;
  }return all;
}
Deno.serve(async request=>{
  if(!['GET','POST'].includes(request.method))return json({error:'method_not_allowed'},405);
  if(!SUPABASE_URL||!SERVICE_ROLE_KEY)return json({error:'backend_not_configured'},503);
  if(new URL(request.url).searchParams.get('health')==='1')return json({ok:true,channel:CHANNEL,mode:'market_context'});
  if(request.headers.get('authorization')!==`Bearer ${SERVICE_ROLE_KEY}`)return json({error:'unauthorized'},401);
  try{
    const since=new Date(Date.now()-30*60000).toISOString();
    const events=await rest(`amyfx_market_context_events?select=event_key,title,body,context,created_at&notified_at=is.null&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=40`);
    if(!events?.length)return json({ok:true,attempted:0,sent:0,failed:0});
    const targets=await devices();if(!targets.length)return json({ok:true,attempted:0,sent:0,failed:0,reason:'no_devices'});
    const messenger=firebase();let sent=0,failed=0;
    for(const event of events){
      // Never turn a stale snapshot or an archived setup into a live alert.
      const sourceM=Number(event.context?.source?.M5||event.context?.source?.M1);
      const maxAge=event.context?.source?.M5?900:180;
      if(event.context?.fresh!==true||event.context?.version!=='amyfx-gold-context-v1'||
         !Number.isFinite(sourceM)||Math.abs(Date.now()/1000-sourceM)>maxAge)continue;
      let eventFailed=false;
      for(const device of targets){
        if(!await claim(event.event_key,device.id))continue;
        const title=String(event.title).slice(0,120),body=String(event.body).slice(0,800);
        try{
          // Data-only FCM: Android owns routing and deduplication, even in background.
          const messageId=await messenger.send({token:String(device.fcm_token),data:{notification_type:'market_context',event_key:event.event_key,title,body,
            target_url:'https://appassets.androidplatform.net/assets/apps/mapping/index.html#context',amyfx_route:'Mapping'},
            android:{priority:'high',ttl:300000}});
          await record(event.event_key,device.id,'SENT',messageId,null);sent++;
        }catch(error){
          await record(event.event_key,device.id,'FAILED',null,String(error));failed++;eventFailed=true;
        }
      }
      if(!eventFailed)await rest(`amyfx_market_context_events?event_key=eq.${eventFilter(event.event_key)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({notified_at:new Date().toISOString()})});
    }
    return json({ok:failed===0,attempted:sent+failed,sent,failed,channel:CHANNEL},failed?207:200);
  }catch(error){console.error('market-context-push failed',error);return json({error:'context_push_failed',detail:error instanceof Error?error.message:String(error)},500);}
});
