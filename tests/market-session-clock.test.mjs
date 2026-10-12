import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executionSessionAllowed,
  executionSessionRequirement,
  executionSessionState
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
