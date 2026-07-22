const TOPIC_MAX_LENGTH = 120;

const GROUP_INTERVALS = Object.freeze({
  trading_basics: ['1min', '1day'],
  instruments: ['1min', '1day'],
  order_math: ['1min', '1day'],
  risk: ['1min', '1day'],
  candle: ['15min', '1day'],
  timeframe: ['15min', '1h', '1day'],
  trend: ['15min', '1h', '1day'],
  support_resistance: ['15min', '1h', '1day'],
  liquidity: ['15min', '1h', '1day'],
  imbalance: ['15min', '1h', '1day'],
  order_block: ['15min', '1h', '1day'],
  session: ['1min', '15min', '1day'],
  volatility: ['15min', '1day'],
  momentum: ['15min', '1h', '1day'],
  premium_discount: ['15min', '1h', '1day'],
  news: ['1min', '15min', '1day'],
  psychology: ['1min', '1day'],
  backtest: ['15min', '1h', '1day'],
  trade_management: ['1min', '15min', '1day'],
  structural_fallback: ['15min', '1h', '1day'],
  management_fallback: ['1min', '15min', '1day'],
  basics_fallback: ['1min', '1day']
});

const TOPIC_RULES = Object.freeze([
  { id: 'trading_basics', pattern: /(apa-itu-trading|pengertian-trading|definisi-trading|realita-trading)/ },
  { id: 'instruments', pattern: /(market-forex|forex|gold|xauusd|komoditas|indeks|crypto|instrumen|pair)/ },
  { id: 'order_math', pattern: /(buy|sell|profit|loss|lot|pip|point|spread|long|short|bid|ask)/ },
  { id: 'risk', pattern: /(stop-loss|take-profit|risk|reward|rr-|risk-reward|leverage|margin|equity|balance|drawdown|position-sizing|ukuran-posisi)/ },
  { id: 'candle', pattern: /(candlestick|candle|ohlc|doji|engulf|pin-bar|wick|body-candle)/ },
  { id: 'timeframe', pattern: /(timeframe|multi-timeframe|top-down|topdown|higher-timeframe|lower-timeframe)/ },
  { id: 'support_resistance', pattern: /(support|resistance|supply|demand|level-kunci|horizontal-level)/ },
  { id: 'liquidity', pattern: /(liquidity|likuiditas|sweep|grab|bsl|ssl|inducement|stop-hunt|turtle-soup|draw-on-liquidity)/ },
  { id: 'imbalance', pattern: /(fair-value-gap|fvg|imbalance|balanced-price-range|bpr|ifvg|liquidity-void|volume-imbalance)/ },
  { id: 'order_block', pattern: /(order-block|breaker-block|mitigation-block|rejection-block|propulsion-block|block-advanced)/ },
  { id: 'session', pattern: /(session|killzone|london|new-york|asia|true-day-open|midnight-open|nymo|opening-gap|ndog|nwog|macro-time)/ },
  { id: 'volatility', pattern: /(atr|volatility|volatilitas|range-harian|adr|standard-deviation)/ },
  { id: 'momentum', pattern: /(rsi|momentum|divergence|smt|moving-average|ema|sma|macd|stochastic)/ },
  { id: 'premium_discount', pattern: /(premium|discount|equilibrium|ote|fibonacci|dealing-range|optimal-trade-entry)/ },
  { id: 'news', pattern: /(news|fundamental|nfp|cpi|fomc|interest-rate|suku-bunga|inflasi|employment)/ },
  { id: 'psychology', pattern: /(psikologi|psychology|fomo|revenge|disiplin|emosi|sabar|overtrading|mindset)/ },
  { id: 'backtest', pattern: /(backtest|backtesting|forward-test|jurnal|journal|sample-size|expectancy|win-rate)/ },
  { id: 'trade_management', pattern: /(trade-management|partial|break-even|breakeven|trailing|scale-out|pyramiding|exit-plan|manage-position)/ },
  { id: 'trend', pattern: /(trend|market-structure|struktur-market|bos|choch|mss|cisd|displacement|break-of-structure|change-of-character|mmxm|amd|power-of-three)/ }
]);

