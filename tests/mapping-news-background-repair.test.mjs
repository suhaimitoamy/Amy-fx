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

test('Mapping keeps the latest closed candle authoritative without autonomous refresh', () => {
  const path = 'app/src/main/assets/apps/mapping/js/mapping-runtime-repair-v3.js';
  const runtime = read(path);
  const index = read('app/src/main/assets/apps/mapping/index.html');

  assertSyntax(path);
  assert.match(index, /mapping-runtime-repair-v3\.js/);
  assert.match(runtime, /const snapshot = result\.mappingSnapshot/);
  assert.match(runtime, /latestClosedCandleClose/);
  assert.match(runtime, /sourceCandleTime/);
  assert.match(runtime, /markCachedSeriesUsable/);
  assert.match(runtime, /sourceSignature/);
  assert.match(runtime, /dataStale: false/);
  assert.match(runtime, /await runEngineAnalysis\(tf\)/);
  assert.match(runtime, /amyfx:candles-updated/);
  assert.match(runtime, /amyfx:mapping-refresh-request/);
  assert.match(runtime, /version: '5\.0\.0'/);
  assert.doesNotMatch(runtime, /setInterval|visibilitychange|addEventListener\('focus'|addEventListener\('online'/);
});

test('Entry Watch card stays hidden while lifecycle data remains read-only', () => {
  const runtime = read('app/src/main/assets/apps/mapping/js/entry-watch-runtime-v2.js');
  const analyze = read('app/src/main/assets/apps/mapping/js/engine/concept-analyze.js');
  assert.match(runtime, /amy-entry-watch-card/);
  assert.match(runtime, /document\.getElementById\(CARD_ID\)\?\.remove\(\)/);
  assert.match(runtime, /readOnly:\s*true/);
  assert.match(runtime, /canonical\.execution\?\.lifecycleStage/);
  assert.doesNotMatch(runtime, /insertAdjacentHTML|outerHTML\s*=/);
  assert.match(analyze, /causalEntryLifecycleContract/);
  assert.match(analyze, /!lifecycle\.terminal/);
  assert.match(analyze, /entryAllowed: Boolean\(activeSetup\)/);
  assert.match(analyze, /terminal: lifecycle\.terminal/);
  assert.doesNotMatch(runtime, /result\.bestSetup\s*=/);
});

test('Android news notifications use one durable production channel', () => {
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
  assert.match(googleServices, /"package_name": "com\.amyelitesuite"/);
});

test('production news keeps one canonical scheduler and system-notification route', () => {
  const systemPush = read('supabase/functions/news-system-push/index.ts');
  const newsSync = read('supabase/functions/news-sync/handler.ts');
  const scheduler = read('supabase/functions/scheduled-news-sync/index.ts');

  assert.match(systemPush, /notification: \{ title, body \}/);
  assert.match(systemPush, /data: \{/);
  assert.match(systemPush, /channelId: CHANNEL_ID/);
  assert.match(systemPush, /firebase_system_notification_plus_data/);
  assert.match(systemPush, /notification_system_logs/);
  assert.doesNotMatch(systemPush, /PREVIEW_DEVICE_PREFIX|preview-news-system-push/);
  assert.doesNotMatch(newsSync, /PREVIEW_DEVICE_PREFIX|learningpreview/);
  assert.match(scheduler, /invokeFunction\("news-sync"/);
  assert.match(scheduler, /invokeFunction\("web-push-delivery"/);
  assert.match(scheduler, /invokeFunction\("news-system-push"/);
  assert.match(scheduler, /const deliveryOk = webPush\.ok && systemPush\.ok/);
  assert.doesNotMatch(scheduler, /preview-news-system-push|previewSystemPush|preview_system_push/);
});
