import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const asset = relative => new URL(`../app/src/main/assets/${relative}`, import.meta.url);
const read = relative => readFileSync(asset(relative), 'utf8');

const principalPages = [
  'index.html',
  'apps/mapping/index.html',
  'apps/market-intel/index.html',
  'apps/journal/index.html',
  'apps/academy/index.html'
];

test('professional glass foundation exposes official dark and light design tokens', () => {
  const tokens = read('apps/shared/amyfx-ui-tokens.css');
  const theme = read('apps/shared/amyfx-theme.css');
  const controller = read('apps/shared/amyfx-theme-controller.js');

  assert.match(tokens, /--amy-bg:\s*#070b12/i);
  assert.match(tokens, /--amy-accent:\s*#69b7ff/i);
  assert.match(tokens, /--amy-buy:\s*#32d583/i);
  assert.match(tokens, /--amy-sell:\s*#ff5c6c/i);
  assert.match(tokens, /--amy-wait:\s*#f5b942/i);
  assert.match(theme, /html\[data-amyfx-theme="light"\]/);
  assert.match(theme, /--amy-bg:\s*#eef4fa/i);
  assert.match(controller, /amyfx\.ui\.theme\.v1/);
  assert.match(controller, /\["system", "light", "dark"\]/);
  assert.match(controller, /Android\?\.setSystemUiTheme/);
});

test('every principal Amy FX screen loads the shared redesign after its legacy contract styles', () => {
  principalPages.forEach(relative => {
    const html = read(relative);
    assert.match(html, /amyfx-theme-controller\.js/);
    assert.match(html, /amyfx-ui-tokens\.css/);
    assert.match(html, /amyfx-theme\.css/);
    assert.match(html, /amyfx-components\.css/);
    assert.match(html, /amyfx-loading\.js/);
    assert.ok(
      html.indexOf('amyfx-components.css') > html.indexOf('amyfx-blueprint-v1.css'),
      `${relative} must apply the redesign after the legacy blueprint stylesheet`
    );
  });
});

test('home uses exactly the five existing modules without duplicate access or fabricated profile data', () => {
  const app = read('app.js');
  const projectsBlock = app.match(/const projects = \[([\s\S]*?)\n  \];/)?.[1] || '';
  const ids = [...projectsBlock.matchAll(/id:\s*'([^']+)'/g)].map(match => match[1]);

  assert.deepEqual(ids, ['mapping', 'intel', 'jurnal', 'academy', 'indikator']);
  assert.match(app, /const coreModules = projects\.slice\(0, 4\)/);
  assert.match(app, /quickCard\(indicator, true\)/);
  assert.doesNotMatch(app, /VIP Member|Lifetime Access|Trader Amy FX|VIP FACILITY/i);
  assert.doesNotMatch(app, /const favorites = \[projects\.find/);
  assert.match(app, /amy_indicator_favorites/);
  assert.match(app, /Belum ada item tersimpan/);
});

test('loading and native updater presentation follow the redesign without Preview identity', () => {
  const loading = read('apps/shared/amyfx-loading.js');
  const updater = read('update-checker.js');
  const native = read('../java/com/amyelitesuite/MainActivity.kt');

  assert.match(loading, /delay.*350/);
  assert.match(loading, /Pemuatan membutuhkan waktu lebih lama/);
  assert.match(loading, /data-amyfx-loading-retry/);
  assert.doesNotMatch(loading, /\d+%/);

  assert.match(updater, /showUpdatePopup/);
  assert.match(updater, /Update Amy FX Tersedia/);
  assert.match(updater, /Android\.startAppUpdate/);
  assert.match(updater, /AmyFXUpdateNative/);
  assert.match(updater, /Pembaruan Amy FX Tersedia/);
  assert.doesNotMatch(updater, /Amy FX Preview|preview-update\.json|personal\/amyfx-private/);
  assert.match(native, /fun setSystemUiTheme\(theme: String\?\)/);
});

test('visible principal UI copy omits Preview and placeholder membership claims', () => {
  const sources = [
    ...principalPages.map(read),
    read('app.js'),
    read('profile-system-settings-v1.js'),
    read('apps/shared/amyfx-blueprint-v1.js')
  ].join('\n');

  assert.doesNotMatch(sources, /Amy FX Preview|VIP Member|Lifetime Access|VIP Facility/i);
});
