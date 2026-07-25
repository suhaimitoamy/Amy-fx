import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/src/main/assets/apps/journal/app.js", import.meta.url), "utf8");

test("library and journal metadata use IndexedDB instead of quota-limited localStorage", () => {
  assert.match(source, /const DB_VERSION = 2/);
  assert.match(source, /const META_STORE = "metadata"/);
  assert.match(source, /ITEMS_META_RECORD = "items\.v2"/);
  assert.match(source, /JOURNALS_META_RECORD = "journals\.v2"/);
  assert.match(source, /state\.items = normalizeItems\(await loadItems\(\)\)/);
  assert.match(source, /state\.journals = normalizeJournals\(await loadJournals\(\)\)/);
  assert.match(source, /putMetadataRecord\(\{ id: recordId, value/);
  assert.match(source, /localStorage\.removeItem\(legacyKey\)/);
  assert.doesNotMatch(source, /localStorage\.setItem\(STORAGE_KEY/);
  assert.doesNotMatch(source, /localStorage\.setItem\(JOURNAL_STORAGE_KEY/);
});

test("restore waits for metadata persistence and surfaces failures", () => {
  assert.match(source, /await saveItems\(state\.items, \{ throwOnError: true \}\)/);
  assert.match(source, /await saveJournals\(state\.journals, \{ throwOnError: true \}\)/);
});
