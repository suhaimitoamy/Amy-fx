const TOPIC_MAX_LENGTH = 120;

const GROUP_INTERVALS = Object.freeze({
  bpr: ['15min', '1h', '1day'],
  ifvg: ['15min', '1h', '1day'],
  breaker_block: ['15min', '1h', '1day'],
  turtle_soup: ['15min', '1h', '1day'],
  silver_bullet: ['1min', '15min', '1h'],
  smt_divergence: ['15min', '1h', '1day'],
  ipda_ranges: ['15min', '1h', '1day'],
  power_of_three: ['15min', '1h', '1day'],
  nwog_ndog: ['15min', '1h', '1day'],
  standard_deviation: ['15min', '1h', '1day'],
  prop_firm: ['1min', '15min', '1day'],
  playbook_xau: ['1min', '15min', '1h', '1day'],

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

// Urutan merupakan prioritas. Konsep spesifik harus diuji sebelum kata umum
// seperti gold, profit, loss, market, atau trading.
const TOPIC_RULES = Object.freeze([
  { id: 'bpr', pattern: /(balanced-price-range|bpr)/ },
  { id: 'ifvg', pattern: /(ifvg|inversion-fvg|inversion-model)/ },
  { id: 'breaker_block', pattern: /(breaker-block|mitigation-block)/ },
  { id: 'turtle_soup', pattern: /(turtle-soup|smart-money-reversal)/ },
  { id: 'silver_bullet', pattern: /(silver-bullet)/ },
  { id: 'smt_divergence', pattern: /(smt-divergence|smart-money-tool)/ },
  { id: 'ipda_ranges', pattern: /(ipda-data-ranges|ipda)/ },
  { id: 'power_of_three', pattern: /(power-of-three|amd-model|po3)/ },
  { id: 'nwog_ndog', pattern: /(nwog-dan-ndog|opening-gap)/ },
  { id: 'standard_deviation', pattern: /(standard-deviation-projections|stdv)/ },
  { id: 'prop_firm', pattern: /(prop-firm)/ },
  { id: 'playbook_xau', pattern: /(xauusd-advanced-playbook|xauusd-playbook)/ },

  { id: 'trading_basics', pattern: /^(apa-itu-trading|pengertian-trading|definisi-trading|realita-trading)/ },
  { id: 'backtest', pattern: /(backtest|backtesting|forward-test|jurnal|journal|sample-size|expectancy|win-rate)/ },
  { id: 'psychology', pattern: /(psikologi|psychology|fomo|revenge|disiplin|emosi|sabar|overtrading|mindset)/ },
  { id: 'news', pattern: /(news|fundamental|nfp|cpi|fomc|interest-rate|suku-bunga|inflasi|employment|cot-report)/ },
  { id: 'trade_management', pattern: /(trade-management|partial|break-even|breakeven|trailing|scale-out|pyramiding|exit-plan|manage-position|mengelola-hasil)/ },
  { id: 'risk', pattern: /(stop-loss|take-profit|risk|reward|rr-|risk-reward|leverage|margin|equity|balance|drawdown|position-sizing|ukuran-posisi|daily-loss|maximum-loss)/ },
  { id: 'session', pattern: /(session|killzone|london|new-york|asia|true-day-open|midnight-open|nymo|macro-time|algorithmic-time)/ },
  { id: 'timeframe', pattern: /(timeframe|multi-timeframe|top-down|topdown|higher-timeframe|lower-timeframe|daily-bias)/ },
  { id: 'liquidity', pattern: /(liquidity|likuiditas|sweep|grab|bsl|ssl|inducement|stop-hunt|draw-on-liquidity)/ },
  { id: 'imbalance', pattern: /(fair-value-gap|fvg|imbalance|liquidity-void|volume-imbalance|consequent-encroachment)/ },
  { id: 'order_block', pattern: /(order-block|rejection-block|propulsion-block|block-advanced)/ },
  { id: 'premium_discount', pattern: /(premium|discount|equilibrium|ote|fibonacci|dealing-range|optimal-trade-entry)/ },
  { id: 'support_resistance', pattern: /(support|resistance|supply|demand|level-kunci|horizontal-level)/ },
  { id: 'volatility', pattern: /(atr|volatility|volatilitas|range-harian|adr)/ },
  { id: 'momentum', pattern: /(rsi|momentum|divergence|moving-average|ema|sma|macd|stochastic)/ },
  { id: 'candle', pattern: /(candlestick|candle|ohlc|doji|engulf|pin-bar|wick|body-candle)/ },
  { id: 'trend', pattern: /(trend|market-structure|struktur-market|bos|choch|mss|cisd|displacement|break-of-structure|change-of-character|mmxm|weekly-cycle|monthly-cycle|quarterly-theory)/ },
  { id: 'order_math', pattern: /(buy|sell|profit|loss|lot|pip|point|spread|long|short|bid|ask)/ },
  { id: 'instruments', pattern: /(market-forex|forex|gold|xauusd|komoditas|indeks|crypto|instrumen|pair)/ }
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

export function listLearningTopicRules() {
  return TOPIC_RULES.map(rule => rule.id);
}
