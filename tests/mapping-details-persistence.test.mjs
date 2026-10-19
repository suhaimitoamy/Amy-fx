import test from 'node:test';
import assert from 'node:assert/strict';

// Mock sessionStorage & localStorage
const sessionStore = new Map();
globalThis.sessionStorage = {
  getItem: key => sessionStore.get(key) || null,
  setItem: (key, val) => sessionStore.set(key, String(val)),
  removeItem: key => sessionStore.delete(key),
  clear: () => sessionStore.clear()
};
globalThis.localStorage = globalThis.sessionStorage;

const createDummyElement = () => ({
  textContent: '',
  innerHTML: '',
  style: {},
  dataset: {},
  classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} },
  querySelector: () => createDummyElement(),
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  setAttribute: () => {},
  getAttribute: () => null
});

globalThis.document = {
  hidden: false,
  body: createDummyElement(),
  documentElement: { dataset: {} },
  querySelector: () => createDummyElement(),
  querySelectorAll: () => [],
  getElementById: () => createDummyElement(),
  createElement: () => createDummyElement(),
  createComment: () => ({}),
  addEventListener: () => {},
  removeEventListener: () => {}
};

globalThis.window = {
  location: { href: 'http://localhost/', search: '', hash: '' },
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.location = globalThis.window.location;

// Create a mock DOM document for testing persistence
function createMockDoc() {
  const listeners = {};
  const doc = {
    addEventListener: (event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    },
    dispatch: (event, target) => {
      for (const fn of (listeners[event] || [])) {
        fn({ target });
      }
    },
    elements: [],
    querySelectorAll: (selector) => {
      if (selector === 'details') {
        return doc.elements;
      }
      return [];
    }
  };
  return doc;
}

test('initDetailsPersistence tracks open/close in sessionStorage and restores open attribute (Item 1.16)', async () => {
  sessionStore.clear();
  const mockDoc = createMockDoc();

  const { initDetailsPersistence } = await import('../app/src/main/assets/apps/mapping/js/ict-workspace/details-persistence.js');
  const persistence = initDetailsPersistence(mockDoc);
  assert.ok(persistence);

  const detail1 = {
    tagName: 'DETAILS',
    id: 'detail-bias',
    open: true,
    querySelector: () => ({ textContent: 'Bias & Struktur' })
  };

  // 1. Simulate opening detail1
  mockDoc.dispatch('toggle', detail1);
  const stored = JSON.parse(sessionStorage.getItem('amy_mapping_open_details'));
  assert.ok(stored.includes('detail-bias'), 'Opened detail ID must be saved to sessionStorage');

  // 2. Simulate re-render where fresh detail element is created with open = false
  const freshDetail1 = {
    tagName: 'DETAILS',
    id: 'detail-bias',
    open: false,
    querySelector: () => ({ textContent: 'Bias & Struktur' })
  };
  mockDoc.elements = [freshDetail1];

  // Restore
  persistence.restoreOpenDetails(mockDoc);
  assert.equal(freshDetail1.open, true, 'restoreOpenDetails must restore open = true from sessionStorage');

  // 3. Simulate user closing detail1
  freshDetail1.open = false;
  mockDoc.dispatch('toggle', freshDetail1);
  const updatedStored = JSON.parse(sessionStorage.getItem('amy_mapping_open_details'));
  assert.equal(updatedStored.includes('detail-bias'), false, 'Closed detail ID must be removed from sessionStorage');
});