export function normalizeTopic(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.html?$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, TOPIC_MAX_LENGTH);
}

export function humanizeTopic(value) {
  const topic = normalizeTopic(value);
  if (!topic || topic === 'index') return 'ringkasan materi';
  return topic
    .split('-')
    .filter(Boolean)
    .map(word => word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function classifyLearningTopic(topicValue, categoryValue = '') {
  const topic = normalizeTopic(topicValue);
  const category = normalizeTopic(categoryValue);
  const matched = TOPIC_RULES.find(rule => rule.pattern.test(topic));
  const group = matched?.id || (
    category === 'structural' ? 'structural_fallback'
      : category === 'management' ? 'management_fallback'
        : 'basics_fallback'
  );

  return Object.freeze({
    topic,
    category: category || 'basics',
    group,
    intervals: [...GROUP_INTERVALS[group]]
  });
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function price(value) {
  return number(value).toFixed(2);
}

function percent(value) {
  const parsed = number(value);
  const sign = parsed > 0 ? '+' : '';
  return `${sign}${parsed.toFixed(2)}%`;
}

function directionLabel(value) {
  if (value === 'bullish') return 'bullish';
  if (value === 'bearish') return 'bearish';
  return 'netral';
}

function timeframeName(interval) {
  return ({ '1min': 'M1', '15min': 'M15', '1h': 'H1', '1day': 'D1' })[interval] || interval;
}

function sessionAt(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date).split(':').map(Number);
    const minutes = parts[0] * 60 + parts[1];
    if (minutes >= 6 * 60 && minutes < 14 * 60) return 'Asia';
    if (minutes >= 14 * 60 && minutes < 20 * 60) return 'London';
    if (minutes >= 20 * 60 || minutes < 1 * 60) return 'New York';
    return 'transisi/off-session';
  } catch (_) {
    return 'tidak diketahui';
  }
}

function summarizeSeries(candles = [], interval = '') {
  const valid = candles.filter(candle =>
    [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
  );
  if (!valid.length) return null;

  const latest = valid.at(-1);
  const previous = valid.at(-2) || latest;
  const sample = valid.slice(-20);
  const first = sample[0] || latest;
  const recentHigh = Math.max(...sample.map(candle => candle.high));
  const recentLow = Math.min(...sample.map(candle => candle.low));
  const changePct = first.close ? ((latest.close - first.close) / first.close) * 100 : 0;
  const candleDirection = latest.close > latest.open ? 'bullish' : latest.close < latest.open ? 'bearish' : 'neutral';
  const trend = changePct > 0.08 ? 'bullish' : changePct < -0.08 ? 'bearish' : 'sideways';
  const averageBody = sample.reduce((sum, candle) => sum + Math.abs(candle.close - candle.open), 0) / sample.length;
  const latestBody = Math.abs(latest.close - latest.open);

  return {
    interval,
    timeframe: timeframeName(interval),
    open: latest.open,
    high: latest.high,
    low: latest.low,
    close: latest.close,
    previousClose: previous.close,
    range: latest.high - latest.low,
    body: latestBody,
    averageBody,
    displacement: averageBody > 0 && latestBody >= averageBody * 1.5,
    candleDirection,
    trend,
    changePct,
    recentHigh,
    recentLow,
    midpoint: (recentHigh + recentLow) / 2
  };
}

function atr(candles = [], period = 14) {
  const valid = candles.slice(-(period + 1));
  if (valid.length < 2) return 0;
  const ranges = [];
  for (let index = 1; index < valid.length; index += 1) {
    const current = valid[index];
    const previous = valid[index - 1];
    ranges.push(Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    ));
  }
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
}

function detectFvg(candles = []) {
  for (let index = candles.length - 1; index >= 2; index -= 1) {
    const left = candles[index - 2];
    const right = candles[index];
    if (right.low > left.high) {
      return { direction: 'bullish', bottom: left.high, top: right.low };
    }
    if (right.high < left.low) {
      return { direction: 'bearish', bottom: right.high, top: left.low };
    }
  }
  return null;
}

function detectSweep(candles = []) {
  if (candles.length < 12) return null;
  const latest = candles.at(-1);
  const prior = candles.slice(-11, -1);
  const priorHigh = Math.max(...prior.map(candle => candle.high));
  const priorLow = Math.min(...prior.map(candle => candle.low));
  if (latest.high > priorHigh && latest.close < priorHigh) {
    return { side: 'BSL', level: priorHigh, status: 'reclaimed' };
  }
  if (latest.low < priorLow && latest.close > priorLow) {
    return { side: 'SSL', level: priorLow, status: 'reclaimed' };
  }
  return null;
}

export function buildMarketContext(seriesByInterval, now = new Date()) {
  const summaries = {};
  for (const [interval, candles] of Object.entries(seriesByInterval || {})) {
    summaries[interval] = summarizeSeries(candles, interval);
  }

  const primary = summaries['1min'] || summaries['15min'] || summaries['1h'] || summaries['1day'];
  if (!primary) throw new Error('Market context kosong');

  const dailyCandles = seriesByInterval?.['1day'] || [];
  const structuralCandles = seriesByInterval?.['15min'] || seriesByInterval?.['1h'] || [];
  const daily = summaries['1day'];

  return Object.freeze({
    symbol: 'XAU/USD',
    price: primary.close,
    session: sessionAt(now),
    summaries,
    dailyAtr14: atr(dailyCandles, 14),
    dailyPosition: daily && daily.range > 0 ? (daily.close - daily.low) / daily.range : 0.5,
    fvg: detectFvg(structuralCandles),
    sweep: detectSweep(structuralCandles),
    generatedAt: now.toISOString()
  });
}

function baseFacts(context) {
  const daily = context.summaries['1day'];
  return [
    `XAU/USD ${price(context.price)}`,
    `Sesi ${context.session}`,
    daily ? `D1 ${directionLabel(daily.candleDirection)} (${percent(daily.changePct)})` : 'D1 belum tersedia'
  ];
}

function buildByGroup(route, context) {
  const topicName = humanizeTopic(route.topic);
  const m1 = context.summaries['1min'];
  const m15 = context.summaries['15min'];
  const h1 = context.summaries['1h'];
  const d1 = context.summaries['1day'];
  const structural = m15 || h1 || d1 || m1;

  switch (route.group) {
    case 'bpr':
      return context.fvg
        ? `[Data Candle M15 Di-Hidangkan]\n• Zona FVG Terdeteksi: $${price(context.fvg.bottom)} – $${price(context.fvg.top)} (${context.fvg.direction.toUpperCase()})\n• Range M15: Low $${price(m15?.recentLow)} – High $${price(m15?.recentHigh)}\n• Live Price: $${price(context.price)} (Midpoint $${price(m15?.midpoint)})\nSistem menghidangkan area tumpang tindih BPR pada $${price(context.fvg.bottom)} – $${price(context.fvg.top)} dari simpanan candle M15.`
        : `[Data Candle M15 Di-Hidangkan]\n• Range M15: Low $${price(m15?.recentLow)} – High $${price(m15?.recentHigh)}\n• Live Price: $${price(context.price)} (Equilibrium $${price(m15?.midpoint)})\nSistem menghidangkan data dealing range M15 saat ini: Low $${price(m15?.recentLow)} dan High $${price(m15?.recentHigh)}.`;

    case 'ifvg':
      return context.fvg
        ? `[Data Candle M15 Di-Hidangkan]\n• FVG Terdeteksi: $${price(context.fvg.bottom)} – $${price(context.fvg.top)} (${context.fvg.direction.toUpperCase()})\n• Live Price: $${price(context.price)}\n• Status Inversion: ${context.price < context.fvg.bottom ? 'Ditembus ke bawah (Inversion Resistance)' : context.price > context.fvg.top ? 'Ditembus ke atas (Inversion Support)' : 'Harga berada di dalam zona FVG'}\nSistem menyajikan status Inversion FVG langsung dari penutupan candle M15.`
        : `[Data Candle M15 Di-Hidangkan]\n• Range M15: Low $${price(m15?.recentLow)} – High $${price(m15?.recentHigh)}\n• Live Price: $${price(context.price)}\nSistem menyajikan data candle M15 terbaru: FVG Inversion sebelumnya telah termitigasi di $${price(context.price)}.`;

    case 'breaker_block':
      return `[Data Candle M15 Di-Hidangkan]\n• Swing High M15: $${price(m15?.recentHigh)}\n• Swing Low M15: $${price(m15?.recentLow)}\n• Live Price: $${price(context.price)}\n• Status Sweep: ${context.sweep ? `Sweep ${context.sweep.side} di $${price(context.sweep.level)}` : 'Tidak ada sweep baru'}\nSistem menyajikan struktur Breaker Block pada rentang $${price(m15?.recentLow)} – $${price(m15?.recentHigh)} dari data candle M15.`;

    case 'turtle_soup':
      return `[Data Candle M15 Di-Hidangkan]\n• BSL High: $${price(m15?.recentHigh)}\n• SSL Low: $${price(m15?.recentLow)}\n• Live Price: $${price(context.price)}\n• Status Sweep: ${context.sweep ? `Sweep ${context.sweep.side} di $${price(context.sweep.level)} dengan penutupan $${price(context.price)}.` : 'Belum ada sweep wick pada ekor candle M15.'}\nSistem menghidangkan titik sweep dan reclaim langsung dari data candle M15.`;

    case 'silver_bullet':
      return `[Data Candle M15/M1 Di-Hidangkan]\n• Sesi Aktif: ${context.session}\n• Range M15: Low $${price(m15?.recentLow)} – High $${price(m15?.recentHigh)}\n• FVG Terdekat: ${context.fvg ? `$${price(context.fvg.bottom)} – $${price(context.fvg.top)}` : 'Belum ada FVG baru'}\n• Live Price: $${price(context.price)}\nSistem menghidangkan zona FVG Silver Bullet dari candle running.`;

    case 'smt_divergence':
      return `[Data Candle Di-Hidangkan]\n• XAU/USD Live Price: $${price(context.price)}\n• Range D1: Low $${price(d1?.low)} – High $${price(d1?.high)}\n• Perubahan D1: ${percent(d1?.changePct)}\nSistem menghidangkan perbandingan harga XAU/USD $${price(context.price)} untuk analisis SMT Divergence.`;

    case 'ipda_ranges':
      return `[Data Candle IPDA Di-Hidangkan]\n• Live Price: $${price(context.price)}\n• Range D1 Hari Ini: $${price(d1?.range)} (Low $${price(d1?.low)} – High $${price(d1?.high)})\n• ATR(14) D1: $${price(context.dailyAtr14)}\n• Posisi Harga di Range D1: ${Math.round(context.dailyPosition * 100)}%\nSistem menghidangkan data IPDA harian dari simpanan candle D1.`;

    case 'power_of_three':
      return `[Data Candle Sesi Di-Hidangkan]\n• Sesi WITA Aktif: ${context.session}\n• Open D1: $${price(d1?.open)}\n• Live Price: $${price(context.price)}\n• Range Sesi: Low $${price(m15?.recentLow)} – High $${price(m15?.recentHigh)}\nSistem menghidangkan tahapan AMD/PO3 sesuai sesi ${context.session} dari data candle.`;

    case 'nwog_ndog':
      return `[Data Candle Opening Gap Di-Hidangkan]\n• Open D1: $${price(d1?.open)}\n• Prev Close D1: $${price(d1?.previousClose)}\n• Gap Harian (NDOG): $${price(number(d1?.open) - number(d1?.previousClose))}\n• Live Price: $${price(context.price)}\nSistem menghidangkan selisih NDOG harian langsung dari simpanan candle D1.`;

    case 'standard_deviation':
      return `[Data Candle STDV Di-Hidangkan]\n• Range M15: Low $${price(m15?.recentLow)} – High $${price(m15?.recentHigh)}\n• Equilibrium (50%): $${price(m15?.midpoint)}\n• Target STDV -2.0: $${price(number(m15?.recentLow) - (number(m15?.recentHigh) - number(m15?.recentLow)) * 2)}\n• Target STDV -2.5: $${price(number(m15?.recentLow) - (number(m15?.recentHigh) - number(m15?.recentLow)) * 2.5)}\n• Live Price: $${price(context.price)}\nSistem menghidangkan level proyeksi STDV terhitung dari dealing range M15.`;

    case 'prop_firm':
      return `[Data Kalkulasi Risiko Prop Firm Di-Hidangkan]\n• Live Price: $${price(context.price)}\n• ATR D1 (Volatilitas): $${price(context.dailyAtr14)}\n• Max Risk per Trade (1%): $${price(context.dailyAtr14 * 0.5)}\nSistem menghidangkan toleransi Stop Loss $${price(context.dailyAtr14 * 0.5)} pips berdasarkan ATR harian.`;

    case 'playbook_xau':
      return `[Data Playbook XAU/USD Di-Hidangkan]\n• Live Price XAU/USD: $${price(context.price)}\n• ATR(14) D1: $${price(context.dailyAtr14)}\n• Range Hari Ini: $${price(d1?.range)} (${Math.round((number(d1?.range) / Math.max(0.1, context.dailyAtr14)) * 100)}% ATR)\n• Buffer SL Ideal: $${price(context.dailyAtr14 * 0.3)} – $${price(context.dailyAtr14 * 0.5)}\nSistem menghidangkan parameter volatilitas Gold langsung dari candle D1.`;

    case 'trading_basics':
      return `[Data Candle Di-Hidangkan]\n• Live Price: $${price(context.price)}\n• Open D1: $${price(d1?.open)}\n• Selisih Harian: $${price(context.price - number(d1?.open))}\nSistem menghidangkan data perubahan harga harian dari simpanan candle D1 (inti trading: keputusan berbasis harga & risiko).`;

    case 'instruments':
      return `[Data Instrumen XAU/USD Di-Hidangkan]\n• Live Price: $${price(context.price)}\n• Low D1: $${price(d1?.low)} | High D1: $${price(d1?.high)}\n• Range Harian: $${price(d1?.range)}\nSistem menghidangkan karakteristik volatilitas Gold dari simpanan candle.`;

    case 'order_math':
      return `[Data Kalkulasi Order Di-Hidangkan]\n• Open D1: $${price(d1?.open)} | Live Price: $${price(context.price)}\n• Perubahan Pips/Points: ${price(Math.abs(context.price - number(d1?.open)) * 10)} pips\nSistem menghidangkan pergerakan pip/point nyata (Buy / Sell) dari candle D1.`;

    case 'risk':
      return `[Data Parameter Risiko Di-Hidangkan]\n• Live Price: $${price(context.price)}\n• ATR(14) D1: $${price(context.dailyAtr14)}\n• Ideal SL Buffer: $${price(context.dailyAtr14 * 0.4)} pips\nSistem menghidangkan batasan SL berbasis volatilitas candle harian.`;

    case 'candle':
      return `[Data OHLC Candle Di-Hidangkan]\n• Timeframe: ${structural?.timeframe || 'M15'}\n• Open: $${price(structural?.open)} | High: $${price(structural?.high)}\n• Low: $${price(structural?.low)} | Close: $${price(structural?.close)}\nSistem menghidangkan data OHLC utuh dari candle running.`;

    case 'timeframe':
      return `[Data Multi-Timeframe Di-Hidangkan]\n• M15 Trend: ${m15?.trend || 'sideways'} (Close $${price(m15?.close)})\n• H1 Trend: ${h1?.trend || 'sideways'} (Close $${price(h1?.close)})\n• D1 Trend: ${d1?.trend || 'sideways'} (Close $${price(d1?.close)})\nSistem menghidangkan komparasi tren 3 timeframe dari simpanan candle.`;

    case 'trend':
      return `[Data Struktur Market Di-Hidangkan]\n• M15 High: $${price(m15?.recentHigh)} | M15 Low: $${price(m15?.recentLow)}\n• Live Price: $${price(context.price)}\n• Body Displacement: ${m15?.displacement ? 'TERKONFIRMASI STRONG DISPLACEMENT' : 'NORMAL / TANPA DISPLACEMENT'}\nSistem menghidangkan level struktur M15 langsung dari candle.`;

    case 'support_resistance':
      return `[Data Level Kunci Di-Hidangkan]\n• Resistance (High): $${price(m15?.recentHigh)}\n• Support (Low): $${price(m15?.recentLow)}\n• Midpoint (Equilibrium): $${price(m15?.midpoint)}\n• Live Price: $${price(context.price)}\nSistem menghidangkan koordinat Support & Resistance dari candle M15.`;

    case 'liquidity':
      return `[Data Likuiditas Di-Hidangkan]\n• Pool BSL High: $${price(structural?.recentHigh)}\n• Pool SSL Low: $${price(structural?.recentLow)}\n• Status Sweep: ${context.sweep ? `SWEEP TERDETEKSI ${context.sweep.side} di $${price(context.sweep.level)}` : 'Tidak ada sweep aktif'}\nSistem menghidangkan koordinat pool likuiditas dari candle.`;

    case 'imbalance':
      return `[Data Imbalance FVG Di-Hidangkan]\n• FVG Status: ${context.fvg ? `TERDETEKSI ${context.fvg.direction.toUpperCase()} ($${price(context.fvg.bottom)} – $${price(context.fvg.top)})` : 'Tidak ada FVG aktif pada 20 candle M15'}\n• Live Price: $${price(context.price)}\nSistem menghidangkan batas atas & bawah FVG langsung dari candle.`;

    case 'order_block':
      return `[Data Order Block Di-Hidangkan]\n• Dealing Range M15: $${price(structural?.recentLow)} – $${price(structural?.recentHigh)}\n• High/Low Asal: $${price(structural?.recentHigh)}\n• Live Price: $${price(context.price)}\nSistem menghidangkan area Order Block terhitung dari candle M15.`;

    case 'session':
      return `[Data Sesi Trading Di-Hidangkan]\n• Sesi WITA: ${context.session}\n• M15 Range Sesi: Low $${price(m15?.recentLow)} – High $${price(m15?.recentHigh)}\n• Live Price: $${price(context.price)}\nSistem menghidangkan batas harga sesi dari candle.`;

    case 'volatility':
      return `[Data Volatilitas Di-Hidangkan]\n• ATR(14) D1: $${price(context.dailyAtr14)}\n• Range Hari Ini: $${price(d1?.range)}\n• Penggunaan ATR: ${context.dailyAtr14 > 0 ? Math.round((number(d1?.range) / context.dailyAtr14) * 100) : 0}%\nSistem menghidangkan rasio penggunaan ATR harian dari candle D1.`;

    case 'momentum':
      return `[Data Momentum Di-Hidangkan]\n• M15 Change %: ${percent(m15?.changePct)}\n• H1 Change %: ${percent(h1?.changePct)}\n• Live Price: $${price(context.price)}\nSistem menghidangkan delta momentum perbandingan M15 & H1 dari candle.`;

    case 'premium_discount':
      return `[Data Premium/Discount Di-Hidangkan]\n• Dealing Range M15: Low $${price(m15?.recentLow)} – High $${price(m15?.recentHigh)}\n• Equilibrium (50%): $${price(m15?.midpoint)}\n• Live Price: $${price(context.price)} (${context.price >= number(m15?.midpoint) ? 'PREMIUM ZONA' : 'DISCOUNT ZONA'})\nSistem menghidangkan koordinat Equilibrium & Status Zona dari candle M15.`;

    case 'news':
      return `[Data Reaksi Berita Di-Hidangkan]\n• Live Price: $${price(context.price)}\n• M1 Range Sederhana: $${price(m1?.range)}\n• D1 Range Harian: $${price(d1?.range)}\nSistem menghidangkan skala reaksi candle saat berita.`;

    case 'psychology':
      return `[Data Skenario Psikologi Di-Hidangkan]\n• Live Price: $${price(context.price)}\n• Midpoint M15: $${price(m15?.midpoint)}\n• Posisi: ${context.price >= number(m15?.midpoint) ? 'Area Premium' : 'Area Discount'}\nSistem menghidangkan posisi relatif harga untuk mencegah keputusan impulsif.`;

    case 'backtest':
      return `[Data Sampel Backtest Di-Hidangkan]\n• Live Price: $${price(context.price)}\n• M15 Trend: ${m15?.trend || 'sideways'}\n• H1 Trend: ${h1?.trend || 'sideways'}\n• ATR D1: $${price(context.dailyAtr14)}\nSistem menghidangkan snapshot sampel data candle untuk jurnal backtest.`;

    case 'trade_management':
      return `[Data Manajemen Posisi Di-Hidangkan]\n• High D1: $${price(d1?.high)} | Low D1: $${price(d1?.low)}\n• Equilibrium D1: $${price(d1?.midpoint || (number(d1?.high) + number(d1?.low)) / 2)}\n• Live Price: $${price(context.price)}\nSistem menghidangkan rujukan batas partial & TP dari candle D1.`;

    case 'structural_fallback':
      return `[Data Konteks Struktur Di-Hidangkan]\n• Range M15: Low $${price(m15?.recentLow)} – High $${price(m15?.recentHigh)}\n• Live Price: $${price(context.price)}\nSistem menghidangkan koordinat range M15 dari candle.`;

    case 'management_fallback':
      return `[Data Manajemen Di-Hidangkan]\n• Range D1: $${price(d1?.range)} | ATR(14): $${price(context.dailyAtr14)}\nSistem menghidangkan rasio range harian terhadap ATR dari candle D1.`;

    default:
      return `[Data Candle Di-Hidangkan]\n• Live Price: $${price(context.price)}\n• Sesi: ${context.session}\nSistem menghidangkan data live harga XAU/USD dari candle.`;
  }
}

export function buildLearningExample(route, context) {
  if (!route?.topic) throw new Error('Topic wajib diisi');
  if (!context?.summaries) throw new Error('Market context wajib diisi');

  return Object.freeze({
    status: 'ok',
    topic: route.topic,
    category: route.category,
    route: {
      group: route.group,
      intervals: route.intervals
    },
    market: {
      symbol: context.symbol,
      price: context.price,
      session: context.session,
      generatedAt: context.generatedAt
    },
    content: {
      title: `Live Market Example — ${humanizeTopic(route.topic)}`,
      message: buildByGroup(route, context),
      facts: baseFacts(context),
      disclaimer: 'Contoh edukasi rule-based, bukan sinyal Buy/Sell dan bukan keluaran AI.'
    }
  });
}
