// Server-owned Twelve Data subscription. Clients receive only validated ticks.
// Native Node 22 WebSocket avoids dependencies and never exposes the API key.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();
  const key = process.env.TWELVEDATA_API_KEY?.trim();
  if (!key || typeof WebSocket !== 'function') {
    return res.status(503).json({ status: 'error', message: 'Sumber harga server belum dikonfigurasi.' });
  }
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.flushHeaders?.();
  await new Promise(resolve => {
    let ended = false;
    let lastTimestamp = 0;
    const upstream = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(key)}`);
    const send = payload => {
      if (!ended && !res.destroyed && !res.writableEnded) {
        if (!res.write(`data: ${JSON.stringify(payload)}\n\n`)) finish();
      }
    };
    const finish = () => {
      if (ended) return;
      ended = true;
      clearInterval(heartbeat);
      clearTimeout(lifetime);
      res.off('close', finish);
      upstream.close();
      if (!res.writableEnded) res.end();
      resolve();
    };
    const heartbeat = setInterval(() => {
      if (!ended) res.write(': heartbeat\n\n');
      if (upstream.readyState === WebSocket.OPEN) upstream.send(JSON.stringify({ action: 'heartbeat' }));
    }, 10000);
    // Reconnect before the configured function deadline; never invent a quote.
    const lifetime = setTimeout(finish, 50000);
    res.on('close', finish);
    upstream.addEventListener('open', () => {
      if (ended) return;
      upstream.send(JSON.stringify({ action: 'subscribe', params: { symbols: 'XAU/USD' } }));
    });
    upstream.addEventListener('message', event => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.event === 'subscribe-status' && data.status === 'error') {
        send({ event: 'status', status: 'ERROR', message: 'Langganan harga server ditolak provider.' });
        finish();
        return;
      }
      if (data.event !== 'price' || String(data.symbol).replace('/', '') !== 'XAUUSD') return;
      const price = Number(data.price);
      const raw = Number(data.timestamp);
      const timestamp = raw > 100000000000 ? raw : raw * 1000;
      const age = Date.now() - timestamp;
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp)
          || timestamp <= 0 || timestamp < lastTimestamp || age > 45000 || age < -60000) return;
      lastTimestamp = timestamp;
      send({ event: 'price', source: 'TWELVE_DATA_WEBSOCKET', symbol: 'XAU/USD', price, timestamp });
    });
    upstream.addEventListener('error', () => {
      send({ event: 'status', status: 'ERROR', message: 'Sumber harga server tidak tersedia.' });
      finish();
    });
    upstream.addEventListener('close', finish);
  });
}
