import { DRIVER_REGISTRY as LEGACY_DRIVERS } from '../scalper-engine/engine.mjs';
import { SIX_DRIVERS } from '../scalper-engine/six-drivers.mjs';
const DRIVER_REGISTRY=[...LEGACY_DRIVERS,...SIX_DRIVERS.map(d=>({...d,timeframes:['M5']}))];
import { deviceScope, normalizeDriverToggles } from '../_shared/scalper-device.mjs';
const base=String(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
const key=String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-amy-device-token','Access-Control-Allow-Methods':'GET,PUT,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(!['GET','PUT'].includes(request.method))return json({error:'method_not_allowed'},405);
  try {
    const scope=await deviceScope(request);
    if(!scope)return json({error:'device_token_required'},401);
    let init: RequestInit={headers:{apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json'}};
    let path=`amyfx_scalper_device_preferences?device_scope=eq.${scope}&select=enabled_drivers,created_at`;
    if(request.method==='PUT'){
      const text=await request.text();if(text.length>4096)return json({error:'settings_too_large'},413);
      const body=JSON.parse(text);
      const toggles=normalizeDriverToggles(body.enabledDrivers,DRIVER_REGISTRY);
      path='amyfx_scalper_device_preferences?on_conflict=device_scope';
      init={...init,method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json','Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({device_scope:scope,enabled_drivers:toggles,updated_at:new Date().toISOString()})};
    }
    const response=await fetch(`${base}/rest/v1/${path}`,init);
    if(!response.ok)return json({error:'preferences_unavailable'},503);
    const rows=await response.json();
    return json({ok:true,registered:rows.length>0,enabledDrivers:normalizeDriverToggles(rows[0]?.enabled_drivers||{},DRIVER_REGISTRY),drivers:DRIVER_REGISTRY.map(d=>({id:d.id,name:d.name,timeframes:d.timeframes})),scope:'device'});
  }catch(error){return json({error:'invalid_preferences_request'},400);}
});
