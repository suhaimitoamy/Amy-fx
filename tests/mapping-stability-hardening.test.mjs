import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('Mapping refresh remains stable and Scalper owns one persistent shell', async () => {
  const ui = await read('app/src/main/assets/apps/mapping/js/ui/ui-render.js');
  const dom = await read('app/src/main/assets/apps/mapping/js/ui/dom-stable-render.js');
  const scalper = await read('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');

  assert.match(ui, /export function mappingRenderSignature/);
  assert.match(ui, /signature===lastRenderSignature/);
  assert.match(dom, /patchSameViewApp\(this, parseFragment\(markup\)\)/);
  assert.doesNotMatch(dom, /window\.scrollTo|window\.scrollBy/);
  assert.match(scalper, /if\s*\(\s*started\s*\)\s*return/);
  assert.equal((scalper.match(/setInterval\s*\(\s*sync\s*,\s*30_000\s*\)/g) || []).length, 1);
  assert.equal((scalper.match(/addEventListener\s*\(\s*'hashchange'\s*,\s*focusHash\s*\)/g) || []).length, 1);
  assert.match(scalper, /data-scalper-select-id/);
  assert.match(scalper, /Kembali ke setup utama/);
  assert.doesNotMatch(scalper, /MutationObserver|outerHTML/);
});

test('Scalper refresh preserves valid data and rejects stale overlapping requests', async () => {
  const scalper = await read('app/src/main/assets/apps/mapping/js/scalper-entry-watch-v1.js');
  const shadow = await read('app/src/main/assets/apps/mapping/js/scalper-shadow-state.js');
  assert.match(scalper, /lastValidPayload\s*=\s*reconcileScalperPayload/);
  assert.match(scalper, /requestController\?\.abort\(\)/);
  assert.match(scalper, /sequence\s*!==\s*requestSequence/);
  assert.match(scalper, /AmyFXDomStableRender\?\.patch/);
  assert.match(shadow, /SCALPER_TERMINAL_STATUSES/);
  assert.match(shadow, /scalperPayloadSignature/);
});

test('Pattern v3 persists entry before lifecycle and keeps optimistic writes', async () => {
  const engine = await read('supabase/functions/scalper-engine/index.ts');
  const signals = await read('supabase/functions/scalper-engine/signals.mjs');
  const drivers = await read('supabase/functions/scalper-engine/drivers.mjs');
  const patterns = await read('supabase/functions/scalper-engine/pattern-gates.mjs');
  const lifecycle = await read('supabase/functions/scalper-engine/lifecycle.mjs');
  const api = await read('supabase/functions/scalper-setups/index.ts');

  assert.match(engine, /activateCandidate\(setup,\s*nextOpen\)/);
  assert.match(engine, /revision:\s*`eq\.\$\{expectedRevision\}`/);
  assert.match(engine, /updated_at:\s*`eq\.\$\{expected\.updated_at\}`/);
  assert.match(engine, /status:\s*`eq\.\$\{expected\.status\}`/);
  assert.match(engine, /candle_source: "supabase-central-read-only"/);
  assert.match(engine, /provider_requests: 0/);
  assert.doesNotMatch(engine, /refreshMarketData|functions\/v1\/market-candles/);
  assert.match(signals, /detectMultiDriverCandidates/);
  assert.match(drivers, /buffer_atr:0\.18/);
  assert.match(patterns, /normal_buffer_atr:\s*0\.18/);
  assert.match(patterns, /high_volatility_buffer_atr:\s*0\.20/);
  assert.match(patterns, /AMD-2025-V1/);
  assert.match(lifecycle, /setup\.quality\.entry_locked\s*!==\s*true/);
  assert.match(lifecycle, /\.filter\(c=>c\.open_time>=entryOpenTime\)/);
  assert.match(api, /CURRENT_ENGINE_VERSION = "amyfx-preview-scalper-pattern-v3\.0"/);
  assert.match(api, /sourceCandleTimestamp/);
  assert.match(api, /patternGate/);
});
