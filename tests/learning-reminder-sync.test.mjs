import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('app/src/main/assets/apps/shared/amy-learning-reminder.js', 'utf8');

function createReminderContext(initialStorage = {}, androidMock = null) {
  const storage = new Map(Object.entries(initialStorage));
  const localStorageMock = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: key => storage.delete(key)
  };

  const context = {
    localStorage: localStorageMock,
    document: { readyState: 'complete', addEventListener: () => {} },
    window: {},
    console,
    Android: androidMock
  };
  context.global = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.AmyLearningReminder;
}

test('Item 1.77: native SharedPreferences overrides stale localStorage lesson when native has newer timestamp', () => {
  const staleData = JSON.stringify({
    title: 'Materi Lama 2025',
    path: 'modul-1/lesson-old.html',
    updatedAt: 1700000000000
  });

  const androidMock = {
    getLearningReminderConfig: () => JSON.stringify({
      enabled: true,
      time: '20:30',
      lastTitle: 'Materi Baru Terkini 2026',
      lastUrl: 'modul-9/lesson-fresh.html',
      lastTime: 1790000000000
    })
  };

  const reminder = createReminderContext({
    'amy_academy_last_read_v2': staleData
  }, androidMock);

  const config = reminder.getConfig();
  assert.equal(config.lastTitle, 'Materi Baru Terkini 2026', 'Must adopt newer native title');
  assert.equal(config.lastUrl, 'modul-9/lesson-fresh.html', 'Must adopt newer native url');
  assert.equal(config.time, '20:30');
  assert.equal(config.lastTime, 1790000000000);
});

test('Item 1.77: preserves localStorage when native timestamp is older', () => {
  const freshLocalData = JSON.stringify({
    title: 'Materi Fresh Local 2026',
    path: 'modul-10/fresh.html',
    updatedAt: 1795000000000
  });

  const androidMock = {
    getLearningReminderConfig: () => JSON.stringify({
      enabled: true,
      time: '20:00',
      lastTitle: 'Materi Lama Native',
      lastUrl: 'modul-1/old.html',
      lastTime: 1790000000000
    })
  };

  const reminder = createReminderContext({
    'amy_academy_last_read_v2': freshLocalData
  }, androidMock);

  const config = reminder.getConfig();
  assert.equal(config.lastTitle, 'Materi Fresh Local 2026', 'Must keep newer local title');
  assert.equal(config.lastUrl, 'modul-10/fresh.html');
});
