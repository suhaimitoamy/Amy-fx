import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cert, getApps, initializeApp } from "npm:firebase-admin@13.0.1/app";
import { getMessaging } from "npm:firebase-admin@13.0.1/messaging";

const SUPABASE_URL = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const CHANNEL_ID = "amy_scalper_v1";
const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers }); }
function dbHeaders(extra = {}) { return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Accept: "application/json", ...extra }; }
async function rest(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders(), ...(init.headers || {}) } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
function firebaseConfig() {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || Deno.env.get("FIREBASE_ADMIN_SDK");
  if (!raw) throw new Error("Firebase service account belum tersedia");
  let value = raw.trim();
  if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
  let parsed = JSON.parse(value);
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  const projectId = parsed.project_id || parsed.projectId;
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const privateKey = String(parsed.private_key || parsed.privateKey || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey.includes("PRIVATE KEY")) throw new Error("Firebase service account tidak lengkap");
  return { projectId, clientEmail, privateKey };
}
function messaging() {
  if (!getApps().length) initializeApp({ credential: cert(firebaseConfig()) });
  return getMessaging();
}
function driverLabel(setup) {
  const name = setup.driver_name || (setup.model === "IFVG_SCALPER" ? "IFVG Legacy" : String(setup.model || "Scalper Engine").replaceAll("_", " "));
  const timeframe = setup.timeframe ? ` ${setup.timeframe}` : "";
  return `${name}${timeframe}`.trim();
}
function recommendationPrefix(setup, status) {
  if (status !== "WAITING_TRIGGER" && status !== "WAITING_NEXT_OPEN" && status !== "ENTRY_READY" && status !== "ACTIVE") return "";
  if (setup.recommendation_status === "DUPLICATE_CLUSTER") return "CLUSTER · ";
  return "";
}
function titleFor(setup, status) {
  const label = driverLabel(setup);
  const prefix = recommendationPrefix(setup, status);
  if (status === "WAITING_TRIGGER") return `${prefix}[SIMULASI] ${label} ${setup.direction} — MENUNGGU MIDPOINT FVG`;
  if (status === "WAITING_NEXT_OPEN" || status === "ENTRY_READY") return `${prefix}[SIMULASI] ${label} ${setup.direction} TERKONFIRMASI`;
  if (status === "ACTIVE") return `${prefix}[SIMULASI] ${label} ${setup.direction} — ENTRY READY`;
  if (status === "TP1_HIT") return `[SIMULASI] ${label} ${setup.direction} — TP1 +10 HIT · SL TETAP`;
  if (status === "BE_ACTIVE") return `[SIMULASI] ${label} ${setup.direction} — STATUS BE ENGINE LAMA`;
  if (status === "TP_HIT") return `[SIMULASI] ${label} ${setup.direction} — TP2 HIT`;
  if (status === "SL_HIT") return `[SIMULASI] ${label} ${setup.direction} — SL HIT`;
  if (status === "BE_HIT") return `[SIMULASI] ${label} ${setup.direction} — BREAKEVEN`;
  if (status === "TIME_EXIT") return `[SIMULASI] ${label} ${setup.direction} — EXPIRED`;
  return `[SIMULASI] ${label} ${setup.direction}`;
}
function bodyFor(setup, event) {
  const base = String(event.message || "Setup Scalper Engine Amy FX diperbarui.");
  if (setup.recommendation_status === "DUPLICATE_CLUSTER") return `Setup tetap dipantau secara independen dalam cluster driver yang sama. ${base}`.slice(0, 900);
  return base.slice(0, 900);
}
async function logDelivery(eventId, deviceId, status, providerMessageId, error) {
  await rest("amyfx_preview_scalper_notification_logs?on_conflict=event_id,device_token_id", {
    method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ event_id: eventId, device_token_id: deviceId, status, provider_message_id: providerMessageId, error: error ? String(error).slice(0, 1800) : null, sent_at: status === "sent" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }),
  });
}
async function disableDevice(deviceId) {
  await rest(`device_tokens?id=eq.${encodeURIComponent(deviceId)}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() }) });
}

Deno.serve(async (request) => {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "backend_not_configured" }, 503);
  const health = new URL(request.url).searchParams.get("health") === "1";
  if (health) return json({ ok: true, channel: CHANNEL_ID, audience: "all_enabled_amyfx_devices", multiDriver: true });
  if ((request.headers.get("authorization") || "") !== `Bearer ${SERVICE_ROLE_KEY}`) return json({ error: "unauthorized" }, 401);
  try {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const events = await rest(`amyfx_preview_scalper_events?select=id,setup_id,status,message,event_time&notification_eligible=eq.true&notified_at=is.null&event_time=gte.${encodeURIComponent(since)}&order=event_time.asc&limit=100`) || [];
    if (!Array.isArray(events) || !events.length) return json({ ok: true, attempted: 0, sent: 0, failed: 0 });
    const setupIds = [...new Set(events.map(event => String(event.setup_id || "")).filter(Boolean))];
    const setupQuery = new URLSearchParams({
      select: "id,model,driver_id,driver_name,timeframe,direction,status,recommendation_status,entry_price,stop_loss,break_even_trigger,target_price,result_r,bars_elapsed",
      id: `in.(${setupIds.map(id => `"${id.replaceAll('"', '')}"`).join(",")})`,
    });
    const deviceQuery = new URLSearchParams({ select: "id,device_id,fcm_token,enabled", enabled: "eq.true" });
    const [setups, devices] = await Promise.all([rest(`amyfx_preview_scalper_setups?${setupQuery.toString()}`), rest(`device_tokens?${deviceQuery.toString()}`)]);
    const setupById = new Map((Array.isArray(setups) ? setups : []).map(row => [String(row.id), row]));
    const activeDevices = Array.isArray(devices) ? devices : [];
    if (!activeDevices.length) return json({ ok: true, attempted: 0, sent: 0, failed: 0, reason: "no_enabled_devices" });
    const client = messaging(); let sent = 0; let failed = 0;
    for (const event of events) {
      const setup = setupById.get(String(event.setup_id));
      if (!setup) continue;
      const targetUrl = `https://appassets.androidplatform.net/assets/apps/mapping/index.html#scalper=${encodeURIComponent(setup.id)}`;
      let eventSent = false;
      for (const device of activeDevices) {
        try {
          const title = titleFor(setup, event.status); const body = bodyFor(setup, event);
          const messageId = await client.send({
            token: String(device.fcm_token), notification: { title, body },
            data: { notification_type: "scalper", setup_id: String(setup.id), model: String(setup.model), driver_id: String(setup.driver_id || setup.model), driver_name: String(setup.driver_name || setup.model), timeframe: String(setup.timeframe || "M15"), direction: String(setup.direction), status: String(event.status), title, body, target_url: targetUrl, amyfx_route: "Mapping" },
            android: { priority: "high", ttl: 300000, notification: { channelId: CHANNEL_ID, icon: "ic_stat_amy_fx", sound: "default", clickAction: "amyfx.intent.action.OPEN_ROUTE", priority: "max", visibility: "public", defaultVibrateTimings: true, defaultLightSettings: true } },
          });
          await logDelivery(Number(event.id), String(device.id), "sent", messageId, null); sent += 1; eventSent = true;
        } catch (error) {
          const code = String(error?.code || "unknown"); const detail = `${code}: ${error instanceof Error ? error.message : String(error)}`;
          await logDelivery(Number(event.id), String(device.id), "failed", null, detail);
          if (code.includes("registration-token-not-registered") || code.includes("mismatched-credential")) await disableDevice(String(device.id));
          failed += 1;
        }
      }
      if (eventSent) await rest(`amyfx_preview_scalper_events?id=eq.${event.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ notified_at: new Date().toISOString() }) });
    }
    return json({ ok: failed === 0, attempted: sent + failed, sent, failed, channel: CHANNEL_ID }, failed === 0 ? 200 : 207);
  } catch (error) {
    console.error("scalper-system-push failed", error);
    return json({ error: "scalper_push_failed", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
});
