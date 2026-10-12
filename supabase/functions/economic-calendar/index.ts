import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=180',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

const FEED_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method === 'HEAD') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(FEED_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return json({ error: `upstream_${res.status}`, events: [] }, 502);
    }

    const data = await res.json();
    return json(data, 200);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return json({ error: 'calendar_fetch_failed', detail, events: [] }, 500);
  }
});
