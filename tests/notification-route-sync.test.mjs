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

  const calls = { tabs: [], scrolls: 0, addedClasses: [], removedClasses: [] };
  let cardAvailable = false;
  const card = {
    classList: {
      add(value) { calls.addedClasses.push(value); },
      remove(value) { calls.removedClasses.push(value); }
    },
    scrollIntoView() { calls.scrolls += 1; }
  };

  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() {}
  }

  const document = {
    readyState: 'complete',
    hidden: false,
    documentElement: {},
    head: { appendChild() {} },
    addEventListener() {},
    createElement() { return { id: '', textContent: '' }; },
    getElementById(id) {
      if (id === 'amy-notification-focus-style') return null;
      if (id === 'amy-entry-watch-card' && cardAvailable) return card;
      return null;
    }
  };

  const windowObject = {
    addEventListener() {},
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {},
    requestAnimationFrame(callback) { callback(); },
    MutationObserver: FakeMutationObserver
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
    MutationObserver: FakeMutationObserver,
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
    makeCardAvailable() { cardAvailable = true; },
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

test('pending Android notification route survives until setTab is ready, then opens Analyze and focuses Entry Watch', () => {
  const harness = createHarness();
  assert.equal(harness.storage.get('amyfx.notification.route'), 'Analyze');

  assert.equal(harness.context.window.AmyFXNotificationRoute.consume(), false);
  assert.equal(harness.storage.get('amyfx.notification.route'), 'Analyze', 'route must not be lost during WebView startup race');

  harness.installSetTab();
  harness.makeCardAvailable();
  assert.equal(harness.context.window.AmyFXNotificationRoute.consume(), true);
  assert.deepEqual(harness.calls.tabs, ['Analyze']);
  assert.equal(harness.storage.has('amyfx.notification.route'), false);
  assert.equal(harness.calls.scrolls, 1);
  assert.ok(harness.calls.addedClasses.includes('amy-notification-focus'));
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
