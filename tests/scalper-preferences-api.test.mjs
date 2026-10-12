import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {SIX_DRIVERS,SIX_ENGINE_VERSION} from '../supabase/functions/scalper-engine/six-drivers.mjs';
import {DRIVER_REGISTRY} from '../supabase/functions/scalper-engine/engine.mjs';
import {deviceScope,normalizeDriverToggles} from '../supabase/functions/_shared/scalper-device.mjs';
function server(path,fetch){
  let handler;
  const code=readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  vm.runInNewContext(stripTypeScriptTypes(code),{Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://project.test':'test-only'},serve:h=>{handler=h;}},DRIVER_REGISTRY,LEGACY_DRIVERS:DRIVER_REGISTRY,SIX_DRIVERS,SIX_ENGINE_VERSION,deviceScope,normalizeDriverToggles,Request,Response,URL,URLSearchParams,crypto,TextEncoder,fetch,console});
  return handler;
}
test('preferences PUT/GET isolates two devices and rejects invalid boolean input',async()=>{
  const rows=new Map();
  const handler=server('supabase/functions/scalper-preferences/index.ts',async(url,init)=>{
    if(init.method==='POST'){const row=JSON.parse(init.body);assert.equal(row.token,undefined);rows.set(row.device_scope,row);return Response.json([row]);}
    const scope=new URL(url).searchParams.get('device_scope')?.slice(3);return Response.json(rows.has(scope)?[rows.get(scope)]:[]);
  });
  const req=(token,method,body)=>new Request('https://test',{method,headers:token?{'x-amy-device-token':token}: {},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await handler(req(null,'GET'))).status,401);
  assert.equal((await handler(req('a'.repeat(64),'PUT',{enabledDrivers:{FVG:false}}))).status,200);
  const a=await (await handler(req('a'.repeat(64),'GET'))).json();
  const b=await (await handler(req('b'.repeat(64),'GET'))).json();assert.equal(a.enabledDrivers.FVG,false);assert.equal(b.enabledDrivers.FVG,true);
  assert.equal((await handler(req('b'.repeat(64),'PUT',{enabledDrivers:{FVG:'false'}}))).status,400);
});
test('setups reader scopes device archives and shared new drivers, without exposing retired live rows',async()=>{
  const urls=[];
  const handler=server('supabase/functions/scalper-setups/index.ts',async(url)=>{urls.push(String(url));return Response.json(String(url).includes('device_preferences')?[{created_at:'2026-09-05T00:00:00Z'}]:[]);});
  const request=new Request('https://test?setup_id=another-device-row&history=all',{headers:{'x-amy-device-token':'a'.repeat(64)}});
  assert.equal((await handler(request)).status,200);
  const scope=await deviceScope(request);
  const queries=urls.filter(x=>x.includes('amyfx_preview_scalper_setups?'));
  assert.equal(queries.length,3);assert.ok(queries.every(url=>url.includes(scope)));
  assert.ok(queries.find(x=>x.includes('WAITING_NEXT_OPEN')).includes('engine_version=eq.'+SIX_ENGINE_VERSION));
  assert.ok(queries.find(x=>x.includes('another-device-row')).includes('created_at.lt.'));
});
