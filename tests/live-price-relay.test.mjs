import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import handler from '../api/live-price.js';

test('relay forwards fresh ordered quotes, drops stale/wrong-symbol quotes and hides credentials', async () => {
  const original = globalThis.WebSocket;
  const key = process.env.TWELVEDATA_API_KEY;
  const frames = [];
  let upstream;
  class FakeSocket extends EventTarget {
    static OPEN = 1;
    readyState = 1;
    constructor(url) { super(); upstream = this; assert.ok(url.includes('apikey=')); }
    send(data) { frames.push(JSON.parse(data)); }
    close() { this.readyState = 3; }
    message(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
  }
  const res = new EventEmitter();
  res.setHeader = () => {};
  const chunks = [];
  res.write = text => { chunks.push(text); return true; };
  res.end = () => { res.writableEnded = true; };
  try {
    globalThis.WebSocket = FakeSocket;
    process.env.TWELVEDATA_API_KEY = 'test-only-placeholder';
    const pending = handler({ method: 'GET' }, res);
    upstream.dispatchEvent(new Event('open'));
    const timestamp = Date.now();
    const quote = { event: 'price', symbol: 'XAU/USD', price: 4000, timestamp };
    upstream.message(quote);
    upstream.message({ ...quote, price: 3990, timestamp: timestamp - 1000 });
    upstream.message({ ...quote, timestamp: timestamp - 180000 });
    upstream.message({ ...quote, symbol: 'EUR/USD' });
    assert.equal(chunks.length, 1);
    assert.equal(JSON.parse(chunks[0].slice(6)).price, 4000);
    assert.doesNotMatch(chunks.join(''), /test-only-placeholder/);
    assert.equal(frames[0].params.symbols, 'XAU/USD');
    res.emit('close');
    await pending;
    assert.equal(upstream.readyState, 3);
  } finally {
    globalThis.WebSocket = original;
    if (key === undefined) delete process.env.TWELVEDATA_API_KEY;
    else process.env.TWELVEDATA_API_KEY = key;
  }
});
