import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {deviceScope} from '../supabase/functions/_shared/scalper-device.mjs';
import {SIX_ENGINE_VERSION,SIX_DRIVERS} from '../supabase/functions/scalper-engine/six-drivers.mjs';
function reader(fetcher){
 let handler;const source=readFileSync('supabase/functions/scalper-setups/index.ts','utf8').replace(/^import .*;\n/gm,'');
 vm.runInNewContext(stripTypeScriptTypes(source),{Deno:{env:{get:n=>n==='SUPABASE_URL'?'https://fixture.test':'test-only'},serve:h=>handler=h},fetch:fetcher,console,Request,Response,URL,URLSearchParams,crypto,TextEncoder,deviceScope,SIX_ENGINE_VERSION});return handler;
}
test('API publishes new live plans with six evaluations, filters device switches and preserves archive isolation',async()=>{
 const urls=[],ids=SIX_DRIVERS.map(d=>d.id),rows=ids.slice(0,2).map((id,i)=>({id:String(i),engine_version:SIX_ENGINE_VERSION,schema_version:6,driver_id:id,model:id,status:i?'WAITING_TRIGGER':'ACTIVE',quality:{},symbol:'XAU/USD'}));
 const evaluation={version:SIX_ENGINE_VERSION,fresh:true,drivers:ids.map(id=>({id,state:'CONFIRMED'}))};
 const handler=reader(async url=>{const u=String(url);urls.push(u);if(u.includes('device_preferences'))return Response.json([{created_at:'2026-09-25T00:00:00Z',enabled_drivers:{[ids[1]]:false}}]);if(u.includes('scalper_runs'))return Response.json([{status:'COMPLETED',completed_at:new Date().toISOString(),result:{engine:'amyfx-gold-context-v1',context:{version:'amyfx-gold-context-v1'},driverEvaluation:evaluation}}]);if(u.includes('status=in.(WAITING_TRIGGER'))return Response.json(rows);return Response.json([]);});
 const response=await handler(new Request('https://fixture.test?history=all',{headers:{'x-amy-device-token':'a'.repeat(64)}}));assert.equal(response.status,200);const data=await response.json();
 assert.equal(data.active.length,1);assert.equal(data.active[0].driverId,ids[0]);assert.equal(data.primary.id,'0');assert.equal(data.driverEvaluation.drivers.length,6);assert.equal(data.driverEvaluation.drivers[1].state,'DISABLED');assert.equal(data.active[0].isLegacy,false);
 assert.ok(urls.find(u=>u.includes('status=in.(WAITING_TRIGGER')).includes('engine_version=eq.'+SIX_ENGINE_VERSION));assert.ok(urls.find(u=>u.includes('status=in.(TP_HIT')).includes('device_scope.eq.'));
});
test('a failed run cannot publish a current context or driver evaluation',async()=>{
 const handler=reader(async url=>Response.json(String(url).includes('scalper_runs')?[{status:'FAILED',result:{engine:'amyfx-gold-context-v1',driverEvaluation:{version:SIX_ENGINE_VERSION,drivers:[]}}}]:[]));
 const data=await(await handler(new Request('https://fixture.test'))).json();assert.equal(data.context,null);assert.equal(data.driverEvaluation,null);
});
