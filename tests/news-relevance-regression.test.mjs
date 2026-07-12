import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  NEWS_FILTER_VERSION,
  getNewsImpact,
  isRelevantNews,
  matchedNewsKeywords,
  normalizeNewsText
} from '../lib/news-relevance.mjs';

const relevantExamples = [
  'Iran and the United States resume peace negotiations after weeks of tension.',
  'Amerika Serikat dan Iran memulai perundingan damai baru.',
  'White House says a ceasefire agreement could be reached soon.',
  'Pentagon moves additional troops to the Middle East.',
  'Missile attack escalates conflict between Israel and Iran.',
  'Gencatan senjata dan perdamaian dibahas melalui mediasi internasional.',
  'Russia and Ukraine agree to diplomatic talks.',
  'China warns over Taiwan and the South China Sea.',
  'Oil prices jump after shipping disruption in the Strait of Hormuz.',
  'Federal Reserve signals rate cut as CPI inflation cools.',
  'Gold rises as investors seek safe haven assets.',
  'Government shutdown and debt ceiling risks pressure the U.S. dollar.'
];

for (const example of relevantExamples) {
  test(`relevant: ${example}`, () => {
    assert.equal(isRelevantNews(example), true);
    assert.ok(matchedNewsKeywords(example).length > 0);
  });
}

test('short keywords use word boundaries and do not match inside unrelated words', () => {
  assert.equal(isRelevantNews('The business outlook improves for software exporters.'), false);
  assert.equal(isRelevantNews('A museum opens a new exhibition this weekend.'), false);
  assert.equal(isRelevantNews('Forward guidance from a local retailer was unchanged.'), false);
});

test('generic diplomacy terms require geopolitical or conflict context', () => {
  assert.equal(isRelevantNews('The companies signed a commercial agreement.'), false);
  assert.equal(isRelevantNews('Iran signed a new agreement after negotiations.'), true);
});

test('abbreviations and punctuation are normalized', () => {
  assert.equal(normalizeNewsText('U.S. and Iran discuss XAU/USD'), 'us and iran discuss xauusd');
  assert.equal(isRelevantNews('U.S. officials meet Iranian delegates.'), true);
});

test('major conflict, diplomacy, and macro events are high impact', () => {
  assert.equal(getNewsImpact('Iran and America begin peace talks.'), 'high');
  assert.equal(getNewsImpact('Missile strike raises nuclear escalation risk.'), 'high');
  assert.equal(getNewsImpact('FOMC signals a possible rate cut.'), 'high');
  assert.equal(getNewsImpact('American officials issue a routine statement.'), 'medium');
});

test('filter version is explicit for deployment tracking', () => {
  assert.match(NEWS_FILTER_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/);
});

test('Vercel fallback and Supabase sync both use the shared filter', async () => {
  const apiSource = await readFile(new URL('../api/news.js', import.meta.url), 'utf8');
  const syncSource = await readFile(new URL('../supabase/functions/news-sync/handler.ts', import.meta.url), 'utf8');

  assert.match(apiSource, /from '\.\.\/lib\/news-relevance\.mjs'/);
  assert.match(apiSource, /isRelevantNews\(post\.text\)/);
  assert.match(syncSource, /from '\.\.\/\.\.\/\.\.\/lib\/news-relevance\.mjs'/);
  assert.match(syncSource, /isRelevantNews\(post\.text\)/);
  assert.match(syncSource, /getNewsImpact\(post\.text\)/);
});
