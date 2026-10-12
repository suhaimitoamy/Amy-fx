// Opaque device capability: only its SHA-256 is persisted on the server.
export async function deviceScope(request) {
  const token=request.headers.get('x-amy-device-token');
  if(token==null)return null;
  if(!/^[a-f0-9]{64}$/.test(token))throw new Error('invalid_device_token');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
export function normalizeDriverToggles(input,registry) {
  if(input==null||typeof input!=='object'||Array.isArray(input))throw new Error('invalid_driver_settings');
  const result={};
  for(const driver of registry){
    if(input[driver.id]!==undefined&&typeof input[driver.id]!=='boolean')throw new Error('invalid_driver_setting');
    result[driver.id]=input[driver.id]!==false;
  }
  return result;
}
export function scopeEvaluation(evaluation,scope) {
  if(!scope)return evaluation;
  return {...evaluation,candidates:evaluation.candidates.map(c=>({...c,id:`${scope}:${c.id}`,device_scope:scope})),telemetry:evaluation.telemetry.map(t=>({...t,candidate_id:`${scope}:${t.candidate_id}`}))};
}
