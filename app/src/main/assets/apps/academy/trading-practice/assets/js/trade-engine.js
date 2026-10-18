/* Amy FX Trading Practice — manual setup records and simple forward outcome updates. */
(function (root) {
  'use strict';

  if (root.AmyPracticeTrades) return;
  var core = root.AmyPracticeCore;

  function plannedR(bias, entry, stopLoss, takeProfit) {
    var risk = Math.abs(Number(entry) - Number(stopLoss));
    var reward = Math.abs(Number(takeProfit) - Number(entry));
    return risk > 0 && reward > 0 ? reward / risk : null;
  }

  function requiredNumber(value) {
    if (value == null || String(value).trim() === '') return null;
    return core.finite(value);
  }

  function stableKey(value) {
    var text = String(value || 'local');
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function decisionId(input) {
    var symbol = String(input.symbol || 'XAUUSD').toUpperCase().replace(/[^A-Z0-9]/g, '');
    var timeframe = String(input.timeframe || 'M15').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return 'decision-' + symbol + '-' + timeframe + '-' + Math.round(Number(input.tradeTime || 0)) + '-' + stableKey(input.sourceId);
  }

  function validate(input) {
    var bias = String(input.bias || 'WAIT').toUpperCase();
    if (!['BUY', 'SELL', 'WAIT'].includes(bias)) throw new Error('Bias harus BUY, SELL, atau WAIT.');
    if (bias === 'WAIT') return { bias: bias, entry: null, stopLoss: null, takeProfit: null };
    var entry = requiredNumber(input.entry);
    var stopLoss = requiredNumber(input.stopLoss);
    var takeProfit = requiredNumber(input.takeProfit);
    if (![entry, stopLoss, takeProfit].every(Number.isFinite)) throw new Error('Entry, Stop Loss, dan Take Profit wajib diisi.');
    if (bias === 'BUY' && !(stopLoss < entry && entry < takeProfit)) throw new Error('Setup BUY wajib memiliki SL < Entry < TP.');
    if (bias === 'SELL' && !(takeProfit < entry && entry < stopLoss)) throw new Error('Setup SELL wajib memiliki TP < Entry < SL.');
    return { bias: bias, entry: entry, stopLoss: stopLoss, takeProfit: takeProfit };
  }

  function calculateExecutionFriction(bias, entryPrice, candle, options) {
    if (!Number.isFinite(entryPrice)) return { fillPrice: entryPrice, spreadPips: 0, slippagePips: 0, frictionCost: 0 };
    var candleRange = (candle && Number.isFinite(candle.high) && Number.isFinite(candle.low))
      ? (Number(candle.high) - Number(candle.low))
      : 2.0;
    var isVolatile = candleRange > 4.0;
    var baseSpreadPips = isVolatile ? 4.5 : 2.0; // 2.0 pips ($0.20) in calm market, 4.5 pips ($0.45) in volatile market
    var spreadPoints = baseSpreadPips * 0.10;

    var isMarket = options && options.isMarket;
    var slippagePips = isMarket ? ((candleRange > 6.0 ? 1.5 : 0.5) * (options.slippageFactor !== undefined ? options.slippageFactor : 1.0)) : 0;
    var slippagePoints = slippagePips * 0.10;

    var fillPrice = entryPrice;
    if (bias === 'BUY') {
      fillPrice = Math.round((entryPrice + (spreadPoints / 2) + slippagePoints) * 100) / 100;
    } else if (bias === 'SELL') {
      fillPrice = Math.round((entryPrice - (spreadPoints / 2) - slippagePoints) * 100) / 100;
    }

    return {
      fillPrice: fillPrice,
      spreadPips: baseSpreadPips,
      slippagePips: slippagePips,
      frictionCost: Math.round(Math.abs(fillPrice - entryPrice) * 100) / 100
    };
  }

  function create(input) {
    var geometry = validate(input);
    var currentPrice = core.finite(input.currentPrice);
    var isMarket = input.orderType === 'MARKET' || (currentPrice != null && Math.abs(currentPrice - geometry.entry) <= 0.25);
    var activeAtSave = geometry.bias !== 'WAIT' && isMarket;
    var tradeTime = Number(input.tradeTime);
    if (!Number.isFinite(tradeTime)) throw new Error('Timestamp keputusan tidak valid. Tunggu sampai cursor replay siap.');
    var friction = activeAtSave
      ? calculateExecutionFriction(geometry.bias, geometry.entry, input.currentCandle, { isMarket: true, slippageFactor: input.slippageFactor })
      : { fillPrice: geometry.entry, spreadPips: 0, slippagePips: 0, frictionCost: 0 };
    return {
      id: input.id || (input.lockDecision ? decisionId(input) : root.AmyPracticeStorage.identifier('trade')),
      symbol: String(input.symbol || 'XAUUSD').toUpperCase(),
      timeframe: String(input.timeframe || 'M15').toUpperCase(),
      replayStartTime: Number(input.replayStartTime || input.tradeTime),
      tradeTime: tradeTime,
      decisionCandleTime: tradeTime,
      orderType: input.orderType || (activeAtSave ? 'MARKET' : 'LIMIT'),
      sourceId: String(input.sourceId || ''),
      locked: Boolean(input.lockDecision),
      lockedAt: input.lockDecision ? Number(input.lockedAt || Date.now()) : null,
      bias: geometry.bias,
      entry: geometry.entry,
      fillPrice: friction.fillPrice,
      spreadPips: friction.spreadPips,
      slippagePips: friction.slippagePips,
      frictionCost: friction.frictionCost,
      stopLoss: geometry.stopLoss,
      takeProfit: geometry.takeProfit,
      result: geometry.bias === 'WAIT' ? 'OPEN' : 'OPEN',
      entryStatus: geometry.bias === 'WAIT' ? 'NOT_APPLICABLE' : (activeAtSave ? 'ACTIVE' : 'WAITING_FILL'),
      entryActivatedAt: activeAtSave ? tradeTime : null,
      plannedR: geometry.bias === 'WAIT' ? null : plannedR(geometry.bias, geometry.entry, geometry.stopLoss, geometry.takeProfit),
      r: null,
      notes: String(input.notes || '').trim(),
      createdAt: Number(input.createdAt || Date.now()),
      updatedAt: Date.now()
    };
  }

  function touched(candle, level) {
    return Number(candle.low) <= Number(level) && Number(candle.high) >= Number(level);
  }

  function evaluate(record, candles) {
    if (!record || !['BUY', 'SELL'].includes(record.bias)) return record;
    var needsEvidenceRepair = ['WIN', 'LOSS'].includes(record.result) && !record.outcomeEvidence;
    if (record.result !== 'OPEN' && !needsEvidenceRepair) return record;
    var next = Object.assign({}, record);
    if (needsEvidenceRepair) {
      next.result = 'OPEN';
      next.r = null;
      delete next.closedAt;
      delete next.resolution;
    }
    var sequence = core.normalizeCandles(candles).filter(function (candle) {
      if (next.entryStatus === 'ACTIVE') {
        var minTime = Number(next.entryActivatedAt || next.tradeTime || 0);
        return candle.time >= minTime;
      }
      return candle.time > Number(next.tradeTime || 0);
    });
    for (var i = 0; i < sequence.length; i += 1) {
      var candle = sequence[i];
      if (next.entryStatus !== 'ACTIVE') {
        var entryHit = touched(candle, next.entry);
        if (entryHit) {
          next.entryStatus = 'ACTIVE';
          next.entryActivatedAt = candle.time;
        } else {
          var targetHitBeforeEntry = (next.bias === 'BUY' && Number(candle.high) >= Number(next.takeProfit)) ||
                                     (next.bias === 'SELL' && Number(candle.low) <= Number(next.takeProfit)) ||
                                     touched(candle, next.takeProfit);
          if (targetHitBeforeEntry) {
            next.result = 'MISSED';
            next.entryStatus = 'EXPIRED_TARGET_HIT_FIRST';
            next.r = 0;
            next.closedAt = candle.time;
            next.resolution = 'TARGET_HIT_BEFORE_FILL';
            next.outcomeEvidence = {
              type: 'MISSED', level: Number(next.takeProfit), candleTime: candle.time,
              candleHigh: Number(candle.high), candleLow: Number(candle.low),
              ambiguous: false
            };
            break;
          }
          var slHitBeforeEntry = (next.bias === 'BUY' && Number(candle.low) <= Number(next.stopLoss)) ||
                                 (next.bias === 'SELL' && Number(candle.high) >= Number(next.stopLoss)) ||
                                 touched(candle, next.stopLoss);
          if (slHitBeforeEntry) {
            next.result = 'CANCELLED';
            next.entryStatus = 'CANCELLED_GAP_SL';
            next.r = 0;
            next.closedAt = candle.time;
            next.resolution = 'SL_HIT_BEFORE_FILL';
            next.outcomeEvidence = {
              type: 'CANCELLED_GAP', level: Number(next.stopLoss), candleTime: candle.time,
              candleHigh: Number(candle.high), candleLow: Number(candle.low),
              ambiguous: false
            };
            break;
          }
          continue;
        }
      }
      var stopHit = touched(candle, next.stopLoss);
      var targetHit = touched(candle, next.takeProfit);
      if (stopHit) {
        next.result = 'LOSS';
        next.r = -1;
        next.closedAt = candle.time;
        next.resolution = targetHit ? 'SL_FIRST_AMBIGUOUS_CANDLE' : 'SL_HIT';
        next.outcomeEvidence = {
          type: 'SL', level: Number(next.stopLoss), candleTime: candle.time,
          candleHigh: Number(candle.high), candleLow: Number(candle.low),
          ambiguous: Boolean(targetHit)
        };
        break;
      }
      if (targetHit) {
        next.result = 'WIN';
        var entryForR = Number.isFinite(next.fillPrice) ? next.fillPrice : next.entry;
        var riskAmount = Math.abs(entryForR - next.stopLoss);
        var rewardAmount = Math.abs(next.takeProfit - entryForR);
        next.r = (riskAmount > 0) ? Math.round((rewardAmount / riskAmount) * 100) / 100 : Number(next.plannedR || 0);
        next.closedAt = candle.time;
        next.resolution = 'TP_HIT';
        next.outcomeEvidence = {
          type: 'TP', level: Number(next.takeProfit), candleTime: candle.time,
          candleHigh: Number(candle.high), candleLow: Number(candle.low),
          ambiguous: false
        };
        break;
      }
    }
    if (needsEvidenceRepair && next.result === 'OPEN') return record;
    next.updatedAt = Date.now();
    return next;
  }

  root.AmyPracticeTrades = Object.freeze({ create: create, validate: validate, evaluate: evaluate, plannedR: plannedR, decisionId: decisionId, calculateExecutionFriction: calculateExecutionFriction });
})(typeof window !== 'undefined' ? window : globalThis);
