import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Item 2.24: Visual Rejection Candle Body Filter HTML and CSS Verification', () => {
  const html = fs.readFileSync('app/src/main/assets/apps/mapping/index.html', 'utf8');
  assert.match(
    html,
    /<span id="plan-rejection-pill"[^>]*>⚖️ Menunggu Rejection Close<\/span>/,
    'mapping index.html must have plan-rejection-pill in Assistant V3 card'
  );

  const css = fs.readFileSync('app/src/main/assets/apps/mapping/css/ict-workspace.css', 'utf8');
  assert.match(
    css,
    /\.pill-warning\s*\{/,
    'ict-workspace.css must define .pill-warning style'
  );
  assert.match(
    css,
    /#f59e0b/,
    'pill-warning must use amber warning color'
  );
});

test('Item 2.24: ict-presentation.js updates plan-rejection-pill for unconfirmed vs reclaimed sweeps', () => {
  const code = fs.readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/ict-presentation.js', 'utf8');
  assert.match(
    code,
    /const rejectionEl=document\.getElementById\('plan-rejection-pill'\)/,
    'ict-presentation.js must query plan-rejection-pill'
  );
  assert.match(
    code,
    /rejectionEl\.textContent='🎯 Reclaimed Valid'/,
    'ict-presentation.js must show Reclaimed Valid for confirmed rejection'
  );
  assert.match(
    code,
    /rejectionEl\.textContent='⚖️ Menunggu Rejection Close'/,
    'ict-presentation.js must show Menunggu Rejection Close for unconfirmed sweep'
  );
});

test('Item 2.24: ict-canvas.js renders dynamic dashed sweep line on chart', () => {
  const canvasCode = fs.readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/ict-canvas.js', 'utf8');
  assert.match(
    canvasCode,
    /ctx\.setLineDash\(\[5,\s*3\]\)/,
    'ict-canvas.js must use dashed line for swept liquidity level'
  );
  assert.match(
    canvasCode,
    /🎯 Reclaimed Valid/,
    'ict-canvas.js must support reclaimed valid label on sweep line'
  );
  assert.match(
    canvasCode,
    /⚖️ Menunggu Rejection Close/,
    'ict-canvas.js must support awaiting rejection close label on sweep line'
  );
});
