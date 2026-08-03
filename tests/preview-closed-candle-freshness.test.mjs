import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runtimePath = 'app/src/main/assets/apps/mapping/js/mapping-runtime-repair-v3.js';
const runtime = readFileSync(`${root}/${runtimePath}`, 'utf8');

test('Preview freshness is primed from the latest actually closed candle', () => {
  const syntax = spawnSync(process.execPath, ['--check', `${root}/${runtimePath}`], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

  assert.match(runtime, /setCandleFetchedAt/);
  assert.match(runtime, /expectedClosedCandleOpen/);
  assert.match(runtime, /cachedSeriesIsCurrent/);
  assert.match(runtime, /primeCurrentCandleFreshness/);
  assert.match(runtime, /CLOSE_GRACE_MS = 10_000/);
  assert.match(runtime, /fridayClosed/);
  assert.match(runtime, /saturday/);
  assert.match(runtime, /sundayClosed/);
  assert.match(runtime, /version: '4\.0\.0'/);
});

test('Preview avoids REST refresh while selected closed candle cache is current', () => {
  assert.match(runtime, /selectedNeedsRefresh = !selectedHasData \|\| sourceStatus\[selectedTf\] === false/);
  assert.match(runtime, /!force && !selectedNeedsRefresh/);
  assert.match(runtime, /await runAnalysis\(state\.tf\)/);
});
