import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const routeScriptUrl = new URL('app/src/main/assets/apps/mapping/js/notification-route-sync.js', root);
const indexUrl = new URL('app/src/main/assets/apps/mapping/index.html', root);
const mainActivityUrl = new URL('app/src/main/java/com/amyelitesuite/MainActivity.kt', root);
const routeSource = readFileSync(routeScriptUrl, 'utf8');

function createHarness({ route = 'Analyze', hash = '#Analyze', search = '', consumedUrl = '' } = {}) {
  const storage = new Map();
  if (route) storage.set('amyfx.notification.route', route);
  const href = `https://appassets.androidplatform.net/assets/apps/mapping/index.html${search}${hash}`;
  if (consumedUrl) storage.set('amyfx.notification.consumed_url', consumedUrl === 'CURRENT' ? href : consumedUrl);

  const calls = { tabs: [] };
  const document = {
    readyState: 'complete',
    hidden: false,
    addEventListener() {}
  };

  const windowObject = {
    addEventListener() {},
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {}
  };

  const context = {
    window: windowObject,
    document,
    location: { href, hash, search },
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    URLSearchParams,
    decodeURIComponent,
    Set,
    Object,
    String
  };
  windowObject.window = windowObject;
  windowObject.document = document;
  windowObject.location = context.location;
  windowObject.localStorage = context.localStorage;

  vm.runInNewContext(routeSource, context, { filename: 'notification-route-sync.js' });

  return {
    context,
    storage,
    calls,
    installSetTab() {
      windowObject.setTab = value => calls.tabs.push(value);
    }
  };
}

test('notification route helper passes syntax validation and loads before Mapping modules', () => {
  execFileSync(process.execPath, ['--check', fileURLToPath(routeScriptUrl)], { stdio: 'pipe' });
  const html = readFileSync(indexUrl, 'utf8');
  const helperIndex = html.indexOf('js/notification-route-sync.js');
  const mainIndex = html.indexOf('js/main.js');
  const runtimeIndex = html.indexOf('js/entry-watch-runtime-v2.js');
  assert.ok(helperIndex >= 0, 'notification route helper must be loaded');
  assert.ok(helperIndex < mainIndex, 'route helper must load before main.js');
  assert.ok(helperIndex < runtimeIndex, 'route helper must load before Entry Watch runtime');
});

test('pending Android notification route survives until setTab is ready, then opens Analyze exactly once', () => {
  const harness = createHarness();
  assert.equal(harness.storage.get('amyfx.notification.route'), 'Analyze');

  assert.equal(harness.context.window.AmyFXNotificationRoute.consume(), false);
  assert.equal(harness.storage.get('amyfx.notification.route'), 'Analyze', 'route must not be lost during WebView startup race');

  harness.installSetTab();
  assert.equal(harness.context.window.AmyFXNotificationRoute.consume(), true);
  assert.deepEqual(harness.calls.tabs, ['Analyze']);
  assert.equal(harness.storage.has('amyfx.notification.route'), false);

  assert.equal(harness.context.window.AmyFXNotificationRoute.consume(), true);
  assert.deepEqual(harness.calls.tabs, ['Analyze'], 'consumed notification must not reopen Analyze');
});

test('notification route never forces card focus, nested observers, or visibility refresh', () => {
  assert.doesNotMatch(routeSource, /scrollIntoView|scrollTo\(|scrollBy\(/);
  assert.doesNotMatch(routeSource, /amy-notification-focus|focusEntryWatch|pendingEntryFocus/);
  assert.doesNotMatch(routeSource, /MutationObserver/);
  assert.doesNotMatch(routeSource, /visibilitychange|window\.addEventListener\('focus'/);
});

test('consumed hash does not force Analyze again after the user manually changes tabs', () => {
  const harness = createHarness({ route: '', consumedUrl: 'CURRENT' });
  harness.installSetTab();
  assert.equal(harness.context.window.AmyFXNotificationRoute.consume(), true);
  assert.deepEqual(harness.calls.tabs, []);
});

test('Android keeps the route in localStorage and retries it after page load', () => {
  const source = readFileSync(mainActivityUrl, 'utf8');
  assert.match(source, /onPageFinished[\s\S]*applyAmyFxRoute/);
  assert.match(source, /localStorage\.setItem\('amyfx\.notification\.route'/);
  assert.match(source, /if\(typeof setTab==='function'\)setTab/);
});
