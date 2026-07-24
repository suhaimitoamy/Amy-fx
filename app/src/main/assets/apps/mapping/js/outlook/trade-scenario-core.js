export const TRADE_SCENARIO_CONFIG = Object.freeze({
  timeframe: 'M15',
  lookbackBars: 32,
  atrPeriod: 14,
  entryBufferAtr: 0.05,
  stopPadAtr: 0.75,
  tp1R: 0.5,
  tp2R: 1.0,
  validityBars: 32
});

function num(value, fallback = NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validCandle(candle) {
  return candle
    && Number.isFinite(num(candle.high))
    && Number.isFinite(num(candle.low))
    && Number.isFinite(num(candle.close));
}

function trueRange(candle, previousClose) {
  const high = num(candle?.high, 0);
  const low = num(candle?.low, 0);
  if (!Number.isFinite(previousClose)) return Math.max(0, high - low);
  return Math.max(
    high - low,
    Math.abs(high - previousClose),
    Math.abs(low - previousClose)
  );
}

export function scenarioAtr(candles, period = TRADE_SCENARIO_CONFIG.atrPeriod) {
  const values = (Array.isArray(candles) ? candles : []).filter(validCandle);
  if (values.length < 2) return 0;
  const start = Math.max(1, values.length - Math.max(2, period));
  const ranges = [];
  for (let index = start; index < values.length; index += 1) {
    ranges.push(trueRange(values[index], num(values[index - 1]?.close)));
  }
  return ranges.length
    ? ranges.reduce((sum, value) => sum + value, 0) / ranges.length
    : 0;
}

function mergeConfig(config) {
  return { ...TRADE_SCENARIO_CONFIG, ...(config || {}) };
}

function scenarioReason(side, level) {
  if (side === 'BUY') {
    return `Buy hanya aktif setelah candle M15 ditutup di atas resistance ${level.toFixed(2)}.`;
  }
  return `Sell hanya aktif setelah candle M15 ditutup di bawah support ${level.toFixed(2)}.`;
}

export function activateTradeScenario(scenario, fillPrice = scenario?.entry) {
  if (!scenario) return null;
  const entry = num(fillPrice);
  const stopLoss = num(scenario.stopLoss);
  if (!Number.isFinite(entry) || !Number.isFinite(stopLoss)) return null;

  const risk = Math.abs(entry - stopLoss);
  if (!(risk > 0)) return null;
  const sign = scenario.side === 'SELL' ? -1 : 1;
  const tp1R = num(scenario.tp1R, TRADE_SCENARIO_CONFIG.tp1R);
  const tp2R = num(scenario.tp2R, TRADE_SCENARIO_CONFIG.tp2R);

  return {
    ...scenario,
    entry,
    stopLoss,
    risk,
    takeProfit1: entry + sign * risk * tp1R,
    takeProfit2: entry + sign * risk * tp2R,
    riskReward1: tp1R,
    riskReward2: tp2R
  };
}

export function buildTradeScenarios({
  candles = [],
  price,
  now = Date.now(),
  config
} = {}) {
  const settings = mergeConfig(config);
  const values = (Array.isArray(candles) ? candles : []).filter(validCandle);
  const required = Math.max(settings.lookbackBars, settings.atrPeriod + 1);
  if (values.length < required) {
    return {
      status: 'WAITING_DATA',
      generatedAt: now,
      timeframe: settings.timeframe,
      requiredBars: required,
      availableBars: values.length,
      scenarios: []
    };
  }

  const currentPrice = num(price, num(values.at(-1)?.close));
  const atrValue = scenarioAtr(values, settings.atrPeriod);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !(atrValue > 0)) {
    return {
      status: 'WAITING_DATA',
      generatedAt: now,
      timeframe: settings.timeframe,
      requiredBars: required,
      availableBars: values.length,
      scenarios: []
    };
  }

  const window = values.slice(-settings.lookbackBars);
  const resistance = Math.max(...window.map(candle => num(candle.high, -Infinity)));
  const support = Math.min(...window.map(candle => num(candle.low, Infinity)));
  if (!Number.isFinite(resistance) || !Number.isFinite(support) || resistance <= support) {
    return {
      status: 'WAITING_DATA',
      generatedAt: now,
      timeframe: settings.timeframe,
      requiredBars: required,
      availableBars: values.length,
      scenarios: []
    };
  }

  const buffer = atrValue * settings.entryBufferAtr;
  const stopPad = atrValue * settings.stopPadAtr;
  const rawSourceTime = num(values.at(-1)?.time, Date.parse(values.at(-1)?.datetime || '') || null);
  const sourceTime = Number.isFinite(rawSourceTime) && rawSourceTime > 0 && rawSourceTime < 1e12
    ? rawSourceTime * 1000
    : rawSourceTime;

  const buyBase = {
    side: 'BUY',
    trigger: 'M15_CLOSE_ABOVE',
    triggerLevel: resistance,
    entry: resistance + buffer,
    stopLoss: resistance - stopPad,
    tp1R: settings.tp1R,
    tp2R: settings.tp2R,
    reason: scenarioReason('BUY', resistance)
  };
  const sellBase = {
    side: 'SELL',
    trigger: 'M15_CLOSE_BELOW',
    triggerLevel: support,
    entry: support - buffer,
    stopLoss: support + stopPad,
    tp1R: settings.tp1R,
    tp2R: settings.tp2R,
    reason: scenarioReason('SELL', support)
  };

  return {
    status: 'READY',
    generatedAt: now,
    sourceTime,
    timeframe: settings.timeframe,
    referencePrice: currentPrice,
    atr: atrValue,
    resistance,
    support,
    validityBars: settings.validityBars,
    config: settings,
    scenarios: [
      activateTradeScenario(buyBase, buyBase.entry),
      activateTradeScenario(sellBase, sellBase.entry)
    ],
    disclaimer: 'Dua skenario bersifat kondisional. Hanya sisi yang memperoleh close M15 valid yang aktif; sisi lain dibatalkan.'
  };
}
