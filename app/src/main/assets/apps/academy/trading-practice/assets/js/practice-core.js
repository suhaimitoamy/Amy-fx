/* Amy FX Trading Practice — shared candle primitives. */
(function (root) {
  'use strict';

  if (root.AmyPracticeCore) return;

  var TIMEFRAME_SECONDS = Object.freeze({
    M1: 60,
    M5: 300,
    M15: 900,
    M30: 1800,
    H1: 3600,
    H4: 14400,
    D1: 86400
  });

  function finite(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function parseTime(value) {
    if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(String(value || '').trim())) {
      var numeric = Number(value);
      if (!Number.isFinite(numeric)) return null;
      return Math.floor(numeric > 100000000000 ? numeric / 1000 : numeric);
    }
    var text = String(value || '').trim();
    if (!text) return null;
    var normalized = text.indexOf('T') >= 0 ? text : text.replace(' ', 'T');
    if (!/[zZ]|[+-]\d\d:?\d\d$/.test(normalized)) normalized += 'Z';
    var millis = Date.parse(normalized);
    return Number.isFinite(millis) ? Math.floor(millis / 1000) : null;
  }

  function normalizeCandle(input) {
    if (!input) return null;
    if (input.isSynthetic === true || input.synthetic === true || input.isClosed === false) return null;
    var isArray = Array.isArray(input);
    var time = parseTime(isArray ? input[0] : (input.time ?? input.timestamp ?? input.datetime ?? input.open_time));
    var open = finite(isArray ? input[1] : input.open);
    var high = finite(isArray ? input[2] : input.high);
    var low = finite(isArray ? input[3] : input.low);
    var close = finite(isArray ? input[4] : input.close);
    if (![time, open, high, low, close].every(Number.isFinite)) return null;
    if (high < low || high < Math.max(open, close) || low > Math.min(open, close)) return null;
    return { time: time, open: open, high: high, low: low, close: close };
  }

  function normalizeCandles(items) {
    var byTime = new Map();
    (Array.isArray(items) ? items : []).forEach(function (item) {
      var candle = normalizeCandle(item);
      if (candle) byTime.set(candle.time, candle);
    });
    return Array.from(byTime.values()).sort(function (a, b) { return a.time - b.time; });
  }

  function mergeCandleSeries(primary, secondary, options) {
    options = options || {};
    var replaceExisting = options.replaceExisting === true;
    var byTime = new Map();
    normalizeCandles(primary).forEach(function (candle) { byTime.set(candle.time, candle); });
    normalizeCandles(secondary).forEach(function (candle) {
      if (replaceExisting || !byTime.has(candle.time)) byTime.set(candle.time, candle);
    });
    return Array.from(byTime.values()).sort(function (a, b) { return a.time - b.time; });
  }

  function upsertLatestCandle(items, value, options) {
    options = options || {};
    var trusted = options.trustedSeries === true && Array.isArray(items);
    var candles = trusted ? (options.mutate === true ? items : items.slice()) : normalizeCandles(items);
    var candle = normalizeCandle(value);
    if (!candle) return { candles: candles, candle: null, action: 'INVALID' };
    var immutableThrough = finite(options.immutableThrough);
    if (immutableThrough != null && candle.time <= immutableThrough) {
      return { candles: candles, candle: null, action: 'IGNORED_HISTORICAL' };
    }
    var last = candles.length ? candles[candles.length - 1] : null;
    if (last && candle.time < last.time) return { candles: candles, candle: null, action: 'IGNORED_OLDER' };
    if (last && candle.time === last.time) {
      candles[candles.length - 1] = candle;
      return { candles: candles, candle: candle, action: 'UPDATED' };
    }
    candles.push(candle);
    return { candles: candles, candle: candle, action: 'APPENDED' };
  }

  function timeframeSeconds(timeframe) {
    return TIMEFRAME_SECONDS[String(timeframe || '').toUpperCase()] || null;
  }

  function nyTradingDayBucket(timestampSec) {
    try {
      var d = new Date(timestampSec * 1000);
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(d);
      var vals = {};
      for (var p = 0; p < parts.length; p += 1) vals[parts[p].type] = parts[p].value;
      var nyYear = parseInt(vals.year, 10);
      var nyMonth = parseInt(vals.month, 10);
      var nyDay = parseInt(vals.day, 10);
      var nyHour = parseInt(vals.hour, 10);

      var startYear = nyYear;
      var startMonth = nyMonth;
      var startDay = nyHour >= 17 ? nyDay : nyDay - 1;

      var tempDate = new Date(Date.UTC(startYear, startMonth - 1, startDay, 17, 0, 0));
      var guess = tempDate.getTime();
      for (var attempt = 0; attempt < 3; attempt += 1) {
        var chkParts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false
        }).formatToParts(new Date(guess));
        var chkVals = {};
        for (var c = 0; c < chkParts.length; c += 1) chkVals[chkParts[c].type] = chkParts[c].value;
        var diffMin = (17 * 60) - (parseInt(chkVals.hour, 10) * 60 + parseInt(chkVals.minute, 10));
        if (diffMin === 0) break;
        guess += diffMin * 60000;
      }
      return Math.floor(guess / 1000);
    } catch (_) {
      var off = 17 * 3600;
      return Math.floor((timestampSec - off) / 86400) * 86400 + off;
    }
  }

  function aggregateCandles(items, targetTimeframe, options) {
    options = options || {};
    var targetSeconds = timeframeSeconds(targetTimeframe);
    var sourceSeconds = timeframeSeconds(options.sourceTimeframe || 'M1');
    if (!targetSeconds || !sourceSeconds || targetSeconds < sourceSeconds || targetSeconds % sourceSeconds !== 0) {
      throw new Error('Timeframe tidak dapat diagregasi dari sumber yang dipilih.');
    }
    var cursor = finite(options.cursor);
    var normalized;
    if (options.trustedSeries === true && Array.isArray(items)) {
      normalized = items;
      if (cursor != null) {
        var low = 0;
        var high = normalized.length;
        while (low < high) {
          var mid = (low + high) >> 1;
          if (normalized[mid].time <= cursor) low = mid + 1;
          else high = mid;
        }
        normalized = normalized.slice(0, low);
      }
    } else {
      normalized = normalizeCandles(items).filter(function (candle) {
        return cursor == null || candle.time <= cursor;
      });
    }
    if (targetSeconds === sourceSeconds) return normalized.map(function (candle) { return Object.assign({}, candle); });

    var output = [];
    var current = null;
    var isD1 = String(targetTimeframe || '').toUpperCase() === 'D1';
    var useNyDst = isD1 && options.nyCloseDst === true;
    var offset = isD1 ? 17 * 3600 : 0;
    for (var i = 0; i < normalized.length; i += 1) {
      var candle = normalized[i];
      var bucket = useNyDst
        ? nyTradingDayBucket(candle.time)
        : (Math.floor((candle.time - offset) / targetSeconds) * targetSeconds + offset);
      if (!current || current.time !== bucket) {
        if (current) output.push(current);
        current = {
          time: bucket,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          sourceCount: 1,
          lastSourceTime: candle.time
        };
      } else {
        if (candle.high > current.high) current.high = candle.high;
        if (candle.low < current.low) current.low = candle.low;
        current.close = candle.close;
        current.sourceCount += 1;
        current.lastSourceTime = candle.time;
      }
    }
    if (current) output.push(current);
    return output;
  }

  function synthesizeNyCloseD1(items, options) {
    var opts = Object.assign({}, options, { nyCloseDst: true });
    var d1Bars = aggregateCandles(items, 'D1', opts);
    var synthesized = [];
    for (var i = 0; i < d1Bars.length; i += 1) {
      var bar = d1Bars[i];
      var prev = i > 0 ? d1Bars[i - 1] : null;
      var pdh = prev ? prev.high : null;
      var pdl = prev ? prev.low : null;
      var tdr = Number((bar.high - bar.low).toFixed(2));
      var eq = Number(((bar.high + bar.low) / 2).toFixed(2));
      synthesized.push(Object.assign({}, bar, {
        pdh: pdh,
        pdl: pdl,
        previousDayHigh: pdh,
        previousDayLow: pdl,
        trueDayRange: tdr,
        equilibrium: eq
      }));
    }
    return synthesized;
  }

  function visibleCandles(items, cursor, timeframe, sourceTimeframe, options) {
    var safeCursor = finite(cursor);
    if (safeCursor == null) return [];
    var opts = Object.assign({}, options, {
      sourceTimeframe: sourceTimeframe || 'M1',
      cursor: safeCursor
    });
    var visible = aggregateCandles(items, timeframe, opts);
    if (visible.some(function (candle) { return candle.lastSourceTime > safeCursor || candle.time > safeCursor; })) {
      throw new Error('Replay invariant gagal: future candle terdeteksi.');
    }
    return visible;
  }

  function nearestCandle(candles, time) {
    var target = finite(time);
    if (target == null || !Array.isArray(candles) || candles.length === 0) return null;
    var best = candles[0];
    var distance = Math.abs(best.time - target);
    for (var i = 1; i < candles.length; i += 1) {
      var nextDistance = Math.abs(candles[i].time - target);
      if (nextDistance < distance) {
        best = candles[i];
        distance = nextDistance;
      }
    }
    return best;
  }

  function parseCsv(text) {
    var str = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!str) return [];
    var len = str.length;
    var firstNl = str.indexOf('\n');
    if (firstNl < 0) return [];
    var headerLine = str.slice(0, firstNl).trim();
    if (!headerLine) return [];

    var delimiter = headerLine.indexOf(';') >= 0 ? ';' : (headerLine.indexOf('\t') >= 0 ? '\t' : ',');
    var headers = headerLine.split(delimiter).map(function (value) { return value.trim().toLowerCase(); });
    function indexOf(names) {
      for (var i = 0; i < names.length; i += 1) {
        var index = headers.indexOf(names[i]);
        if (index >= 0) return index;
      }
      return -1;
    }
    var indexes = {
      time: indexOf(['datetime', 'timestamp', 'time', 'date', 'open_time']),
      open: indexOf(['open', 'o']),
      high: indexOf(['high', 'h']),
      low: indexOf(['low', 'l']),
      close: indexOf(['close', 'c'])
    };
    if (Object.keys(indexes).some(function (key) { return indexes[key] < 0; })) {
      throw new Error('CSV wajib memiliki kolom datetime/time, open, high, low, close.');
    }

    var candles = [];
    var pos = firstNl + 1;
    while (pos < len) {
      var nextNl = str.indexOf('\n', pos);
      var end = nextNl < 0 ? len : nextNl;
      var line = str.slice(pos, end).trim();
      if (line.length > 0) {
        var cells = line.split(delimiter);
        candles.push({
          time: cells[indexes.time],
          open: cells[indexes.open],
          high: cells[indexes.high],
          low: cells[indexes.low],
          close: cells[indexes.close]
        });
      }
      if (nextNl < 0) break;
      pos = nextNl + 1;
    }
    return normalizeCandles(candles);
  }

  function formatWita(timestamp, includeDate) {
    var value = finite(timestamp);
    if (value == null) return '—';
    try {
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Makassar',
        year: includeDate ? 'numeric' : undefined,
        month: includeDate ? 'short' : undefined,
        day: includeDate ? '2-digit' : undefined,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(value * 1000)) + ' WITA';
    } catch (_) {
      return new Date(value * 1000).toISOString();
    }
  }

  function price(value) {
    var number = finite(value);
    return number == null ? '—' : number.toFixed(2);
  }

  function TickAggregator(timeframe) {
    this.setTimeframe(timeframe || 'M1');
    this.current = null;
  }

  TickAggregator.prototype.setTimeframe = function (timeframe) {
    var seconds = timeframeSeconds(timeframe);
    if (!seconds) throw new Error('Timeframe live tidak didukung.');
    this.timeframe = timeframe;
    this.seconds = seconds;
    this.offset = String(timeframe || '').toUpperCase() === 'D1' ? 17 * 3600 : 0;
    this.current = null;
  };

  TickAggregator.prototype.seed = function (value) {
    var candle = normalizeCandle(value);
    if (!candle) {
      this.current = null;
      return false;
    }
    candle.time = Math.floor((candle.time - this.offset) / this.seconds) * this.seconds + this.offset;
    this.current = candle;
    return true;
  };

  TickAggregator.prototype.push = function (tick) {
    var tickPrice = finite(tick && tick.price);
    var tickTime = parseTime(tick && tick.timestamp);
    if (tickPrice == null || tickTime == null || tickPrice <= 0) return null;
    var bucket = Math.floor((tickTime - this.offset) / this.seconds) * this.seconds + this.offset;
    if (this.current && bucket < this.current.time) return null;
    var closed = null;
    if (!this.current || this.current.time !== bucket) {
      closed = this.current ? Object.assign({}, this.current, { isClosed: true }) : null;
      this.current = { time: bucket, open: tickPrice, high: tickPrice, low: tickPrice, close: tickPrice };
    } else {
      this.current.high = Math.max(this.current.high, tickPrice);
      this.current.low = Math.min(this.current.low, tickPrice);
      this.current.close = tickPrice;
    }
    return { current: Object.assign({}, this.current), closed: closed };
  };

  root.AmyPracticeCore = Object.freeze({
    TIMEFRAME_SECONDS: TIMEFRAME_SECONDS,
    finite: finite,
    parseTime: parseTime,
    normalizeCandle: normalizeCandle,
    normalizeCandles: normalizeCandles,
    mergeCandleSeries: mergeCandleSeries,
    upsertLatestCandle: upsertLatestCandle,
    timeframeSeconds: timeframeSeconds,
    aggregateCandles: aggregateCandles,
    visibleCandles: visibleCandles,
    nearestCandle: nearestCandle,
    parseCsv: parseCsv,
    formatWita: formatWita,
    price: price,
    TickAggregator: TickAggregator,
    nyTradingDayBucket: nyTradingDayBucket,
    synthesizeNyCloseD1: synthesizeNyCloseD1
  });
})(typeof window !== 'undefined' ? window : globalThis);
