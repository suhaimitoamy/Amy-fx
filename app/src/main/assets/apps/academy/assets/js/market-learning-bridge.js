/* ===== DYNAMIC LIVE EXAMPLE INJECTOR ===== */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AmyFXLiveExample = api;
  if (root.document) api.boot();
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const REGISTRY_URL = '../assets/data/market-learning-map.json';
  const MARKET_PROXY_URL = 'https://amy-fx.vercel.app/api/twelvedata';
  const MAPPING_ENGINE_URL = '/assets/apps/mapping/js/engine/ict-core.js';
  const CANDLE_ENGINE_URL = '/assets/apps/mapping/js/engine/concept-candles.js';
  const FETCH_TIMEOUT_MS = 15000;
  const SERIES_CACHE_MS = 20000;
  const STORED_ANALYSIS_MAX_AGE_MS = 5 * 60 * 1000;
  const TF_INTERVAL = Object.freeze({
    M1: '1min',
    M15: '15min',
    H1: '1h',
    H4: '4h',
    D1: '1day'
  });

  const seriesCache = new Map();
  let mappingEnginePromise = null;
  let candleEnginePromise = null;

  function number(value, fallback = NaN) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function price(value) {
    const parsed = number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : '--';
  }

  function safeLabel(value, fallback = 'WAIT') {
    const normalized = String(value || fallback)
      .replace(/[^A-Za-z0-9 _/-]/g, '')
      .trim()
      .slice(0, 48);
    return normalized || fallback;
  }

  function currentSessionLabel(date = new Date()) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Makassar',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date).split(':').map(Number);
      const minutes = parts[0] * 60 + parts[1];
      if (minutes >= 6 * 60 && minutes < 14 * 60) return 'ASIA';
      if (minutes >= 14 * 60 && minutes < 20 * 60) return 'LONDON';
      if (minutes >= 20 * 60 || minutes < 1 * 60) return 'NEW YORK';
      return 'OFF-SESSION';
    } catch (_) {
      return 'SESSION UNKNOWN';
    }
  }

  function getCurrentPath() {
    const path = window.location.pathname;
    const parts = path.split('/');
    // e.g. "bagian-17-fvg-masterclass/index.html"
    if (parts.length >= 2) {
      return parts[parts.length - 2] + '/' + parts[parts.length - 1];
    }
    return '';
  }

  async function loadRegistry() {
    try {
      const response = await fetch(REGISTRY_URL, { cache: 'no-store' });
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  function fetchFunction() {
    if (typeof root.fetch !== 'function') throw new Error('Fetch tidak tersedia');
    return root.fetch.bind(root);
  }

  async function fetchJson(url) {
    const controller = typeof root.AbortController === 'function'
      ? new root.AbortController()
      : null;
    const timeout = controller
      ? root.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      : null;

    try {
      const response = await fetchFunction()(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        ...(controller ? { signal: controller.signal } : {})
      });
      if (!response.ok) throw new Error(`Market HTTP ${response.status}`);
      const data = await response.json();
      if (data?.status === 'error') throw new Error(data.message || 'Market API gagal');
      return data;
    } finally {
      if (timeout) root.clearTimeout(timeout);
    }
  }

  function normalizeSeries(data, tf) {
    const raw = (Array.isArray(data?.values) ? data.values : [])
      .slice()
      .reverse()
      .map((candle, index, values) => ({
        time: new Date(candle.datetime).getTime() / 1000,
        timeframe: tf,
        open: number(candle.open),
        high: number(candle.high),
        low: number(candle.low),
        close: number(candle.close),
        tickCount: 1,
        isClosed: index < values.length - 1
      }))
      .filter(candle =>
        [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
        && candle.high >= Math.max(candle.open, candle.close, candle.low)
        && candle.low <= Math.min(candle.open, candle.close, candle.high)
      );

    if (!raw.length) throw new Error(`Candle ${tf} kosong`);
    return {
      tf,
      latest: raw.at(-1),
      candles: raw.filter(candle => candle.isClosed)
    };
  }

  function fetchMarketSeries(tf, outputsize = 300) {
    const interval = TF_INTERVAL[tf];
    if (!interval) return Promise.reject(new Error(`Timeframe ${tf} tidak didukung`));

    const bucket = Math.floor(Date.now() / SERIES_CACHE_MS);
    const cacheKey = `${tf}:${outputsize}:${bucket}`;
    if (seriesCache.has(cacheKey)) return seriesCache.get(cacheKey);

    const params = new URLSearchParams({
      symbol: 'XAU/USD',
      interval,
      outputsize: String(outputsize)
    });
    const promise = fetchJson(`${MARKET_PROXY_URL}?${params.toString()}`)
      .then(data => normalizeSeries(data, tf))
      .catch(error => {
        seriesCache.delete(cacheKey);
        throw error;
      });
    seriesCache.set(cacheKey, promise);
    return promise;
  }

  function loadMappingEngine() {
    if (!mappingEnginePromise) mappingEnginePromise = import(MAPPING_ENGINE_URL);
    return mappingEnginePromise;
  }

  function loadCandleEngine() {
    if (!candleEnginePromise) candleEnginePromise = import(CANDLE_ENGINE_URL);
    return candleEnginePromise;
  }

  function readFreshStoredAnalysis(tf) {
    try {
      const items = JSON.parse(root.localStorage.getItem('amy_mapping_analyses') || '[]');
      if (!Array.isArray(items)) return null;
      return items.find(item =>
        item?.tf === tf
        && Number.isFinite(Number(item.id))
        && Date.now() - Number(item.id) <= STORED_ANALYSIS_MAX_AGE_MS
      ) || null;
    } catch (_) {
      return null;
    }
  }

  async function fetchMappingAnalysis(tf, htfTimeframes = []) {
    try {
      const requests = [
        fetchMarketSeries(tf, 300),
        fetchMarketSeries('M1', 3),
        ...htfTimeframes.map(currentTf => fetchMarketSeries(currentTf, currentTf === 'D1' ? 120 : 220))
      ];
      const [primary, live, ...htfSeries] = await Promise.all(requests);
      if (primary.candles.length < 30) throw new Error(`Candle ${tf} belum cukup`);

      const htfCandles = {};
      htfTimeframes.forEach((currentTf, index) => {
        htfCandles[currentTf] = htfSeries[index]?.candles || [];
      });

      const currentPrice = number(live.latest?.close, primary.latest?.close);
      const engine = await loadMappingEngine();
      if (typeof engine.analyze !== 'function') throw new Error('Mapping engine tidak tersedia');
      const result = engine.analyze(primary.candles, tf, {}, currentPrice, htfCandles);
      if (!result?.marketConcepts) throw new Error('Hasil Mapping tidak valid');
      return { result, currentPrice, source: 'LIVE_MAPPING_ENGINE' };
    } catch (error) {
      const stored = readFreshStoredAnalysis(tf);
      if (stored?.marketConcepts) {
        return {
          result: stored,
          currentPrice: number(stored.price),
          source: 'FRESH_MAPPING_CACHE'
        };
      }
      throw error;
    }
  }

  function buildBasicsExample(liveSeries, dailySeries) {
    const latestLive = liveSeries?.latest;
    const daily = dailySeries?.latest;
    if (!latestLive || !daily) return null;

    return {
      price: price(latestLive.close),
      open: price(daily.open),
      high: price(daily.high),
      low: price(daily.low),
      session: currentSessionLabel(),
      message: `Saat Anda membaca materi ini, harga XAU/USD berjalan di **$${price(latestLive.close)}**. Candle harian saat ini memiliki open **$${price(daily.open)}**, high **$${price(daily.high)}**, dan low **$${price(daily.low)}**. Sesi market saat ini: **${currentSessionLabel()}**.`
    };
  }

  function buildStructuralExample(topic, analysis) {
    const result = analysis?.result;
    const concepts = result?.marketConcepts;
    const currentPrice = analysis?.currentPrice || result?.price;
    if (!concepts) return null;

    if (topic === 'fvg') {
      const zone = concepts.nearestFairValueGaps?.[0] || null;
      if (!zone) {
        return {
          message: `Engine Mapping Amy FX pada **M15** belum menemukan FVG aktif yang lolos filter saat ini. Harga live XAU/USD berada di **$${price(currentPrice)}**.`
        };
      }
      return {
        message: `Engine Mapping Amy FX mendeteksi **FVG ${safeLabel(zone.direction)} di timeframe M15** pada rentang **$${price(zone.bottom)} - $${price(zone.top)}**. Status zona saat ini **${safeLabel(zone.status)}**, dengan harga live **$${price(currentPrice)}**.`
      };
    }

    if (topic === 'ob') {
      const zone = concepts.nearestOrderBlocks?.[0] || null;
      if (!zone) {
        return {
          message: `Engine Mapping Amy FX pada **H1** belum menemukan Order Block aktif yang lolos filter struktur saat ini. Harga live XAU/USD berada di **$${price(currentPrice)}**.`
        };
      }
      return {
        message: `Engine Mapping Amy FX mendeteksi **Order Block ${safeLabel(zone.direction)} di timeframe H1** pada rentang **$${price(zone.bottom)} - $${price(zone.top)}**. Status zona **${safeLabel(zone.status)}** dan sumber break **${safeLabel(zone.sourceStructure, 'STRUCTURE')}**.`
      };
    }

    if (topic === 'liquidity_sweep') {
      const sweep = concepts.latestConfirmedSweep || null;
      if (sweep) {
        const side = safeLabel(sweep.type || sweep.brokenSide || sweep.dir, 'LIQUIDITY');
        return {
          message: `Engine Mapping Amy FX pada **H1** mendeteksi sweep terkonfirmasi pada **${side}** di level **$${price(sweep.level || sweep.price)}**. Reclaim tercatat **${number(sweep.reclaimDepthAtr, 0).toFixed(2)} ATR** dengan status **${safeLabel(sweep.status, 'CONFIRMED')}**.`
        };
      }

      const draw = concepts.liquidityHierarchy?.drawTarget || null;
      return {
        message: draw
          ? `Engine Mapping Amy FX pada **H1** belum menemukan sweep terkonfirmasi terbaru. Level likuiditas aktif terdekat adalah **${safeLabel(draw.type)} di $${price(draw.level || draw.price)}**; level ini adalah target likuiditas, bukan sinyal arah.`
          : `Engine Mapping Amy FX pada **H1** belum menemukan sweep terkonfirmasi maupun target BSL/SSL aktif yang valid saat ini.`
      };
    }

    return null;
  }

  async function buildManagementExample(dailySeries) {
    const latest = dailySeries?.latest;
    if (!latest) return null;

    const candleEngine = await loadCandleEngine();
    if (typeof candleEngine.conceptAtrAt !== 'function') return null;
    const candles = [...(dailySeries.candles || []), latest];
    const atr = number(candleEngine.conceptAtrAt(candles, candles.length - 1, 14), 0);
    const dailyRange = Math.max(0, number(latest.high, 0) - number(latest.low, 0));
    if (!(atr > 0)) return null;

    const rangeRatio = dailyRange / atr;
    const condition = rangeRatio >= 1.2 ? 'TINGGI' : rangeRatio <= 0.7 ? 'RENDAH' : 'NORMAL';
    return {
      atr: `$${price(atr)}/hari`,
      message: `ATR(14) harian XAU/USD dari engine Mapping saat ini adalah **$${price(atr)}**, sedangkan rentang candle hari berjalan **$${price(dailyRange)}**. Kondisi volatilitas intraday relatif **${condition}**. Gunakan data ini untuk menyesuaikan jarak SL dan ukuran posisi agar risiko per transaksi tetap konsisten.`
    };
  }

  async function fetchLiveExampleData(lessonConfig) {
    if (lessonConfig.category === 'basics') {
      const [live, daily] = await Promise.all([
        fetchMarketSeries('M1', 3),
        fetchMarketSeries('D1', 30)
      ]);
      return buildBasicsExample(live, daily);
    }

    if (lessonConfig.category === 'structural') {
      const topic = lessonConfig.topic;
      if (topic === 'fvg') {
        return buildStructuralExample(topic, await fetchMappingAnalysis('M15'));
      }
      if (topic === 'ob') {
        return buildStructuralExample(topic, await fetchMappingAnalysis('H1', ['H4', 'D1']));
      }
      if (topic === 'liquidity_sweep') {
        return buildStructuralExample(topic, await fetchMappingAnalysis('H1', ['D1']));
      }
      return null;
    }

    if (lessonConfig.category === 'management') {
      return buildManagementExample(await fetchMarketSeries('D1', 40));
    }

    return null;
  }

  function generateUI(data) {
    const box = document.createElement('div');
    box.className = 'live-example-box glass-panel';
    box.style.margin = '2rem 0';
    box.style.padding = '1.5rem';
    box.style.borderLeft = '4px solid var(--accent, #b8860b)';
    box.style.borderRadius = '8px';
    box.style.background = 'rgba(20, 20, 20, 0.4)';
    box.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';

    const title = document.createElement('h3');
    title.style.marginTop = '0';
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    title.style.gap = '8px';
    title.style.color = 'var(--text-primary, #fff)';
    title.innerHTML = '📊 <span>Live Market Example</span>';
    
    // Add a pulsing dot for "LIVE" effect
    const pulse = document.createElement('span');
    pulse.style.display = 'inline-block';
    pulse.style.width = '8px';
    pulse.style.height = '8px';
    pulse.style.borderRadius = '50%';
    pulse.style.background = '#ff3b30';
    pulse.style.boxShadow = '0 0 8px #ff3b30';
    pulse.style.animation = 'pulse 2s infinite';
    title.appendChild(pulse);

    const desc = document.createElement('p');
    desc.style.marginBottom = '0';
    desc.style.lineHeight = '1.6';
    desc.style.color = 'var(--text-secondary, #ddd)';
    // Parse markdown-like bold text
    desc.innerHTML = data.message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    box.appendChild(title);
    box.appendChild(desc);

    // Add pulse animation style if not exists
    if (!document.getElementById('amy-live-pulse-css')) {
      const style = document.createElement('style');
      style.id = 'amy-live-pulse-css';
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
      `;
      document.head.appendChild(style);
    }

    return box;
  }

  async function injectExample(lessonConfig) {
    let exampleData = null;

    try {
      exampleData = await fetchLiveExampleData(lessonConfig);
    } catch (_) {
      return;
    }

    if (!exampleData) return;

    // Find a good place to inject (e.g., after the first 2 paragraphs of the article)
    const target = document.querySelector('.article .glass-panel') || document.querySelector('.article');
    if (!target) return;

    const paragraphs = target.querySelectorAll('p');
    const injectionPoint = paragraphs.length > 2 ? paragraphs[1] : paragraphs[paragraphs.length - 1];

    if (injectionPoint && injectionPoint.parentNode) {
      const ui = generateUI(exampleData);
      injectionPoint.parentNode.insertBefore(ui, injectionPoint.nextSibling);
    }
  }

  async function boot() {
    const registry = await loadRegistry();
    if (!registry || !registry.lessons) return;

    const currentPath = getCurrentPath();
    const lessonConfig = registry.lessons[currentPath];
    
    if (lessonConfig && lessonConfig.enabled) {
      // Check if DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => injectExample(lessonConfig));
      } else {
        injectExample(lessonConfig);
      }
    }
  }

  return {
    boot,
    fetchMarketSeries,
    fetchMappingAnalysis,
    fetchLiveExampleData,
    buildBasicsExample,
    buildStructuralExample,
    buildManagementExample
  };
});
