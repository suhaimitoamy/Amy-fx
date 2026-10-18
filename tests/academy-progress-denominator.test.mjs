import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const file = new URL('../app/src/main/assets/apps/academy/assets/js/main.js', import.meta.url);
const code = readFileSync(file, 'utf8');

function setupEnvironment({ cardCount = 10, readTopics = [] } = {}) {
  const store = new Map();
  store.set('amy_read_topics', JSON.stringify(readTopics));

  const pBar = { style: {} };
  const pText = { textContent: '' };
  const cards = [];

  for (let i = 1; i <= cardCount; i++) {
    const num = String(i).padStart(2, '0');
    const folder = `modul-${num}`;
    const link = {
      getAttribute: attr => attr === 'href' ? `../${folder}/index.html` : null
    };
    const card = {
      firstChild: null,
      querySelector: sel => sel === 'a' ? link : null,
      insertBefore(node) {
        this.firstChild = node;
      }
    };
    cards.push(card);
  }

  const context = {
    console,
    localStorage: {
      getItem: key => store.has(key) ? store.get(key) : null,
      setItem: (key, val) => store.set(key, String(val))
    },
    document: {
      readyState: 'complete',
      documentElement: { style: { setProperty: () => {} } },
      body: { classList: { contains: () => false, add: () => {}, remove: () => {} } },
      addEventListener: () => {},
      querySelector: () => null,
      getElementById(id) {
        if (id === 'academyProgressBar') return pBar;
        if (id === 'academyProgressText') return pText;
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '.course-card') return cards;
        return [];
      },
      createElement(tag) {
        return {
          tag, className: '', dataset: {}, style: {},
          classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
          append() {}, appendChild() {}, remove() {}, click() {}, setAttribute() {},
          insertBefore() {}, addEventListener() {}, querySelector() { return { textContent: '' }; },
          querySelectorAll() { return []; }, options: [], value: '', textContent: ''
        };
      },
      head: { appendChild: () => {} },
      body: { classList: { contains: () => false, add: () => {}, remove: () => {} }, appendChild: () => {} }
    },
    window: {
      addEventListener: () => {}
    },
    setInterval: () => {},
    setTimeout: () => {}
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(code, context);

  return {
    updateProgress: context.window.updateCourseProgress,
    trackProgress: context.window.trackReadingProgress,
    context,
    store,
    pBar,
    pText,
    cards
  };
}

test('updateCourseProgress scales to 100% when 10 out of 10 modules are completed', () => {
  const all10 = Array.from({ length: 10 }, (_, i) => `modul-${String(i + 1).padStart(2, '0')}`);
  const env = setupEnvironment({ cardCount: 10, readTopics: all10 });

  env.updateProgress();

  assert.equal(env.pBar.style.width, '100%');
  assert.equal(env.pText.textContent, 'Menyelesaikan 10 dari 10 Modul (100%)');
});

test('updateCourseProgress correctly reports partial progress with dynamic denominator', () => {
  const read5 = ['modul-01', 'modul-02', 'modul-03', 'modul-04', 'modul-05'];
  const env = setupEnvironment({ cardCount: 10, readTopics: read5 });

  env.updateProgress();

  assert.equal(env.pBar.style.width, '50%');
  assert.equal(env.pText.textContent, 'Menyelesaikan 5 dari 10 Modul (50%)');
});

test('updateCourseProgress attaches badges for modul-xx paths', () => {
  const env = setupEnvironment({ cardCount: 2, readTopics: ['modul-01'] });

  env.updateProgress();

  assert.ok(env.cards[0].firstChild, 'Badge should be attached to card 1');
  assert.equal(env.cards[0].firstChild.textContent, '✓ Selesai dibaca');

  assert.ok(env.cards[1].firstChild, 'Badge should be attached to card 2');
  assert.equal(env.cards[1].firstChild.textContent, 'Belum mulai');
});

test('trackReadingProgress records both modul-xx and bagian-xx folders and notifies Android bridge', () => {
  const env = setupEnvironment({ cardCount: 10, readTopics: [] });
  const recorded = [];
  env.context.window.Android = {
    recordLastStudiedLesson: (title, url, folder) => recorded.push({ title, url, folder })
  };

  // Mock reading modul-01 article
  const h1 = { textContent: 'Konsep Dasar Candlestick' };
  const article = {
    querySelector: sel => {
      if (sel === '.chapter-list') return null;
      if (sel === 'h1') return h1;
      return null;
    }
  };
  env.context.document.querySelector = sel => {
    if (sel.includes('.article')) return article;
    return null;
  };
  env.context.window.location = { href: 'https://appassets.androidplatform.net/assets/apps/academy/modul-01/bab-01.html' };

  env.trackProgress();

  let readSet = JSON.parse(env.store.get('amy_read_topics') || '[]');
  assert.ok(readSet.includes('modul-01'), 'modul-01 should be recorded');
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].folder, 'modul-01');
  assert.equal(recorded[0].title, 'Konsep Dasar Candlestick');

  // Mock reading bagian-02 article
  h1.textContent = 'Struktur Pasar ICT';
  env.context.window.location = { href: 'https://appassets.androidplatform.net/assets/apps/academy/bagian-02/bab-01.html' };

  env.trackProgress();

  readSet = JSON.parse(env.store.get('amy_read_topics') || '[]');
  assert.ok(readSet.includes('bagian-02'), 'bagian-02 should be recorded');
  assert.equal(recorded.length, 2);
  assert.equal(recorded[1].folder, 'bagian-02');
});
