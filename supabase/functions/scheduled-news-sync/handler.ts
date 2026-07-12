const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function handler(req: Request) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    const requestUrl = new URL(req.url);
    const healthOnly = requestUrl.searchParams.get('health') === '1';

    if (!healthOnly) {
      const threshold = new Date(Date.now() - 75_000).toISOString();
      const checkUrl = new URL(`${SUPABASE_URL}/rest/v1/news_sync_runs`);
      checkUrl.searchParams.set('select', 'id,status,started_at');
      checkUrl.searchParams.set('started_at', `gte.${threshold}`);
      checkUrl.searchParams.set('order', 'started_at.desc');
      checkUrl.searchParams.set('limit', '1');

      const recentRes = await fetchWithTimeout(checkUrl.toString(), {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`
        }
      }, 8000);

      if (recentRes.ok) {
        const recent = await recentRes.json();
        if (Array.isArray(recent) && recent.length > 0) {
          return json({ ok: true, skipped: true, reason: 'recent_sync_exists' });
        }
      }
    }

    const target = `${SUPABASE_URL}/functions/v1/news-sync${healthOnly ? '?health=1' : ''}`;
    const syncRes = await fetchWithTimeout(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    }, healthOnly ? 20000 : 55000);

    const text = await syncRes.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch (_) {
      payload = { raw: text.slice(0, 1000) };
    }

    if (!syncRes.ok) {
      console.error('news-sync returned an error', syncRes.status, payload);
      return json({ error: 'news_sync_failed', status: syncRes.status, detail: payload }, 502);
    }

    return json(payload);
  } catch (error) {
    console.error('scheduled-news-sync failed', error);
    return json({ error: 'scheduler_failed' }, 500);
  }
}
