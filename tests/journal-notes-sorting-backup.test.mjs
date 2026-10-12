import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../app/src/main/assets/apps/journal/app.js', import.meta.url),
  'utf8'
);

test('notes sorting puts past dates at the bottom and newest dates at the top', () => {
  // Extract sortNotes from source or test logic
  const sortNotesMatch = source.match(/function sortNotes\(notes\) \{([\s\S]*?)\n\}/);
  assert.ok(sortNotesMatch, 'sortNotes function must exist in app.js');

  const sortNotes = new Function('notes', sortNotesMatch[0] + '\nreturn sortNotes(notes);');

  const sampleNotes = [
    { id: '1', date: '2026-01-12', title: 'Hari 1' },
    { id: '2', date: '2026-10-07', title: 'Hari Ini' },
    { id: '3', date: '2026-02-02', title: 'Hari 16' },
    { id: '4', date: '2026-09-25', title: 'Evaluasi Toxic Win' }
  ];

  const sorted = sortNotes(sampleNotes);

  // Newest at top, past dates at bottom
  assert.equal(sorted[0].date, '2026-10-07');
  assert.equal(sorted[1].date, '2026-09-25');
  assert.equal(sorted[2].date, '2026-02-02');
  assert.equal(sorted[3].date, '2026-01-12');
});

test('exportBackup includes personalNotes in data.json', () => {
  assert.match(
    source,
    /zip\.file\("data\.json",\s*JSON\.stringify\(\{\s*version:\s*BACKUP_VERSION,\s*exportedAt:\s*new Date\(\)\.toISOString\(\),\s*items:\s*state\.items,\s*journals:\s*state\.journals,\s*notes:\s*state\.personalNotes/
  );
});

test('importBackup restores notes from payload and triggers sort', () => {
  assert.match(source, /if \(Array\.isArray\(payload\.notes \|\| payload\.personalNotes\)\)/);
  assert.match(source, /state\.personalNotes = sortNotes\(\[\.\.\.existingNotesById\.values\(\)\]\)/);
});

test('handleNoteActions handles toggle-collapse-btn before dataset.id check', () => {
  const handlerMatch = source.match(/function handleNoteActions\(e\) \{([\s\S]*?)\n\}/);
  assert.ok(handlerMatch, 'handleNoteActions function must exist');
  const code = handlerMatch[1];
  const toggleIndex = code.indexOf('toggle-collapse-btn');
  const idCheckIndex = code.indexOf('const id = btn.dataset.id;');
  assert.ok(toggleIndex !== -1, 'toggle-collapse-btn must be handled');
  assert.ok(toggleIndex < idCheckIndex, 'toggle-collapse-btn must be handled before id check');
});

test('openNoteForm handles edit mode and scrolls into view', () => {
  assert.match(source, /dom\.noteForm\.scrollIntoView/);
  assert.match(source, /submitBtn\.textContent = "Perbarui Catatan"/);
});

