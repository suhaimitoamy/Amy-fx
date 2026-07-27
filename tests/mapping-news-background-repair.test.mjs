import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(`${root}/${path}`, 'utf8');

function assertSyntax(path) {
  const result = spawnSync(process.execPath, ['--check', `${root}/${path}`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('Mapping repairs freshness from the latest actually closed candle', () => {
  const path = 'app/src/main/assets/apps/mapping/js/mapping-runtime-repair-v3.js';
  const runtime = read(path);
  const index = read('app/src/main/assets/apps/mapping/index.html');

  assertSyntax(path);
  assert.match(index, /mapping-runtime-repair-v3\.js/);
  assert.match(runtime, /function candleClosed/);
  assert.match(runtime, /explicitLive/);
  assert.match(runtime, /sourceCandleTime/);
  assert.match(runtime, /LATEST_CLOSED_CANDLE/);
  assert.match(runtime, /await runAnalysis\(state\.tf\)/);
  assert.match(runtime, /amyfx:candles-updated/);
});

test('Paused or terminal Entry Watch cannot keep an old BUY or SELL card visible', () => {
  const runtime = read('app/src/main/assets/apps/mapping/js/mapping-runtime-repair-v3.js');
  assert.match(runtime, /ACTIONABLE_WATCH_STAGES/);
  assert.match(runtime, /WATCHING_LEVEL/);
  assert.match(runtime, /LEVEL_TESTING/);
  assert.match(runtime, /ENTRY_TRIGGERED/);
  assert.match(runtime, /amy-entry-watch-card/);
  assert.match(runtime, /\.remove\(\)/);
  assert.match(runtime, /state\.result\.bestSetup = null/);
});

test('Android news notifications use a durable high-priority system channel', () => {
  const manifest = read('app/src/main/AndroidManifest.xml');
  const application = read('app/src/main/java/com/amyelitesuite/AmyFxApplication.kt');
  const firebase = read('app/src/main/java/com/amyelitesuite/AmyFirebaseMessagingService.kt');
  const worker = read('app/src/main/java/com/amyelitesuite/NewsSyncWorker.kt');
  const registrar = read('app/src/main/java/com/amyelitesuite/FcmDeviceRegistrar.kt');
  const googleServices = read('app/google-services.json');

  assert.match(manifest, /com\.google\.firebase\.messaging\.default_notification_channel_id/);
  assert.match(manifest, /amy_news_v2/);
  assert.match(application, /NEWS_CHANNEL_ID = "amy_news_v2"/);
  assert.match(application, /IMPORTANCE_HIGH/);
  assert.match(firebase, /AmyFxApplication\.NEWS_CHANNEL_ID/);
  assert.match(firebase, /PRIORITY_MAX/);
  assert.match(firebase, /DEFAULT_ALL/);
  assert.match(worker, /AmyFxApplication\.NEWS_CHANNEL_ID/);
  assert.match(worker, /PRIORITY_MAX/);
  assert.match(registrar, /KEY_APP_VERSION/);
  assert.match(registrar, /previousVersion == currentVersion/);
  assert.match(googleServices, /com\.amyelitesuite\.learningpreview/);
});

test('Supabase sends system notification plus data and scheduler invokes it', () => {
  const systemPush = read('supabase/functions/news-system-push/index.ts');
  const scheduler = read('supabase/functions/scheduled-news-sync/index.ts');

  assert.match(systemPush, /notification: \{ title, body \}/);
  assert.match(systemPush, /data: \{/);
  assert.match(systemPush, /channelId: CHANNEL_ID/);
  assert.match(systemPush, /firebase_system_notification_plus_data/);
  assert.match(systemPush, /notification_system_logs/);
  assert.match(scheduler, /invokeFunction\("news-system-push"/);
  assert.match(scheduler, /system_push_ok/);
});
