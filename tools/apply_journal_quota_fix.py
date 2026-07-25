from pathlib import Path

path = Path('app/src/main/assets/apps/journal/app.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        'const DB_VERSION = 1;\nconst FILE_STORE = "files";',
        'const DB_VERSION = 2;\nconst FILE_STORE = "files";\nconst META_STORE = "metadata";\nconst ITEMS_META_RECORD = "items.v2";\nconst JOURNALS_META_RECORD = "journals.v2";'
    ),
    (
        '  state.items = normalizeItems(loadItems());\n  state.journals = normalizeJournals(loadJournals());',
        '  state.items = normalizeItems(await loadItems());\n  state.journals = normalizeJournals(await loadJournals());'
    ),
    (
        '''function loadItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems(items = state.items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(cleanItemForStorage)));
  invalidateRenderCache();
  refreshInsightCache();
}''',
        '''function parseLegacyArrayStorage(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadMetadataArray(recordId, legacyKey) {
  try {
    const record = await getMetadataRecord(recordId);
    if (Array.isArray(record?.value)) return record.value;
  } catch (error) {
    console.warn(`Metadata ${recordId} belum bisa dibaca dari IndexedDB.`, error);
  }

  const legacy = parseLegacyArrayStorage(legacyKey);
  if (!legacy.length) return legacy;

  try {
    await putMetadataRecord({ id: recordId, value: legacy, updatedAt: new Date().toISOString() });
    localStorage.removeItem(legacyKey);
  } catch (error) {
    console.warn(`Migrasi metadata ${recordId} ke IndexedDB belum berhasil.`, error);
  }
  return legacy;
}

async function saveMetadataArray(recordId, legacyKey, value, options = {}) {
  try {
    await putMetadataRecord({ id: recordId, value, updatedAt: new Date().toISOString() });
    try { localStorage.removeItem(legacyKey); } catch {}
    return true;
  } catch (error) {
    console.error(`Penyimpanan metadata ${recordId} gagal.`, error);
    if (options.throwOnError) throw error;
    window.showToast?.("Penyimpanan lokal penuh atau tidak tersedia.");
    return false;
  }
}

function loadItems() {
  return loadMetadataArray(ITEMS_META_RECORD, STORAGE_KEY);
}

async function saveItems(items = state.items, options = {}) {
  const cleaned = items.map(cleanItemForStorage);
  const saved = await saveMetadataArray(ITEMS_META_RECORD, STORAGE_KEY, cleaned, options);
  invalidateRenderCache();
  refreshInsightCache();
  return saved;
}'''
    ),
    (
        '''    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: "id" });
      }
    };''',
        '''    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "id" });
      }
    };'''
    ),
    (
        '''function putFileRecord(record) {
  return withFileStore("readwrite", (store) => store.put(record));
}''',
        '''function withMetadataStore(mode, action) {
  return openFileDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(META_STORE, mode);
    const store = transaction.objectStore(META_STORE);
    const request = action(store);
    let result;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

function putMetadataRecord(record) {
  return withMetadataStore("readwrite", (store) => store.put(record));
}

function getMetadataRecord(recordId) {
  return withMetadataStore("readonly", (store) => store.get(recordId));
}

function putFileRecord(record) {
  return withFileStore("readwrite", (store) => store.put(record));
}'''
    ),
    (
        '''function loadJournals() {
  try {
    const parsed = JSON.parse(localStorage.getItem(JOURNAL_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveJournals(journals = state.journals) {
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journals));
  refreshInsightCache();
}''',
        '''function loadJournals() {
  return loadMetadataArray(JOURNALS_META_RECORD, JOURNAL_STORAGE_KEY);
}

async function saveJournals(journals = state.journals, options = {}) {
  const saved = await saveMetadataArray(JOURNALS_META_RECORD, JOURNAL_STORAGE_KEY, journals, options);
  refreshInsightCache();
  return saved;
}'''
    ),
    (
        '''    saveItems();
    saveJournals();
    saveInsightCache();''',
        '''    await saveItems(state.items, { throwOnError: true });
    await saveJournals(state.journals, { throwOnError: true });
    saveInsightCache();'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Patch pattern count={count}: {old[:100]!r}')
    text = text.replace(old, new)

path.write_text(text, encoding='utf-8')

Path('tests/journal-metadata-storage-regression.test.mjs').write_text('''import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/src/main/assets/apps/journal/app.js", import.meta.url), "utf8");

test("library and journal metadata use IndexedDB instead of quota-limited localStorage", () => {
  assert.match(source, /const DB_VERSION = 2/);
  assert.match(source, /const META_STORE = "metadata"/);
  assert.match(source, /ITEMS_META_RECORD = "items\\.v2"/);
  assert.match(source, /JOURNALS_META_RECORD = "journals\\.v2"/);
  assert.match(source, /state\\.items = normalizeItems\\(await loadItems\\(\\)\\)/);
  assert.match(source, /state\\.journals = normalizeJournals\\(await loadJournals\\(\\)\\)/);
  assert.match(source, /putMetadataRecord\\(\\{ id: recordId, value/);
  assert.match(source, /localStorage\\.removeItem\\(legacyKey\\)/);
  assert.doesNotMatch(source, /localStorage\\.setItem\\(STORAGE_KEY/);
  assert.doesNotMatch(source, /localStorage\\.setItem\\(JOURNAL_STORAGE_KEY/);
});

test("restore waits for metadata persistence and surfaces failures", () => {
  assert.match(source, /await saveItems\\(state\\.items, \\{ throwOnError: true \\}\\)/);
  assert.match(source, /await saveJournals\\(state\\.journals, \\{ throwOnError: true \\}\\)/);
});
''', encoding='utf-8')
