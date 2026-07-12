import { state, TF, log, save } from '../main.js';
import { analyze, tfGroup } from '../engine/ict-core.js';
import { render, renderSoft, renderAnalyzeLive } from '../ui/ui-render.js';
import { sendTargetsToNative } from '../bridge/android-bridge.js';

export let liveTimer = null;
export let scanTimer = null;
export let lastWsTickAt = Number(localStorage.getItem('last_ws_tick_at') || 0);

const PROXY_URL = 'https://amy-fx.vercel.app/api/twelvedata';
let candleFetchedAt = {};
let pollInFlight = false;
let lastErrorLogAt = 0;

export function isCandleStale(tf) {
  const age = (Date.now() - (candleFetchedAt[tf] || 0)) / 1000 / 60;
  if (tf === 'M1') return age >= 1;
  if (tf === 'M5') return age >= 3;
  if (tf === 'M15') return age >= 5;
  if (tf === 'M30') return age >= 10;
  if (tf === 'H1') return age >= 15;
  if (tf === 'H4') return age >= 30;
  return age >= 120;
}

export async function fetchTf(tf) {
  const params = new URLSearchParams({
    symbol: 'XAU/USD',
    interval: TF[tf],
    outputsize: '300'
  });
  const response = await fetch(`${PROXY_URL}?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Market HTTP ${response.status}`);
  const data = await response.json();
  if (data.status === 'error') throw new Error(data.message || 'Fetch gagal');

  const raw = (data.values || []).reverse();
  const candles = raw
    .map((c, index) => ({
      time: new Date(c.datetime).getTime() / 1000,
      timeframe: tf,
      open: +c.open,
      high: +c.high,
      low: +c.low,
      close: +c.close,
      tickCount: 1,
      isClosed: index < raw.length - 1
    }))
    .filter(c => c.isClosed && Number.isFinite(c.close));

  if (!candles.length) throw new Error(`Candle ${tf} kosong`);
  state.candles[tf] = candles;
  candleFetchedAt[tf] = Date.now();
  return candles;
}

export async function runAnalysis(tf = state.tf) {
  if (scanTimer) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }

  state.tf = tf;
  render();

  try {
    log(`Memindai ${tf}...`);
    const group = tfGroup(tf);
    const scanGroup = [...new Set([...group, 'M1', 'M5', 'M15', 'M30', 'H1', 'H4'])];

    await Promise.all(scanGroup.map(async currentTf => {
      if (!state.candles[currentTf]?.length || isCandleStale(currentTf)) {
        try {
          await fetchTf(currentTf);
        } catch (error) {
          log(`Candle ${currentTf} belum diperbarui, memakai cache.`);
        }
      }
      return state.candles[currentTf] || [];
    }));

    const htfBiases = {};
    for (const currentTf of group.filter(item => item !== tf)) {
      const candles = state.candles[currentTf];
      if (candles?.length > 30) {
        const result = analyze(candles, currentTf, {}, state.price);
        htfBiases[currentTf] = result?.st?.trend || 'NEUTRAL';
      }
    }

    const htfContext = {
      H4: state.candles.H4,
      D1: state.candles.D1,
      W1: state.candles.W1
    };
    const result = analyze(state.candles[tf], tf, htfBiases, state.price, htfContext);
    if (!result?.st) throw new Error('Hasil analisis tidak valid');

    state.result = result;
    state.setups = [...(result.setups || []), ...state.setups].slice(0, 50);
    state.analyses = [{ id: Date.now(), ...result }, ...state.analyses].slice(0, 80);
    save();
    log(`${tf} selesai: ${result.signal} score ${result.score}/100`);
    sendTargetsToNative();
  } catch (error) {
    log(`Error ${tf}: ${error.message}`);
  }

  render();
}

async function pollLivePrice() {
  if (pollInFlight) return;
  pollInFlight = true;

  try {
    const response = await fetch(
      `${PROXY_URL}?symbol=XAU/USD&interval=1min&outputsize=1&_=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const price = +(data.values?.[0]?.close || 0);
    if (data.status !== 'ok' || !Number.isFinite(price) || price <= 0) {
      throw new Error(data.message || 'Harga live tidak valid');
    }

    lastWsTickAt = Date.now();
    localStorage.setItem('last_ws_tick_at', String(lastWsTickAt));
    localStorage.setItem('last_price', String(price));
    state.price = price;
    state.conn = 'Connected';
    renderAnalyzeLive();
    renderSoft();

    if (!scanTimer) {
      scanTimer = setTimeout(() => {
        scanTimer = null;
        runAnalysis(state.tf);
      }, 30000);
    }
  } catch (error) {
    state.conn = 'Offline';
    renderSoft();
    if (Date.now() - lastErrorLogAt > 60000) {
      lastErrorLogAt = Date.now();
      log(`Live price mencoba tersambung kembali: ${error.message}`);
    }
  } finally {
    pollInFlight = false;
  }
}

export function connect() {
  if (liveTimer) clearInterval(liveTimer);
  state.conn = 'Connecting';
  renderSoft();
  pollLivePrice();
  liveTimer = setInterval(pollLivePrice, 10000);

  if (!state.candles[state.tf]?.length) {
    runAnalysis(state.tf);
  }
}

export function isLivePriceRunning() {
  return liveTimer !== null;
}

export function stopLivePrice() {
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
  if (scanTimer) {
    clearTimeout(scanTimer);
    scanTimer = null;
  }
  state.conn = 'Offline';
  renderSoft();
}
