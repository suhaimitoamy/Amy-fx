import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Item 2.22: Pre-Trade Confluence Checklist 4-Poin HTML Verification', () => {
  const html = fs.readFileSync('app/src/main/assets/apps/mapping/index.html', 'utf8');
  assert.match(html, /id="plan-pretrade-checklist-box"/, 'Must contain pre-trade checklist container');
  assert.match(html, /id="chk-pretrade-session"/, 'Must contain session checkbox');
  assert.match(html, /id="chk-pretrade-zone"/, 'Must contain zone OTE checkbox');
  assert.match(html, /id="chk-pretrade-liquidity"/, 'Must contain liquidity sweep rejection checkbox');
  assert.match(html, /id="chk-pretrade-rr"/, 'Must contain RR >= 2.0 checkbox');
  assert.match(html, /id="btn-take-trade"/, 'Must contain safe execution button');
});

test('Item 2.22: ict-presentation.js evaluates 4-point checklist and enforces >= 3/4 execution gate', () => {
  const code = fs.readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/ict-presentation.js', 'utf8');
  assert.match(code, /chkSession=document\.getElementById\('chk-pretrade-session'\)/, 'Queries session checkbox');
  assert.match(code, /cRR=Number\(plan\?\.rr2\|\|plan\?\.rr\|\|plan\?\.rr1\|\|0\)>=2\.0/, 'Checks RR >= 2.0');
  assert.match(code, /currentScore>=3/, 'Requires at least 3 of 4 criteria to unlock execution');
  assert.match(code, /btnTakeTrade\.disabled=false/, 'Unlocks button when safe');
  assert.match(code, /btnTakeTrade\.style\.background='linear-gradient/, 'Applies luminous green styling on safe status');
  assert.match(code, /localStorage\.setItem\('amy_pretrade_selected_setup'/, 'Persists pretrade setup on take trade action');
});
