const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function validText(value: unknown, min: number, max: number) {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

async function resolveUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: authHeader,
      },
    });
    if (!response.ok) return null;
    const user = await response.json();
    return typeof user?.id === 'string' ? user.id : null;
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body || !validText(body.deviceId, 8, 200) || !validText(body.fcmToken, 20, 4096)) {
      return json({ error: 'invalid_device_or_token' }, 400);
    }

    let scalperScope = null;
    if(body.scalperToken != null){
      if(!/^[a-f0-9]{64}$/.test(body.scalperToken))return json({error:'invalid_scalper_token'},400);
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.scalperToken));
      scalperScope=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
    }
    const deviceId = body.deviceId.trim();
    const fcmToken = body.fcmToken.trim();
    const appVersion = typeof body.appVersion === 'string' ? body.appVersion.trim().slice(0, 80) : null;
    const enabled = body.enabled !== false;
    const userId = await resolveUserId(req.headers.get('Authorization'));

    const duplicateTokenUrl = new URL(`${SUPABASE_URL}/rest/v1/device_tokens`);
    duplicateTokenUrl.searchParams.set('fcm_token', `eq.${fcmToken}`);
    duplicateTokenUrl.searchParams.set('device_id', `neq.${deviceId}`);
    await fetch(duplicateTokenUrl, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });

    const upsertUrl = new URL(`${SUPABASE_URL}/rest/v1/device_tokens`);
    upsertUrl.searchParams.set('on_conflict', 'device_id');
    const response = await fetch(upsertUrl, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        ...(scalperScope ? {scalper_scope_id:scalperScope} : {}),
        device_id: deviceId,
        fcm_token: fcmToken,
        user_id: userId,
        platform: 'android',
        enabled,
        app_version: appVersion,
        last_seen_at: new Date().toISOString(),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('device-register database error', response.status, payload);
      return json({ error: 'registration_failed' }, 502);
    }

    const row = Array.isArray(payload) ? payload[0] : payload;
    return json({
      ok: true,
      deviceId,
      enabled: row?.enabled ?? enabled,
      registeredAt: row?.updated_at || new Date().toISOString(),
    });
  } catch (error) {
    console.error('device-register unexpected error', error);
    return json({ error: 'internal_error' }, 500);
  }
});
