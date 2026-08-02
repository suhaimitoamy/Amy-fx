import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cert, getApps, initializeApp } from "npm:firebase-admin@13.0.1/app";
import { getMessaging } from "npm:firebase-admin@13.0.1/messaging";
import { isRelevantNews } from "../../../lib/news-relevance.mjs";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const PREVIEW_DEVICE_PREFIX = "com.amyelitesuite.learningpreview:";
const CHANNEL_ID = "amy_news_v2";
const STAGE = "SYSTEM_NOTIFICATION";
const LEASE_KEY = "amyfx-preview-news-system-push";
const DELIVERY_WINDOW_MS = 20 * 60 * 1000;

const responseHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

function dbHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    Accept: "application/json",
    ...extra,
  };
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...dbHeaders(), ...(init.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
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

function canonicalEventKey(news: any) {
  const postId = String(news?.telegram_post_id || "").trim();
  return postId ? `telegram:SM_News_24h:${postId}` : `news:${Number(news?.id)}`;
}

async function claimSchedulerLease() {
  return rest("rpc/amyfx_claim_preview_scheduler_lease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_lease_key: LEASE_KEY, p_lease_seconds: 90 }),
  });
}

async function releaseSchedulerLease(token: string) {
  if (!token) return;
  await rest("rpc/amyfx_release_preview_scheduler_lease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_lease_key: LEASE_KEY, p_lease_token: token }),
  });
}

async function claimDelivery(news: any, device: any) {
  const eventKey = canonicalEventKey(news);
  const recipientScope = `preview:${device.id}`;
  const rows = await rest("rpc/amyfx_claim_preview_news_delivery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_event_key: eventKey,
      p_news_id: Number(news.id),
      p_stage: STAGE,
      p_recipient_scope: recipientScope,
      p_device_token_id: String(device.id),
      p_lease_seconds: 120,
    }),
  });
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function completeDelivery(claim: any, status: "SENT" | "RETRY" | "FAILED", messageId: string | null, error: string | null) {
  return rest("rpc/amyfx_complete_preview_news_delivery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_id: Number(claim.id),
      p_claim_token: String(claim.claim_token),
      p_status: status,
      p_provider_message_id: messageId,
      p_error: error,
      p_retry_after_seconds: 120,
    }),
  });
}

async function disableDevice(deviceId: string) {
  await rest(`device_tokens?id=eq.${encodeURIComponent(deviceId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() }),
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "backend_not_configured" }, 503);
  const healthOnly = new URL(request.url).searchParams.get("health") === "1";
  if (healthOnly) {
    return json({
      ok: true,
      preview_only: true,
      delivery: "single_firebase_system_notification_plus_data",
      canonical_event_key: true,
      atomic_claim_ledger: true,
      scheduler_lease: true,
      channel: CHANNEL_ID,
    });
  }
  if ((request.headers.get("authorization") || "") !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return json({ error: "unauthorized" }, 401);
  }

  let leaseToken = "";
  try {
    leaseToken = String(await claimSchedulerLease() || "");
    if (!leaseToken) return json({ ok: true, skipped: true, reason: "scheduler_lease_held" });

    const since = new Date(Date.now() - DELIVERY_WINDOW_MS).toISOString();
    const [newsRows, devices] = await Promise.all([
      rest(`news?select=id,telegram_post_id,text_original,text_indonesian,impact,source,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc,id.asc&limit=50`),
      rest(`device_tokens?select=id,device_id,fcm_token,enabled&enabled=eq.true&device_id=like.${encodeURIComponent(`${PREVIEW_DEVICE_PREFIX}%`)}&order=last_seen_at.desc&limit=500`),
    ]);
    const news = (Array.isArray(newsRows) ? newsRows : []).filter(row => isRelevantNews(row.text_original || row.text_indonesian || ""));
    const activeDevices = Array.isArray(devices) ? devices : [];
    if (!news.length || !activeDevices.length) {
      return json({ ok: true, attempted: 0, sent: 0, failed: 0, reason: news.length ? "no_preview_devices" : "no_recent_relevant_news" });
    }

    const client = messaging();
    let claimed = 0;
    let sent = 0;
    let failed = 0;
    let retried = 0;

    for (const item of news) {
      const postId = String(item.telegram_post_id || item.id);
      const body = String(item.text_indonesian || item.text_original || "Berita baru XAU/USD tersedia.").slice(0, 900);
      const title = String(item.impact || "").toLowerCase() === "high"
        ? "🚨 Breaking News Penting XAU/USD"
        : "📰 Breaking News XAU/USD";
      const targetUrl = `https://appassets.androidplatform.net/assets/apps/market-intel/index.html#news=${encodeURIComponent(postId)}`;

      for (const device of activeDevices) {
        const delivery = await claimDelivery(item, device);
        if (!delivery) continue;
        claimed += 1;
        try {
          const messageId = await client.send({
            token: String(device.fcm_token),
            notification: { title, body },
            data: {
              notification_type: "news",
              news_id: postId,
              id: postId,
              title,
              body,
              text: body,
              impact: String(item.impact || "medium"),
              source: String(item.source || "SM_News_24h"),
              event_key: canonicalEventKey(item),
              idempotency_key: String(delivery.idempotency_key),
              target_url: targetUrl,
              amyfx_route: "MarketIntel",
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
                defaultLightSettings: true,
              },
            },
          });
          await completeDelivery(delivery, "SENT", messageId, null);
          sent += 1;
        } catch (error) {
          const code = String((error as any)?.code || "unknown");
          const detail = `${code}: ${error instanceof Error ? error.message : String(error)}`;
          const permanent = code.includes("registration-token-not-registered") || code.includes("mismatched-credential");
          const exhausted = Number(delivery.attempt_count || 0) >= 5;
          await completeDelivery(delivery, permanent || exhausted ? "FAILED" : "RETRY", null, detail);
          if (permanent) await disableDevice(String(device.id));
          if (permanent || exhausted) failed += 1;
          else retried += 1;
        }
      }
    }

    return json({
      ok: failed === 0,
      attempted: claimed,
      sent,
      failed,
      retry: retried,
      preview_only: true,
      delivery: "single_firebase_system_notification_plus_data",
      channel: CHANNEL_ID,
    }, failed === 0 ? 200 : 207);
  } catch (error) {
    console.error("preview-news-system-push failed", error);
    return json({ error: "preview_news_push_failed", detail: error instanceof Error ? error.message : String(error) }, 500);
  } finally {
    await releaseSchedulerLease(leaseToken).catch(error => console.error("preview news lease release failed", error));
  }
});
