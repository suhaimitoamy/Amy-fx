import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBaseUrl } from '../api/calendar.js';

test('Item 1.12: resolveBaseUrl dynamically resolves localhost and private IPs to http', () => {
  const reqLocal = { headers: { host: 'localhost:8080' } };
  assert.equal(resolveBaseUrl(reqLocal), 'http://localhost:8080');

  const reqLoopback = { headers: { host: '127.0.0.1:3000' } };
  assert.equal(resolveBaseUrl(reqLoopback), 'http://127.0.0.1:3000');

  const reqLan = { headers: { host: '192.168.1.100:8080' } };
  assert.equal(resolveBaseUrl(reqLan), 'http://192.168.1.100:8080');
});

test('Item 1.12: resolveBaseUrl dynamically resolves cloud domains to https', () => {
  const reqProd = { headers: { host: 'amy-fx.vercel.app' } };
  assert.equal(resolveBaseUrl(reqProd), 'https://amy-fx.vercel.app');

  const reqPreview = { headers: { host: 'amy-fx-preview-branch.vercel.app' } };
  assert.equal(resolveBaseUrl(reqPreview), 'https://amy-fx-preview-branch.vercel.app');
});

test('Item 1.12: resolveBaseUrl respects x-forwarded-proto header if present', () => {
  const reqProxy = {
    headers: {
      host: 'custom-proxy.internal',
      'x-forwarded-proto': 'https'
    }
  };
  assert.equal(resolveBaseUrl(reqProxy), 'https://custom-proxy.internal');
});
