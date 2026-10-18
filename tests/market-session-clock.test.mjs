import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executionSessionAllowed,
  executionSessionRequirement,
  executionSessionState,
  sessionCountdownPill,
  updateCockpitSessionPill
} from '../app/src/main/assets/apps/mapping/js/engine/market-session-clock.js';

test('London gate follows BST and GMT while shifting WITA automatically', () => {
  const summer = Date.parse('2026-07-01T06:30:00Z');
  const winter = Date.parse('2026-01-15T07:30:00Z');
  assert.equal(executionSessionAllowed(summer, 'LONDON_OR_NEW_YORK'), true);
  assert.equal(executionSessionAllowed(winter, 'LONDON_OR_NEW_YORK'), true);
  const summerText = executionSessionRequirement('LONDON_ONLY', summer);
  const winterText = executionSessionRequirement('LONDON_ONLY', winter);
  assert.match(summerText, /14:00–18:00 WITA \(BST\)/);
  assert.match(winterText, /15:00–19:00 WITA \(GMT\)/);
});

test('New York gate follows EDT and EST while shifting WITA automatically', () => {
  const summer = Date.parse('2026-08-05T11:30:00Z');
  const winter = Date.parse('2026-01-15T12:30:00Z');
  assert.equal(executionSessionAllowed(summer, 'NEW_YORK_ONLY'), true);
  assert.equal(executionSessionAllowed(winter, 'NEW_YORK_ONLY'), true);
  const summerState = executionSessionState(summer, 'NEW_YORK_ONLY');
  const winterState = executionSessionState(winter, 'NEW_YORK_ONLY');
  assert.equal(summerState.newYork.season, 'EDT');
  assert.equal(winterState.newYork.season, 'EST');
  assert.match(executionSessionRequirement('NEW_YORK_ONLY', summer), /19:30–04:00 WITA \(EDT\)/);
  assert.match(executionSessionRequirement('NEW_YORK_ONLY', winter), /20:30–05:00 WITA \(EST\)/);
});

test('off-session timestamp remains rejected and NONE remains allowed', () => {
  const timestamp = Date.parse('2026-08-05T05:00:00Z');
  assert.equal(executionSessionAllowed(timestamp, 'NEW_YORK_ONLY'), false);
  assert.equal(executionSessionAllowed(timestamp, 'LONDON_OR_NEW_YORK'), false);
  assert.equal(executionSessionAllowed(timestamp, 'NONE'), true);
});

test('Item 2.33: sessionCountdownPill computes dynamic active and countdown pills with DST awareness', () => {
  // 1. Summer London active (e.g. 08:00 UTC = 09:00 BST = 16:00 WITA)
  const londonActive = Date.parse('2026-07-01T08:00:00Z');
  const pill1 = sessionCountdownPill(londonActive);
  assert.equal(pill1.status, 'ACTIVE');
  assert.equal(pill1.activeSession, 'LONDON');
  assert.match(pill1.text, /🇬🇧 London Killzone Aktif \(Sisa 2j 0m\)/);

  // 2. Countdown to New York Open (e.g. 11:00 UTC = 19:00 WITA, NY open is 11:30 UTC / 19:30 WITA)
  const preNY = Date.parse('2026-07-01T11:00:00Z');
  const pill2 = sessionCountdownPill(preNY);
  assert.equal(pill2.status, 'UPCOMING');
  assert.equal(pill2.nextSession, 'NEW_YORK');
  assert.match(pill2.text, /🇺🇸 Menuju NY Open dalam 30m \(19:30 WITA\)/);

  // 3. Summer New York active (e.g. 13:00 UTC = 09:00 EDT = 21:00 WITA)
  const nyActive = Date.parse('2026-07-01T13:00:00Z');
  const pill3 = sessionCountdownPill(nyActive);
  assert.equal(pill3.status, 'ACTIVE');
  assert.equal(pill3.activeSession, 'NEW_YORK');
  assert.match(pill3.text, /🇺🇸 New York Sesi Aktif/);

  // 4. Test updateCockpitSessionPill on a mock DOM element
  const mockElement = { textContent: '', className: '', style: {} };
  const updated = updateCockpitSessionPill(mockElement, londonActive);
  assert.ok(updated);
  assert.match(mockElement.textContent, /London Killzone Aktif/);
  assert.equal(mockElement.className, 'cockpit-session-pill session-active');
  assert.equal(mockElement.style.color, '#22C55E');
});

