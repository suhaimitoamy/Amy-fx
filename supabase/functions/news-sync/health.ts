import { cert, getApps, initializeApp } from 'npm:firebase-admin@13.0.1/app';
import { getMessaging } from 'npm:firebase-admin@13.0.1/messaging';

function parseFirebaseConfig() {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    || Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')
    || Deno.env.get('FIREBASE_ADMIN_SDK');
  if (!raw) throw new Error('Firebase service account belum tersedia');

  let value = raw.trim();
  if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
  let parsed: any = JSON.parse(value);
  if (typeof parsed === 'string') parsed = JSON.parse(parsed);

  const projectId = parsed.project_id || parsed.projectId;
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const privateKey = String(parsed.private_key || parsed.privateKey || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey.includes('PRIVATE KEY')) {
    throw new Error('Firebase service account tidak lengkap');
  }
  return { projectId, clientEmail, privateKey };
}

export async function healthResponse() {
  try {
    if (!getApps().length) initializeApp({ credential: cert(parseFirebaseConfig()) });
    const app = getMessaging().app;
    return new Response(JSON.stringify({
      ok: true,
      push_configured: true,
      project_id: app.options.projectId || null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      ok: false,
      push_configured: false,
      error: message
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
