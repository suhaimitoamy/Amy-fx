import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/fractal-audit.js';

test('Fractal Audit: api/fractal-audit.js serverless endpoint returns complete compliant audit payload (Item 1.38)', async () => {
  const req = {
    method: 'GET',
    query: {
      bias: 'BUY',
      sweep: 'true',
      ote: 'true'
    }
  };

  let statusCode = null;
  let headers = {};
  let jsonResult = null;

  const res = {
    setHeader(k, v) {
      headers[k] = v;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      jsonResult = payload;
      return this;
    }
  };

  await handler(req, res);

  assert.equal(statusCode, 200);
  assert.equal(headers['Access-Control-Allow-Origin'], '*');
  assert.ok(jsonResult, 'Must return JSON payload');
  assert.equal(jsonResult.ok, true);
  assert.equal(jsonResult.engine, 'VERCEL_EMBEDDED_ZERO_PYTHON');

  // Verify candle_info
  assert.ok(jsonResult.candle_info);
  assert.equal(typeof jsonResult.candle_info.close, 'number');

  // Verify decision
  assert.ok(jsonResult.decision);
  assert.ok(['APPROVED', 'CONDITIONAL_APPROVAL', 'REJECTED'].includes(jsonResult.decision.verdict));
  assert.ok(['BUY', 'SELL', 'WAIT_AND_SEE', 'EXTREME_SCALP_BUY', 'EXTREME_SCALP_SELL'].includes(jsonResult.decision.action));
  assert.ok(jsonResult.decision.recommended_levels);
  assert.ok(jsonResult.decision.scalper_plan);

  // Verify fractal matches
  assert.ok(jsonResult.fractal);
  assert.ok(Array.isArray(jsonResult.fractal.matches_sample));
  assert.ok(jsonResult.fractal.matches_sample.length > 0);
  assert.ok(Array.isArray(jsonResult.recent_candles));
});

test('Fractal Audit: fractal-advisor/index.html defines generateClientFallbackAudit and dynamic URL (Item 1.38)', () => {
  const html = fs.readFileSync('app/src/main/assets/apps/fractal-advisor/index.html', 'utf8');

  assert.match(html, /function generateClientFallbackAudit/, 'Must define generateClientFallbackAudit');
  assert.match(html, /https:\/\/amy-fx\.vercel\.app/, 'Must resolve endpoint to Vercel production base');
  assert.match(html, /Engine Offline \(K-NN Client\)/, 'Must display friendly green offline pill instead of Server Offline crash');
});
