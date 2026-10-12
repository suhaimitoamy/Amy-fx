import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function runtime({ android = false, reject = false } = {}) {
  const ids = new Map();
  function element(id = '') {
    const classes = new Set(), listeners = new Map();
    const node = {
      id, children: [], dataset: {}, attributes: {}, parentNode: null,
      classList: { contains: k => classes.has(k), toggle(k, value) { value ? classes.add(k) : classes.delete(k); } },
      appendChild(child) { child.parentNode?.removeChild(child); this.children.push(child); child.parentNode = this; return child; },
      removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; },
      insertBefore(child, before) { child.parentNode?.removeChild(child); this.children.splice(this.children.indexOf(before), 0, child); child.parentNode = this; },
      replaceChild(child, old) { child.parentNode?.removeChild(child); const i = this.children.indexOf(old); this.children[i] = child; old.parentNode = null; child.parentNode = this; },
      replaceChildren() { this.children = []; },
      setAttribute(k, v) { this.attributes[k] = v; },
      querySelectorAll() { return []; }, querySelector() { return null; },
      addEventListener(k, fn) { listeners.set(k, [...(listeners.get(k) || []), fn]); },
      dispatch(k, event = {}) { for (const fn of listeners.get(k) || []) fn(event); },
      focus() { this.focused = true; }
    };
    Object.defineProperty(node, 'innerHTML', { set(html) {
      for (const match of html.matchAll(/id="([^"]+)"/g)) this.appendChild(element(match[1]));
    }});
    if (id) ids.set(id, node);
    return node;
  }
  const doc = element(), body = element(), main = element(), workspace = element('replayWorkspace');
  body.appendChild(main); main.appendChild(workspace);
  const panel = element(); workspace.appendChild(panel);
  const container = element('chart'); panel.appendChild(container);
  Object.assign(doc, { body, createElement: () => element(), createComment: () => element(), getElementById: id => ids.get(id) });
  const root = element();
  let requests = 0, resizes = 0;
  workspace.requestFullscreen = () => { requests++; return reject ? Promise.reject(new Error('unsupported')) : Promise.resolve(); };
  Object.assign(root, { AmyPracticeCore: {}, scrollY: 240, requestAnimationFrame: fn => fn(), scrollTo(x, y) { this.restoredScroll = y; } });
  if (android) root.Android = {};
  vm.runInNewContext(readFileSync(new URL('../app/src/main/assets/apps/academy/trading-practice/assets/js/practice-ui.js', import.meta.url), 'utf8'), { window: root, document: doc });
  const chart = { container, drawings: [], drawingStyle: {}, resize() { resizes++; }, isDrawingVisible: () => true };
  root.AmyPracticeUI.bindDrawingToolbar(chart);
  return { ids, root, doc, body, main, workspace, chart, button: ids.get('replayFullscreen'), requests: () => requests, resizes: () => resizes };
}

test('object close works in normal/fullscreen without changing drawings or fullscreen', () => {
  const r = runtime({android:true});
  const menu=r.ids.get('replayObjectMenu'), close=r.ids.get('closeObjectMenu');
  const saved={id:'kept'};r.chart.drawings.push(saved);
  for(const fullscreen of [false,true]) {
    if(fullscreen)r.button.dispatch('click');
    menu.open=true;close.dispatch('click');
    assert.equal(menu.open,false);
    assert.equal(r.ids.get('replayObjectSummary').focused,true);
    assert.equal(r.workspace.classList.contains('is-fullscreen'),fullscreen);
    assert.equal(r.chart.drawings[0],saved);
  }
});

test('WebView fullscreen escapes transformed parent and restores the same workspace and scroll', () => {
  const r = runtime({ android: true });
  r.button.dispatch('click');
  assert.equal(r.workspace.parentNode, r.body);
  assert.equal(r.workspace.classList.contains('is-fullscreen'), true);
  assert.equal(r.button.attributes['aria-pressed'], 'true');
  assert.equal(r.requests(), 0);
  r.button.dispatch('click');
  assert.equal(r.workspace.parentNode, r.main);
  assert.equal(r.root.restoredScroll, 240);
  assert.equal(r.button.attributes['aria-pressed'], 'false');
  assert.equal(r.resizes(), 2);
});
test('rejected native fullscreen and unrelated fullscreenchange retain the usable fallback', async () => {
  const r = runtime({ reject: true });
  r.button.dispatch('click');
  await Promise.resolve();
  r.doc.dispatch('fullscreenchange');
  assert.equal(r.workspace.parentNode, r.body);
  assert.equal(r.workspace.classList.contains('is-fullscreen'), true);
  r.doc.dispatch('keydown', { key: 'Escape' });
  assert.equal(r.workspace.parentNode, r.main);
});
test('native fullscreen exit restores the workspace, resize keeps the chart responsive', () => {
  const r = runtime();
  r.button.dispatch('click');
  r.doc.fullscreenElement = r.workspace;
  r.doc.dispatch('fullscreenchange');
  r.root.dispatch('resize');
  assert.equal(r.resizes(), 2);
  r.doc.fullscreenElement = null;
  r.doc.dispatch('fullscreenchange');
  assert.equal(r.workspace.parentNode, r.main);
  assert.equal(r.workspace.classList.contains('is-fullscreen'), false);
});
test('Escape in an annotation editor does not discard the fullscreen workspace', () => {
  const r = runtime({ android: true });
  r.button.dispatch('click');
  r.chart.textEditor = {};
  r.doc.dispatch('keydown', { key: 'Escape' });
  assert.equal(r.workspace.parentNode, r.body);
});

test('fullscreen CSS stretches the replay column so the chart retains a height', () => {
  const css = readFileSync(new URL('../app/src/main/assets/apps/academy/trading-practice/assets/css/practice.css', import.meta.url), 'utf8');
  assert.match(css, /#replayWorkspace\.is-fullscreen \.practice-layout \{[^}]*align-items:stretch/);
  assert.match(css, /@media \(max-width:680px\)[\s\S]*\.replay-drawing-actions \{ flex-wrap:wrap; overflow:visible; \}/);
  assert.match(css, /\.replay-object-controls \{ position:absolute; left:6px; right:6px; width:auto; max-width:none; box-sizing:border-box; \}/);
});
