import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const microLearningSource = readFileSync('app/src/main/assets/apps/academy/belajar/assets/micro-learning.js', 'utf8');
const readingHistorySource = readFileSync('app/src/main/assets/apps/academy/assets/js/reading-history-v2.js', 'utf8');

test('micro-learning.js records reading history on lesson load', () => {
  const localStorageStore = {};
  let recordedAndroid = null;

  const mockWindow = {
    location: {
      pathname: '/apps/academy/belajar/level-0/01-apa-itu-trading.html',
      href: 'http://localhost:8080/apps/academy/belajar/level-0/01-apa-itu-trading.html'
    },
    scrollY: 100,
    localStorage: {
      getItem: (k) => localStorageStore[k] || null,
      setItem: (k, v) => { localStorageStore[k] = String(v); }
    },
    Android: {
      recordLastStudiedLesson: (title, url, section) => {
        recordedAndroid = { title, url, section };
      }
    }
  };

  const listeners = {};
  const mockDocument = {
    querySelector: (sel) => {
      if (sel.includes('.ml-lesson-title-box h1') || sel === 'h1') {
        return { textContent: '01. Apa Itu Trading Sebenarnya?' };
      }
      if (sel.includes('.ml-back-link')) {
        return { textContent: 'Level 0: Fondasi Nol Mutlak' };
      }
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: (event, handler) => {
      listeners[event] = handler;
    }
  };

  const context = {
    window: mockWindow,
    location: mockWindow.location,
    document: mockDocument,
    localStorage: mockWindow.localStorage,
    console
  };

  vm.createContext(context);
  vm.runInContext(microLearningSource, context);

  // Trigger DOMContentLoaded
  assert.ok(listeners['DOMContentLoaded'], 'DOMContentLoaded handler registered');
  listeners['DOMContentLoaded']();

  assert.equal(localStorageStore['amy_last_opened_title'], '01. Apa Itu Trading Sebenarnya?');
  assert.equal(localStorageStore['amy_last_opened_url'], 'http://localhost:8080/apps/academy/belajar/level-0/01-apa-itu-trading.html');

  const lastRead = JSON.parse(localStorageStore['amy_academy_last_read_v2']);
  assert.equal(lastRead.title, '01. Apa Itu Trading Sebenarnya?');
  assert.equal(lastRead.path, 'belajar/level-0/01-apa-itu-trading.html');
  assert.equal(lastRead.section, 'Level 0: Fondasi Nol Mutlak');
  assert.equal(lastRead.namespace, 'micro-learning');

  assert.ok(recordedAndroid, 'Android native bridge called');
  assert.equal(recordedAndroid.title, '01. Apa Itu Trading Sebenarnya?');
});

test('reading-history-v2.js recognizes belajar/level-X as lesson pages', () => {
  assert.ok(readingHistorySource.includes('belajar'), 'reading-history-v2 must include belajar');
  assert.match(readingHistorySource, /micro-learning/, 'namespace for micro-learning must exist');
});
