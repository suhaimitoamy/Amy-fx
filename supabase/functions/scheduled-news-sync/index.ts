import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
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

async function invokeFunction(slug: string, healthOnly = false, timeoutMs = 30000) {
  const target = `${SUPABASE_URL}/functions/v1/${slug}${healthOnly ? "?health=1" : ""}`;
  const response = await fetchWithTimeout(target, {
    method: healthOnly ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: healthOnly ? undefined : "{}",
  }, timeoutMs);
  const text = await response.text();
  let payload: unknown;
  try { payload = JSON.parse(text); }
  catch (_) { payload = { raw: text.slice(0, 1000) }; }
  return { ok: response.ok, status: response.status, payload };
}

async function recentSyncExists() {
  const threshold = new Date(Date.now() - 75_000).toISOString();
  const checkUrl = new URL(`${SUPABASE_URL}/rest/v1/news_sync_runs`);
  checkUrl.searchParams.set("select", "id,status,started_at");
  checkUrl.searchParams.set("started_at", `gte.${threshold}`);
  checkUrl.searchParams.set("order", "started_at.desc");
  checkUrl.searchParams.set("limit", "1");
  const response = await fetchWithTimeout(checkUrl.toString(), {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  }, 8000);
  if (!response.ok) return false;
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "backend_not_configured" }, 503);

  try {
    const healthOnly = new URL(req.url).searchParams.get("health") === "1";
    if (healthOnly) {
      const [sync, webPush, systemPush] = await Promise.all([
        invokeFunction("news-sync", true, 20000),
        invokeFunction("web-push-delivery", true, 20000),
        invokeFunction("news-system-push", true, 20000),
      ]);
      const ok = sync.ok && webPush.ok && systemPush.ok;
      return json({
        ok,
        news_sync: sync.payload,
        web_push: webPush.payload,
        system_push: systemPush.payload,
      }, ok ? 200 : 502);
    }

    const skipped = await recentSyncExists();
    let sync: any = { ok: true, status: 200, payload: { ok: true, skipped: true, reason: "recent_sync_exists" } };
    if (!skipped) sync = await invokeFunction("news-sync", false, 55000);
    if (!sync.ok) {
      console.error("news-sync returned an error", sync.status, sync.payload);
      return json({ error: "news_sync_failed", status: sync.status, detail: sync.payload }, 502);
    }

    const [webPush, systemPush] = await Promise.all([
      invokeFunction("web-push-delivery", false, 55000),
      invokeFunction("news-system-push", false, 55000),
    ]);
    if (!webPush.ok) console.error("web-push-delivery returned an error", webPush.status, webPush.payload);
    if (!systemPush.ok) console.error("news-system-push returned an error", systemPush.status, systemPush.payload);

    const deliveryOk = webPush.ok && systemPush.ok;
    return json({
      ...(typeof sync.payload === "object" && sync.payload ? sync.payload : { sync: sync.payload }),
      web_push: webPush.payload,
      web_push_ok: webPush.ok,
      system_push: systemPush.payload,
      system_push_ok: systemPush.ok,
    }, deliveryOk ? 200 : 207);
  } catch (error) {
    console.error("scheduled-news-sync failed", error);
    return json({ error: "scheduler_failed", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
});
