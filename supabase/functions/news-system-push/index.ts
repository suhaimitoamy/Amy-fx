import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cert, getApps, initializeApp } from "npm:firebase-admin@13.0.1/app";
import { getMessaging } from "npm:firebase-admin@13.0.1/messaging";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const DELIVERY_WINDOW_MS = 10 * 60 * 1000;
const CHANNEL_ID = "amy_news_v2";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

function dbHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    Accept: "application/json",
    ...extra
  };
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...dbHeaders(), ...(init.headers || {}) }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

function firebaseConfig() {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")
    || Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    || Deno.env.get("FIREBASE_ADMIN_SDK");
  if (!raw) throw new Error("Firebase service account belum tersedia");

  let value = raw.trim();
  if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
  let parsed: any = JSON.parse(value);
  if (typeof parsed === "string") parsed = JSON.parse(parsed);

  const projectId = parsed.project_id || parsed.projectId;
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const privateKey = String(parsed.private_key || parsed.privateKey || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey.includes("PRIVATE KEY")) {
    throw new Error("Firebase service account tidak lengkap");
  }
  return { projectId, clientEmail, privateKey };
}

function messaging() {
  if (!getApps().length) initializeApp({ credential: cert(firebaseConfig()) });
  return getMessaging();
}

async function authorized(request: Request) {
  return (request.headers.get("authorization") || "") === `Bearer ${SERVICE_ROLE_KEY}`;
}

async function upsertDelivery(
  newsId: number,
  deviceId: string,
  status: "sent" | "failed",
  providerMessageId: string | null,
  error: string | null
) {
  await rest("notification_system_logs?on_conflict=news_id,device_token_id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      news_id: newsId,
      device_token_id: deviceId,
      status,
      provider_message_id: providerMessageId,
      error: error?.slice(0, 1800) || null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
  });
}

async function disableDevice(deviceId: string) {
  await rest(`device_tokens?id=eq.${encodeURIComponent(deviceId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() })
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "backend_not_configured" }, 503);

  const healthOnly = new URL(request.url).searchParams.get("health") === "1";
  if (healthOnly) {
    return json({
      ok: true,
      delivery: "firebase_system_notification_plus_data",
      channel: CHANNEL_ID,
      push_configured: Boolean(
        Deno.env.get("FIREBASE_SERVICE_ACCOUNT")
        || Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        || Deno.env.get("FIREBASE_ADMIN_SDK")
      )
    });
  }
  if (!(await authorized(request))) return json({ error: "unauthorized" }, 401);

  try {
    const since = new Date(Date.now() - DELIVERY_WINDOW_MS).toISOString();
    const deliveredDataPushes = await rest(
      `notification_logs?select=news_id,device_token_id,sent_at&status=eq.sent&sent_at=gte.${encodeURIComponent(since)}&order=sent_at.asc&limit=1000`
    ) || [];

    if (!Array.isArray(deliveredDataPushes) || !deliveredDataPushes.length) {
      return json({ ok: true, attempted: 0, sent: 0, failed: 0, reason: "no_recent_data_push" });
    }

    const newsIds = [...new Set(deliveredDataPushes.map((row: any) => Number(row.news_id)).filter(Number.isFinite))];
    const deviceIds = [...new Set(deliveredDataPushes.map((row: any) => String(row.device_token_id || "")).filter(Boolean))];
    if (!newsIds.length || !deviceIds.length) {
      return json({ ok: true, attempted: 0, sent: 0, failed: 0, reason: "no_valid_delivery_pairs" });
    }

    const [newsRows, devices, existing] = await Promise.all([
      rest(`news?select=id,telegram_post_id,text_original,text_indonesian,impact,source&id=in.(${newsIds.join(",")})`),
      rest(`device_tokens?select=id,fcm_token,enabled&id=in.(${deviceIds.join(",")})&enabled=eq.true`),
      rest(`notification_system_logs?select=news_id,device_token_id,status&news_id=in.(${newsIds.join(",")})&device_token_id=in.(${deviceIds.join(",")})`)
    ]);

    const newsById = new Map((Array.isArray(newsRows) ? newsRows : []).map((row: any) => [Number(row.id), row]));
    const deviceById = new Map((Array.isArray(devices) ? devices : []).map((row: any) => [String(row.id), row]));
    const completed = new Set(
      (Array.isArray(existing) ? existing : [])
        .filter((row: any) => row.status === "sent")
        .map((row: any) => `${row.news_id}|${row.device_token_id}`)
    );

    const pairs = deliveredDataPushes.filter((row: any) => {
      const key = `${row.news_id}|${row.device_token_id}`;
      return !completed.has(key) && newsById.has(Number(row.news_id)) && deviceById.has(String(row.device_token_id));
    });

    if (!pairs.length) {
      return json({ ok: true, attempted: 0, sent: 0, failed: 0, reason: "already_system_delivered" });
    }

    const client = messaging();
    let sent = 0;
    let failed = 0;

    for (const pair of pairs) {
      const news = newsById.get(Number(pair.news_id));
      const device = deviceById.get(String(pair.device_token_id));
      const postId = String(news.telegram_post_id || news.id);
      const body = String(news.text_indonesian || news.text_original || "Berita baru XAU/USD tersedia.").slice(0, 900);
      const title = String(news.impact).toLowerCase() === "high"
        ? "🚨 Breaking News Penting XAU/USD"
        : "📰 Breaking News XAU/USD";
      const targetUrl = `https://appassets.androidplatform.net/assets/apps/market-intel/index.html#news=${encodeURIComponent(postId)}`;

      try {
        const messageId = await client.send({
          token: String(device.fcm_token),
          notification: { title, body },
          data: {
            news_id: postId,
            id: postId,
            title,
            body,
            text: body,
            impact: String(news.impact || "medium"),
            source: String(news.source || "SM_News_24h"),
            target_url: targetUrl
          },
          android: {
            priority: "high",
            ttl: 300000,
            notification: {
              channelId: CHANNEL_ID,
              icon: "ic_stat_amy_fx",
              sound: "default",
              clickAction: "amyfx.intent.action.OPEN_ROUTE",
              priority: "max",
              visibility: "public",
              defaultVibrateTimings: true,
              defaultLightSettings: true
            }
          }
        });
        await upsertDelivery(Number(news.id), String(device.id), "sent", messageId, null);
        sent += 1;
      } catch (error) {
        const code = String((error as any)?.code || "unknown");
        const message = `${code}: ${error instanceof Error ? error.message : String(error)}`;
        await upsertDelivery(Number(news.id), String(device.id), "failed", null, message);
        if (code.includes("registration-token-not-registered") || code.includes("mismatched-credential")) {
          await disableDevice(String(device.id));
        }
        failed += 1;
      }
    }

    return json({
      ok: failed === 0,
      attempted: pairs.length,
      sent,
      failed,
      delivery: "firebase_system_notification_plus_data",
      channel: CHANNEL_ID
    }, failed === 0 ? 200 : 207);
  } catch (error) {
    console.error("news-system-push failed", error);
    return json({ error: "system_push_failed", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
});
